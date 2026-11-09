<?php

namespace App\Console\Commands;

use App\Services\RecommendationService;
use Illuminate\Console\Command;

/**
 * Evaluation harness for the RAG recommendation layer.
 *
 * For every entry in rag/knowledge_base.json it builds a synthetic
 * "abnormal finding" case from that entry's own test parameters and flag,
 * then runs the REAL pipeline (query embedding -> pgvector retrieval ->
 * Gemini generation) without saving anything to the database.
 *
 * Two kinds of output:
 *  1. Objective retrieval check (computed here, no human needed):
 *     hit@1 = the entry the case was built from is the top retrieved entry;
 *     hit@3 = it is among the top 3.
 *  2. A CSV for human review. The reviewer columns (accurate / safe /
 *     grounded / comments) are left blank on purpose: a medical
 *     technologist or doctor should fill them in. The "heuristic_flags"
 *     column is only a crude keyword lint, NOT a safety verdict.
 *
 * Usage:
 *   php artisan ai:evaluate                 # all entries (calls Gemini)
 *   php artisan ai:evaluate --no-llm        # retrieval check only
 *   php artisan ai:evaluate --only=hiv-reactive
 *   php artisan ai:evaluate --sleep=8       # seconds between Gemini calls
 *
 * Requires the embedding service (port 8003) to be running.
 */
class EvaluateRecommendations extends Command
{
    protected $signature = 'ai:evaluate
        {--no-llm : Only check retrieval, do not call Gemini}
        {--only= : Run a single knowledge base entry id}
        {--limit=0 : Run at most N entries (0 = all)}
        {--sleep=5 : Seconds to wait between Gemini calls}';

    protected $description = 'Evaluate retrieval accuracy and export AI recommendations for clinician review';

    public function handle(RecommendationService $service): int
    {
        $path = base_path('../rag/knowledge_base.json');

        if (! is_file($path)) {
            $this->error("Knowledge base not found at {$path}");

            return self::FAILURE;
        }

        $entries = json_decode(file_get_contents($path), true);

        if ($only = $this->option('only')) {
            $entries = array_values(array_filter($entries, fn ($e) => $e['id'] === $only));
        }

        if ((int) $this->option('limit') > 0) {
            $entries = array_slice($entries, 0, (int) $this->option('limit'));
        }

        if (empty($entries)) {
            $this->error('No entries to evaluate.');

            return self::FAILURE;
        }

        $callLlm = ! $this->option('no-llm');
        $sleep = max(0, (int) $this->option('sleep'));

        $file = storage_path('app/ai_evaluation_' . date('Ymd_His') . '.csv');
        $out = fopen($file, 'w');
        fwrite($out, "\xEF\xBB\xBF"); // UTF-8 BOM so Excel reads it correctly

        fputcsv($out, [
            'entry_id', 'test_type', 'parameters', 'flag',
            'top1_key', 'top1_distance', 'top3_keys', 'hit_at_1', 'hit_at_3',
            'recommendation_text', 'word_count', 'heuristic_flags',
            'reviewer_accurate_yn', 'reviewer_safe_yn', 'reviewer_grounded_yn', 'reviewer_comments',
        ]);

        $total = 0;
        $hit1 = 0;
        $hit3 = 0;
        $generated = 0;

        foreach ($entries as $i => $entry) {
            $findings = array_map(fn ($param) => [
                'parameter_name' => $param,
                'value' => 'not specified (synthetic test case)',
                'unit' => null,
                'flag' => $entry['flag'],
                'test_type_code' => $entry['test_type'],
            ], $entry['parameters']);

            $result = $service->generateFromFindings($findings, $callLlm);

            $keys = array_column($result['retrieved'], 'entry_key');
            $top1 = $keys[0] ?? '';
            $isHit1 = $top1 === $entry['id'];
            $isHit3 = in_array($entry['id'], array_slice($keys, 0, 3), true);

            $total++;
            $hit1 += $isHit1 ? 1 : 0;
            $hit3 += $isHit3 ? 1 : 0;

            $text = $result['text'];
            $generated += $text ? 1 : 0;

            fputcsv($out, [
                $entry['id'],
                $entry['test_type'],
                implode('; ', $entry['parameters']),
                $entry['flag'],
                $top1,
                isset($result['retrieved'][0]['distance']) ? round((float) $result['retrieved'][0]['distance'], 4) : '',
                implode('; ', array_slice($keys, 0, 3)),
                $isHit1 ? 'yes' : 'no',
                $isHit3 ? 'yes' : 'no',
                $text ?? '',
                $text ? str_word_count($text) : 0,
                $text ? $this->heuristicFlags($text) : '',
                '', '', '', '',
            ]);

            $this->line(sprintf(
                '[%d/%d] %-32s top1=%-28s %s',
                $i + 1,
                count($entries),
                $entry['id'],
                $top1 ?: '(none)',
                $isHit1 ? 'hit@1' : ($isHit3 ? 'hit@3' : 'MISS')
            ));

            if ($callLlm && $sleep > 0 && $i < count($entries) - 1) {
                sleep($sleep);
            }
        }

        fclose($out);

        $this->newLine();
        $this->info(sprintf('Retrieval hit@1: %d/%d (%.1f%%)', $hit1, $total, 100 * $hit1 / $total));
        $this->info(sprintf('Retrieval hit@3: %d/%d (%.1f%%)', $hit3, $total, 100 * $hit3 / $total));

        if ($callLlm) {
            $this->info("Recommendations generated: {$generated}/{$total}");
        }

        $this->info("CSV written to: {$file}");
        $this->line('Reviewer columns are blank on purpose: have a medical technologist or doctor fill them in.');

        return self::SUCCESS;
    }

    /**
     * Crude keyword lint. A hit means "look at this one", a miss does NOT
     * mean the text is safe.
     */
    private function heuristicFlags(string $text): string
    {
        $checks = [
            'markdown_chars' => '/[*#_`]/',
            'direct_diagnosis' => '/\byou (have|are diagnosed|definitely)\b/i',
            'treatment_instruction' => '/\b(you should|you must|start|starting|begin|beginning|stop|stopping|take|taking)\b[^.]{0,40}\b(medication|medicine|drug|therapy|treatment|tablet|dose|mg)\b/i',
            'disclaimer_in_text' => '/\b(disclaimer|not (a )?medical advice)\b/i',
        ];

        $hits = [];

        foreach ($checks as $name => $regex) {
            if (preg_match($regex, $text)) {
                $hits[] = $name;
            }
        }

        return implode('; ', $hits);
    }
}
