<?php

namespace App\Services;

use App\Models\AiRecommendation;
use App\Models\LabResult;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Generation half of the RAG recommendation layer (see
 * KnowledgeRetrievalService for the retrieval half).
 *
 * Implements Figure 3-9 "AI Recommendation Generation Flow" from the
 * thesis document, extended with retrieval-augmented grounding (Option B,
 * per the user's decision -- the originally-defended design used plain
 * prompt engineering with no retrieval step; Chapter 2/3 still need a
 * documentation update to describe this accurately).
 *
 * LLM: Google Gemini API (switched from Claude API on 2026-10-02, per
 * user's decision -- Gemini's free tier removes the API billing blocker
 * entirely for thesis-scale usage; this is a separate, additional
 * documentation gap for Chapter 2/3 alongside the already-known
 * RAG-architecture gap above).
 *
 * Trigger condition (per Figure 3-9): only called when a lab result has
 * at least one abnormal (HIGH/LOW/ABNORMAL) parameter. If none, the
 * caller should skip this entirely and show the standard "all normal"
 * notification instead -- this class does not decide that, the caller
 * does, by only calling generate() when it has abnormal findings.
 */
class RecommendationService
{
    public function __construct(
        private KnowledgeRetrievalService $retrieval = new KnowledgeRetrievalService(),
    ) {
    }

    /**
     * @return AiRecommendation|null null if there's nothing to recommend
     *         on (no abnormal findings) or the API call fails (best-effort,
     *         logged, does not block approval).
     */
    public function generate(LabResult $labResult): ?AiRecommendation
    {
        $labResult->loadMissing(['parameters', 'testType']);

        $abnormalFindings = $labResult->parameters
            ->whereIn('flag', ['LOW', 'HIGH', 'ABNORMAL'])
            ->map(fn ($p) => [
                'parameter_name' => $p->parameter_name,
                'value' => $p->value_numeric ?? $p->value_text,
                'unit' => $p->unit,
                'flag' => $p->flag,
                'test_type_code' => $labResult->testType?->code,
            ])
            ->values()
            ->all();

        if (empty($abnormalFindings)) {
            return null;
        }

        $retrievedEntries = $this->retrieval->retrieve($abnormalFindings);

        // Grounding guard: this is a RAG system, so do not let the LLM
        // answer from its own general knowledge when nothing was
        // retrieved (embedding service down, or no knowledge base entry
        // for this finding). No recommendation is better than an
        // ungrounded one. The Doctor review modal retries on open.
        if (empty($retrievedEntries)) {
            Log::warning(
                'AI recommendation skipped: no knowledge base entries retrieved',
                ['lab_result_id' => $labResult->id]
            );

            return null;
        }

        $prompt = $this->buildPrompt($abnormalFindings, $retrievedEntries);

        $recommendationText = $this->callGemini($prompt);

        if ($recommendationText === null) {
            return null;
        }

        return AiRecommendation::updateOrCreate(
            ['lab_result_id' => $labResult->id],
            [
                'recommendation_text' => $recommendationText,
                'model_used' => config('services.gemini.model'),
                'input_findings' => $abnormalFindings,
                'retrieved_entry_keys' => array_column($retrievedEntries, 'entry_key'),
                'generated_at' => now(),
            ]
        );
    }

    /**
     * Runs retrieval + generation for a list of findings WITHOUT touching
     * the database. Used by the `ai:evaluate` command to test the pipeline
     * on synthetic cases. Applies the same grounding guard as generate().
     *
     * @param array<int, array{parameter_name: string, value: mixed, unit: ?string, flag: string}> $abnormalFindings
     * @return array{text: ?string, retrieved: array<int, array<string, mixed>>}
     */
    public function generateFromFindings(array $abnormalFindings, bool $callLlm = true): array
    {
        $retrievedEntries = $this->retrieval->retrieve($abnormalFindings);

        if (empty($retrievedEntries) || ! $callLlm) {
            return ['text' => null, 'retrieved' => $retrievedEntries];
        }

        $prompt = $this->buildPrompt($abnormalFindings, $retrievedEntries);

        return [
            'text' => $this->callGemini($prompt),
            'retrieved' => $retrievedEntries,
        ];
    }

    /**
     * @param array<int, array{parameter_name: string, value: mixed, unit: ?string, flag: string}> $abnormalFindings
     * @param array<int, array{entry_key: string, title: string, content: string, source_title: string, source_url: string}> $retrievedEntries
     */
    private function buildPrompt(array $abnormalFindings, array $retrievedEntries): string
    {
        $findingsText = implode("\n", array_map(
            fn ($f) => sprintf(
                '- %s: %s%s (Flag: %s)',
                $f['parameter_name'],
                $f['value'],
                !empty($f['unit']) ? " {$f['unit']}" : '',
                $f['flag']
            ),
            $abnormalFindings
        ));

        if (empty($retrievedEntries)) {
            $contextText = "(No matching reference material was found in the knowledge base for "
                . "this finding. Answer conservatively and rely on general, widely-accepted "
                . "health guidance; be extra careful not to overstate certainty.)";
        } else {
            $contextText = implode("\n\n", array_map(
                fn ($e) => sprintf(
                    "Reference (%s): %s\nSource: %s (%s)",
                    $e['title'],
                    $e['content'],
                    $e['source_title'],
                    $e['source_url']
                ),
                $retrievedEntries
            ));
        }

        return <<<PROMPT
        You are a health information assistant for a rural municipal hospital's lab result
        portal in the Philippines. Provide general, non-diagnostic health guidance based on
        the abnormal lab finding(s) below. Do not provide a diagnosis or treatment plan.
        Ground your answer in the reference material provided. If it does not cover a
        finding, do not invent detail and do not mention "reference material" to the
        patient; simply say that their doctor will explain that result.

        Patient abnormal finding(s):
        {$findingsText}

        Reference material (retrieved from a curated, citation-backed knowledge base):
        {$contextText}

        Generate a brief, plain-language explanation (3-6 sentences) of what these results
        may indicate and general lifestyle/wellness guidance, grounded in the reference
        material above. Write plain text only: no markdown, no asterisks, no bullet points.
        Explain what the result means and encourage the patient to talk to their doctor or
        testing site about next steps. Do not instruct the patient to start, stop or change
        any treatment or medication. Do not write a disclaimer; the portal adds one.
        PROMPT;
    }

    private function callGemini(string $prompt): ?string
    {
        $apiKey = config('services.gemini.key');
        $model = config('services.gemini.model');

        if (!$apiKey) {
            Log::warning('AI recommendation skipped: GEMINI_API_KEY not configured');
            return null;
        }

        // php artisan serve stops a request after 30s by default. Gemini may need
        // up to 3 attempts (20s timeout each, plus 2s and 5s waits), so allow more.
        @set_time_limit(90);

        try {
            $response = Http::timeout(20)
                // Gemini sometimes answers 503 "high demand" / 429 for a few seconds.
                // Retry three times (after 2s, 5s, then 10s) on those temporary errors only. 429 is not retried: with the free tier it usually means the daily quota is used up, and retrying only wastes more requests.
                ->retry([2000, 5000, 10000], 0, function ($exception) {
                    return $exception instanceof RequestException
                        && in_array($exception->response->status(), [500, 502, 503, 504], true);
                }, throw: false)
                ->withHeaders([
                    'x-goog-api-key' => $apiKey,
                    'content-type' => 'application/json',
                ])
                ->post("https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent", [
                    'contents' => [
                        [
                            'parts' => [
                                ['text' => $prompt],
                            ],
                        ],
                    ],
                    'generationConfig' => [
                        // Gemini counts thinking tokens inside maxOutputTokens (official
                        // thinking docs), so 500 could cut the answer off mid-sentence once
                        // there are several findings. The text itself is only 3-6 sentences.
                        'maxOutputTokens' => 2048,
                        // Low thinking level: this task is grounded summarization/fact
                        // retrieval over a short context, not multi-step reasoning, so
                        // the docs' own guidance ("use minimal or low thinking for fact
                        // retrieval") applies -- keeps latency down without needing
                        // extended reasoning for a task this constrained.
                        'thinkingConfig' => [
                            'thinkingLevel' => 'low',
                        ],
                    ],
                ]);

            if (!$response->successful()) {
                Log::warning('AI recommendation failed: non-2xx response from Gemini API', [
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);
                return null;
            }

            $data = $response->json();

            // Never store or show a truncated or blocked answer: anything other than a
            // normal STOP (MAX_TOKENS, SAFETY, ...) is treated as "no recommendation".
            $finishReason = $data['candidates'][0]['finishReason'] ?? null;

            if ($finishReason !== null && $finishReason !== 'STOP') {
                Log::warning('AI recommendation skipped: Gemini did not finish normally', [
                    'finishReason' => $finishReason,
                    'promptFeedback' => $data['promptFeedback'] ?? null,
                ]);
                return null;
            }

            $parts = $data['candidates'][0]['content']['parts'] ?? [];

            // Skip any "thought" parts (reasoning summaries); only the parts without
            // thought=true contain the actual answer text.
            $text = collect($parts)
                ->filter(fn ($part) => empty($part['thought']) && isset($part['text']))
                ->pluck('text')
                ->implode('');

            if ($text === '') {
                Log::warning('AI recommendation failed: unexpected response shape', ['data' => $data]);
                return null;
            }

            return trim(str_replace('*', '', $text));
        } catch (\Throwable $e) {
            Log::warning('AI recommendation failed: request error', [
                'message' => $e->getMessage(),
            ]);
            return null;
        }
    }
}
