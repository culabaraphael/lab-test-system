<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Retrieval half of the RAG recommendation layer.
 *
 * Given a lab result's abnormal (HIGH/LOW/ABNORMAL) parameters, this:
 *   1. Builds a plain-language query text from the findings
 *      (e.g. "White Blood Cell Count HIGH; Hemoglobin LOW")
 *   2. Calls the embedding microservice (ml/embedding_api.py, port 8003)
 *      to turn that text into the same 384-dim vector space as
 *      knowledge_base_entries.embedding
 *   3. Queries Postgres/pgvector for the closest entries by cosine
 *      distance (<=> operator)
 *
 * Best-effort like the ML prediction services: if the embedding service
 * is down or a query fails, this logs and returns an empty array rather
 * than blocking result approval. A recommendation with no retrieved
 * context is still possible (RecommendationService can fall back to
 * findings-only), but is a real, disclosed quality risk, not silently
 * treated as equivalent to a properly-grounded one.
 */
class KnowledgeRetrievalService
{
    /**
     * @param array<int, array{parameter_name: string, value: mixed, unit: ?string, flag: string}> $abnormalFindings
     * @param int $topK how many knowledge base entries to retrieve
     * @return array<int, array{entry_key: string, title: string, content: string, source_title: string, source_url: string, flag: string, distance: float}>
     */
    public function retrieve(array $abnormalFindings, int $topK = 2, int $maxEntries = 6): array
    {
        if (empty($abnormalFindings)) {
            return [];
        }

        // One abnormal finding: a single search, top 3.
        if (count($abnormalFindings) === 1) {
            return $this->searchByQuery($abnormalFindings, 3);
        }

        // Several abnormal findings (e.g. a CBC with 4 abnormal parameters):
        // one combined query embeds to a blend of all of them and tends to
        // favor one finding, leaving the others uncovered. So search for
        // each finding on its own, keep the best $topK per finding, merge
        // duplicates (keeping the smallest distance) and cap the total.
        $merged = [];

        foreach ($abnormalFindings as $finding) {
            foreach ($this->searchByQuery([$finding], $topK) as $row) {
                $key = $row['entry_key'];

                if (! isset($merged[$key]) || $row['distance'] < $merged[$key]['distance']) {
                    $merged[$key] = $row;
                }
            }
        }

        uasort($merged, fn ($a, $b) => $a['distance'] <=> $b['distance']);

        return array_slice(array_values($merged), 0, $maxEntries);
    }

    /**
     * Embeds a query built from the given findings and returns the $topK
     * nearest knowledge base entries by cosine distance.
     *
     * @param array<int, array{parameter_name: string, value: mixed, unit: ?string, flag: string}> $abnormalFindings
     * @return array<int, array<string, mixed>>
     */
    private function searchByQuery(array $abnormalFindings, int $topK): array
    {
        $queryText = $this->buildQueryText($abnormalFindings);

        $embedding = $this->embed($queryText);

        if ($embedding === null) {
            return [];
        }

        $vectorLiteral = '[' . implode(',', $embedding) . ']';

        // Direction guard: embeddings are weak at telling "HIGH" from "LOW", so a
        // LOW finding must never be answered with HIGH-only guidance (and vice
        // versa). Entries flagged ABNORMAL, or with the same flag, stay eligible.
        $flags = array_unique(array_map(fn ($f) => $f['flag'] ?? '', $abnormalFindings));
        $onlyFlag = count($flags) === 1 ? reset($flags) : null;
        $opposite = $onlyFlag === 'LOW' ? 'HIGH' : ($onlyFlag === 'HIGH' ? 'LOW' : null);

        // Test-type guard: a Urinalysis finding must only be answered with
        // Urinalysis guidance (and CBC with CBC, etc.). Embeddings alone
        // confused "Blood" (UA) with fecal occult blood, and UA "White Blood
        // Cells" with CBC WBC LOW (found by `php artisan ai:evaluate`).
        // Only applied when every finding has the same test_type_code AND
        // the knowledge base has entries for that code; otherwise it falls
        // back to searching everything instead of returning nothing.
        $codes = array_unique(array_map(fn ($f) => $f['test_type_code'] ?? '', $abnormalFindings));
        $typeCode = (count($codes) === 1 && reset($codes) !== '') ? reset($codes) : null;

        try {
            $rows = DB::select(
                'SELECT entry_key, title, content, source_title, source_url, flag,
                        embedding <=> ?::vector AS distance
                 FROM knowledge_base_entries
                 WHERE (?::text IS NULL OR flag <> ?::text)
                   AND (?::text IS NULL
                        OR test_type_code = ?::text
                        OR NOT EXISTS (SELECT 1 FROM knowledge_base_entries k2 WHERE k2.test_type_code = ?::text))
                 ORDER BY distance ASC
                 LIMIT ?',
                [$vectorLiteral, $opposite, $opposite, $typeCode, $typeCode, $typeCode, $topK]
            );
        } catch (\Throwable $e) {
            Log::warning('Knowledge base retrieval failed: query error', [
                'message' => $e->getMessage(),
            ]);
            return [];
        }

        return array_map(fn ($row) => (array) $row, $rows);
    }

    /**
     * @param array<int, array{parameter_name: string, value: mixed, unit: ?string, flag: string}> $abnormalFindings
     */
    private function buildQueryText(array $abnormalFindings): string
    {
        $parts = array_map(
            fn ($f) => trim(sprintf(
                '%s %s%s',
                $f['parameter_name'],
                $f['flag'],
                isset($f['value']) ? " ({$f['value']}" . (!empty($f['unit']) ? " {$f['unit']}" : '') . ')' : ''
            )),
            $abnormalFindings
        );

        return implode('; ', $parts);
    }

    private function embed(string $text): ?array
    {
        $baseUrl = config('services.embedding_ml.url');

        if (!$baseUrl) {
            Log::warning('Knowledge base retrieval skipped: EMBEDDING_ML_URL not configured');
            return null;
        }

        try {
            $response = Http::timeout(5)
                ->post(rtrim($baseUrl, '/') . '/embed', ['text' => $text]);

            if (!$response->successful()) {
                Log::warning('Embedding request failed: non-2xx response', [
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);
                return null;
            }

            $data = $response->json();

            if (!isset($data['embedding']) || count($data['embedding']) !== 384) {
                Log::warning('Embedding request returned unexpected shape', ['data' => $data]);
                return null;
            }

            return $data['embedding'];
        } catch (\Throwable $e) {
            Log::warning('Embedding request failed: connection error', [
                'message' => $e->getMessage(),
            ]);
            return null;
        }
    }
}
