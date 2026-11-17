<?php

namespace App\Services;

use App\Models\AiRecommendation;
use App\Models\LabResult;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\DB;
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
    /** True when the last Gemini request failed in a way another model may avoid (overload, timeout, quota). */
    private bool $lastFailureTransient = false;

    /** Model that produced the text returned by the last successful callGemini(). */
    private ?string $lastModelUsed = null;

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
                'model_used' => $this->lastModelUsed ?? config('services.gemini.model'),
                'input_findings' => $abnormalFindings,
                'retrieved_entry_keys' => array_column($retrievedEntries, 'entry_key'),
                'lifestyle' => $this->lifestyleForKeys(array_column($retrievedEntries, 'entry_key')),
                'lifestyle_ceb' => null,
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
     * Lifestyle tips (daily food, routine, what to avoid) for the retrieved KB
     * entries. The text comes straight from the cited sources stored in
     * knowledge_base_entries.lifestyle; the LLM does not write it. Returns null
     * when none of the entries has lifestyle content.
     *
     * @param array<int, string> $entryKeys
     * @return array{food: array<int,string>, routine: array<int,string>, avoid: array<int,string>, notes: array<int,string>, sources: array<int,array{title:string,url:string}>}|null
     */
    public function lifestyleForKeys(array $entryKeys): ?array
    {
        if (empty($entryKeys)) {
            return null;
        }

        $rows = DB::table('knowledge_base_entries')
            ->whereIn('entry_key', $entryKeys)
            ->whereNotNull('lifestyle')
            ->pluck('lifestyle', 'entry_key');

        $merged = ['food' => [], 'routine' => [], 'avoid' => [], 'notes' => [], 'sources' => []];
        $seenSources = [];

        foreach ($entryKeys as $key) {
            if (! isset($rows[$key])) {
                continue;
            }

            $item = json_decode($rows[$key], true);

            if (! is_array($item)) {
                continue;
            }

            foreach (['food', 'routine', 'avoid', 'notes'] as $field) {
                foreach (($item[$field] ?? []) as $line) {
                    if (is_string($line) && trim($line) !== '' && ! in_array($line, $merged[$field], true)) {
                        $merged[$field][] = $line;
                    }
                }
            }

            foreach (($item['sources'] ?? []) as $source) {
                $url = $source['url'] ?? null;

                if ($url && ! isset($seenSources[$url])) {
                    $seenSources[$url] = true;
                    $merged['sources'][] = ['title' => $source['title'] ?? $url, 'url' => $url];
                }
            }
        }

        foreach (['food', 'routine', 'avoid'] as $field) {
            $merged[$field] = array_slice($merged[$field], 0, 5);
        }

        if (empty($merged['food']) && empty($merged['routine']) && empty($merged['avoid'])) {
            return null;
        }

        return $merged;
    }

    /**
     * Bisaya version of the English explanation AND the lifestyle tips in ONE
     * request. Lines are numbered so the answer can be matched back. If the
     * numbering does not come back intact, falls back to translating only the
     * explanation (the lifestyle tips then stay in English).
     *
     * @return array{text: string, lifestyle: ?array}|null
     */
    public function translateBundleToBisaya(string $englishText, ?array $lifestyle): ?array
    {
        $lines = [preg_replace('/\s+/', ' ', trim($englishText))];
        $map = [];

        if ($lifestyle) {
            foreach (['food', 'routine', 'avoid', 'notes'] as $field) {
                foreach (($lifestyle[$field] ?? []) as $i => $line) {
                    $lines[] = $line;
                    $map[] = [$field, $i];
                }
            }
        }

        $numbered = [];
        foreach ($lines as $n => $line) {
            $numbered[] = ($n + 1) . '. ' . $line;
        }
        $input = implode("\n", $numbered);

        $prompt = <<<PROMPT
        Translate each numbered line below from English into Cebuano (Bisaya) as commonly
        spoken in Mindanao, Philippines. Rules: translate faithfully; do not add, remove or
        soften any statement; do not add advice of your own; keep numbers, units and lab
        test names (for example mg/dL, Hemoglobin) unchanged; use plain, simple everyday
        words a patient can understand; plain text only, no markdown, no asterisks.
        Keep the same numbering and give exactly one output line per input line, in the
        format "1. translated text". Output only the translated lines.

        {$input}
        PROMPT;

        $raw = $this->callGemini($prompt);

        if ($raw === null) {
            return null;
        }

        // Parse "N. text" lines. A line without a number is a continuation of
        // the previous numbered line (the model sometimes breaks a long
        // explanation over several lines); it is appended instead of being
        // dropped, so the Bisaya text is not cut short.
        $out = [];
        $current = null;
        foreach (preg_split('/\R+/', trim($raw)) as $row) {
            if (preg_match('/^\s*(\d+)\.\s+(.+)$/u', $row, $m)
                && (int) $m[1] >= 1 && (int) $m[1] <= count($lines)
                && ! isset($out[(int) $m[1]])) {
                $current = (int) $m[1];
                $out[$current] = trim($m[2]);
            } elseif ($current !== null && trim($row) !== '') {
                $out[$current] .= ' ' . trim($row);
            }
        }

        $complete = count($out) === count($lines);

        for ($n = 1; $complete && $n <= count($lines); $n++) {
            $complete = isset($out[$n]);
        }

        if (! $complete) {
            Log::warning('Bisaya bundle translation: numbering mismatch, falling back to text only', [
                'expected' => count($lines),
                'got' => count($out),
            ]);

            $textOnly = $this->translateToBisaya($englishText);

            return $textOnly === null ? null : ['text' => $textOnly, 'lifestyle' => null];
        }

        $cebLifestyle = null;

        if ($lifestyle) {
            $cebLifestyle = ['food' => [], 'routine' => [], 'avoid' => [], 'notes' => []];

            foreach ($map as $idx => [$field, $i]) {
                $cebLifestyle[$field][] = $out[$idx + 2];
            }
        }

        return ['text' => $out[1], 'lifestyle' => $cebLifestyle];
    }

    /**
     * Translates the (doctor-reviewed) English health information into Bisaya
     * (Cebuano). Uses the same provider chain as generation (Groq, then Gemini).
     * Returns null on failure. The Doctor reviews and can edit the result.
     */
    public function translateToBisaya(string $englishText): ?string
    {
        $prompt = <<<PROMPT
        Translate the patient health information below from English into Cebuano (Bisaya)
        as commonly spoken in Mindanao, Philippines. Rules: translate faithfully and
        completely; do not add, remove or soften any statement; do not add advice or
        explanations of your own; keep numbers, units and lab test names (for example
        mg/dL, Hemoglobin) unchanged; use plain, simple everyday words a patient can
        understand; write plain text only, no markdown, no asterisks, no bullet points.
        Output only the translation.

        English text:
        {$englishText}
        PROMPT;

        return $this->callGemini($prompt);
    }

    /**
     * @param array<int, array{parameter_name: string, value: mixed, unit: ?string, flag: string}> $abnormalFindings
     * @param array<int, array{entry_key: string, title: string, content: string, source_title: string, source_url: string}> $retrievedEntries
     */
    private function buildPrompt(array $abnormalFindings, array $retrievedEntries): string
    {
        // Only describe findings the retrieved reference material is actually about
        // (same parameter, compatible direction). The rest are named so the model
        // can say "your doctor will explain", but must not describe them. Without
        // this, a CBC with many abnormal values got a text that talked about
        // red cells, hemoglobin and cell size although the material covered only
        // white cells and platelets.
        $uncovered = [];

        if (! empty($retrievedEntries)) {
            $matches = function (array $f, array $e): bool {
                $params = $e['parameters'] ?? [];
                if (is_string($params)) {
                    $params = json_decode($params, true) ?: [];
                }

                $sameParam = in_array(
                    strtolower(trim((string) $f['parameter_name'])),
                    array_map(fn ($x) => strtolower(trim((string) $x)), $params),
                    true
                );
                $entryFlag = $e['flag'] ?? 'ABNORMAL';

                return $sameParam && ($entryFlag === 'ABNORMAL' || $entryFlag === ($f['flag'] ?? ''));
            };

            $covered = [];
            $notCovered = [];

            foreach ($abnormalFindings as $f) {
                $hit = false;
                foreach ($retrievedEntries as $e) {
                    if ($matches($f, $e)) {
                        $hit = true;
                        break;
                    }
                }
                $hit ? $covered[] = $f : $notCovered[] = $f;
            }

            if (! empty($covered)) {
                $abnormalFindings = $covered;
                $uncovered = $notCovered;

                // Also drop entries that are about none of the described findings.
                $retrievedEntries = array_values(array_filter(
                    $retrievedEntries,
                    function ($e) use ($covered, $matches) {
                        foreach ($covered as $f) {
                            if ($matches($f, $e)) {
                                return true;
                            }
                        }
                        return false;
                    }
                ));
            }
        }

        $uncoveredNote = empty($uncovered)
            ? ''
            : "\n\nOther abnormal result(s) with NO reference material: "
                . implode(', ', array_map(fn ($f) => $f['parameter_name'], $uncovered))
                . ". Do not describe these or say what they mean. Do not mention their values. "
                . "Only say that the doctor will explain those other results.";

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
        {$findingsText}{$uncoveredNote}

        Reference material (retrieved from a curated, citation-backed knowledge base):
        {$contextText}

        Generate a brief, plain-language explanation (3-6 sentences) of what these results
        may indicate, using ONLY facts stated in the reference material above. Do not add
        causes, risk factors, foods, exercise or lifestyle advice that the reference material
        does not state; if the material itself gives general guidance, you may restate it.
        Never say or imply that the patient has a specific condition; describe possibilities
        with words like "may" or "can". Write plain text only: no markdown, no asterisks, no bullet points.
        Explain what the result means and encourage the patient to talk to their doctor or
        testing site about next steps. Do not instruct the patient to start, stop or change
        any treatment or medication. Do not write a disclaimer; the portal adds one.
        PROMPT;
    }

    /**
     * Tries the main model first (one retry on temporary server errors), then,
     * only if GEMINI_FALLBACK_MODEL is set and the failure looks temporary
     * (overload, timeout, quota on that model), tries the fallback model once.
     * Each model has its own rate limits, so a fallback also spreads the load.
     */
    private function callGemini(string $prompt): ?string
    {
        $primary = config('services.gemini.model');
        $fallback = config('services.gemini.fallback_model');

        // php artisan serve stops a request after 30s by default. Worst case here is
        // primary (25s + 3s wait + 25s) plus fallback (25s) = about 78s.
        @set_time_limit(120);

        // Groq first when GROQ_API_KEY is set. If it fails for any reason, fall through
        // to Gemini below (when a Gemini key exists). Worst case: Groq 25s + Gemini ~78s.
        if (config('services.groq.key')) {
            $groqText = $this->requestGroq($prompt);

            if ($groqText !== null) {
                return $groqText;
            }

            Log::warning('AI recommendation: Groq failed, trying Gemini');

            if (! config('services.gemini.key')) {
                return null;
            }
        }

        $text = $this->requestGemini($prompt, $primary, true);

        if ($text !== null) {
            return $text;
        }

        if ($fallback && $fallback !== $primary && $this->lastFailureTransient) {
            Log::warning('AI recommendation: main model failed, trying fallback model', [
                'primary' => $primary,
                'fallback' => $fallback,
            ]);

            return $this->requestGemini($prompt, $fallback, false);
        }

        return null;
    }

    /**
     * Groq (OpenAI-compatible chat completions). Same grounded prompt as Gemini.
     * Reasoning tokens count toward max_completion_tokens, so the limit is generous.
     */
    private function requestGroq(string $prompt): ?string
    {
        $apiKey = config('services.groq.key');
        $model = config('services.groq.model');

        try {
            $response = Http::timeout(25)
                ->withToken($apiKey)
                ->acceptJson()
                ->post('https://api.groq.com/openai/v1/chat/completions', [
                    'model' => $model,
                    'messages' => [
                        ['role' => 'user', 'content' => $prompt],
                    ],
                    'max_completion_tokens' => 2048,
                    'reasoning_effort' => 'low',
                ]);

            if (! $response->successful()) {
                Log::warning('AI recommendation failed: non-2xx response from Groq API', [
                    'model' => $model,
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);
                return null;
            }

            $data = $response->json();

            // Same rule as Gemini: never store a truncated answer.
            $finishReason = $data['choices'][0]['finish_reason'] ?? null;

            if ($finishReason !== null && $finishReason !== 'stop') {
                Log::warning('AI recommendation skipped: Groq did not finish normally', [
                    'finish_reason' => $finishReason,
                ]);
                return null;
            }

            $text = trim((string) ($data['choices'][0]['message']['content'] ?? ''));

            if ($text === '') {
                Log::warning('AI recommendation failed: empty Groq response', ['data' => $data]);
                return null;
            }

            $this->lastModelUsed = $model;

            return trim(str_replace('*', '', $text));
        } catch (\Throwable $e) {
            Log::warning('AI recommendation failed: Groq request error', [
                'model' => $model,
                'message' => $e->getMessage(),
            ]);
            return null;
        }
    }

    private function requestGemini(string $prompt, string $model, bool $retryOnServerError): ?string
    {
        $apiKey = config('services.gemini.key');
        $this->lastFailureTransient = false;

        if (!$apiKey) {
            Log::warning('AI recommendation skipped: GEMINI_API_KEY not configured');
            return null;
        }

        try {
            $http = Http::timeout(25);

            if ($retryOnServerError) {
                // Gemini sometimes answers 503 "high demand" for a few seconds. Retry once
                // after 3s on 5xx only. 429 is not retried (daily or per-minute quota:
                // retrying only wastes more requests), and every retry counts toward the
                // free-tier limit of 5 requests per minute.
                $http = $http->retry([3000], 0, function ($exception) {
                    return $exception instanceof RequestException
                        && in_array($exception->response->status(), [500, 502, 503, 504], true);
                }, throw: false);
            }

            $response = $http
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
                $this->lastFailureTransient = in_array($response->status(), [429, 500, 502, 503, 504], true);

                Log::warning('AI recommendation failed: non-2xx response from Gemini API', [
                    'model' => $model,
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

            $this->lastModelUsed = $model;

            return trim(str_replace('*', '', $text));
        } catch (\Throwable $e) {
            // Timeouts and connection errors: another model may answer.
            $this->lastFailureTransient = true;

            Log::warning('AI recommendation failed: request error', [
                'model' => $model,
                'message' => $e->getMessage(),
            ]);
            return null;
        }
    }
}
