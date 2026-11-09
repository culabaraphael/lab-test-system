<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Calls the CBC ML microservice (backend/ml/api.py, a FastAPI app running
 * separately via `uvicorn api:app`) to get a predicted anemia-type
 * diagnosis for a set of CBC values.
 *
 * This is intentionally best-effort: if the ML service is down, slow, or
 * returns something unexpected, we log it and return null rather than
 * blocking a MedTech from submitting a lab result. The ML prediction is
 * a supplementary signal for the Doctor, not a gate on the workflow.
 */
class CbcMlPredictionService
{
    /**
     * Maps this app's parameter_name strings (from ReferenceRangeSeeder)
     * to the short field names the trained model expects.
     */
    private const PARAMETER_NAME_MAP = [
        'White Blood Cell Count' => 'WBC',
        'Red Blood Cell Count' => 'RBC',
        'Hemoglobin' => 'HGB',
        'Mean Corpuscular Volume' => 'MCV',
        'Mean Corpuscular Hemoglobin' => 'MCH',
        'Platelet Count' => 'PLT',
    ];

    /**
     * @param array<string, float> $parametersByName parameter_name => value_numeric,
     *        as submitted in the lab result (e.g. from the validated request).
     * @return array{predicted_diagnosis: string, confidence: float, class_probabilities: array}|null
     */
    public function predict(array $parametersByName): ?array
    {
        $payload = [];

        foreach (self::PARAMETER_NAME_MAP as $paramName => $modelField) {
            if (!array_key_exists($paramName, $parametersByName)
                || $parametersByName[$paramName] === null) {
                Log::info('CBC ML prediction skipped: missing parameter', [
                    'missing' => $paramName,
                ]);
                return null;
            }

            $payload[$modelField] = (float) $parametersByName[$paramName];
        }

        $baseUrl = config('services.cbc_ml.url');

        if (!$baseUrl) {
            Log::warning('CBC ML prediction skipped: CBC_ML_URL not configured');
            return null;
        }

        try {
            $response = Http::timeout(5)
                ->post(rtrim($baseUrl, '/') . '/predict/cbc', $payload);

            if (!$response->successful()) {
                Log::warning('CBC ML prediction failed: non-2xx response', [
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);
                return null;
            }

            return $response->json();
        } catch (\Throwable $e) {
            // Covers connection refused (service not running), timeout, etc.
            Log::warning('CBC ML prediction failed: request error', [
                'message' => $e->getMessage(),
            ]);
            return null;
        }
    }
}
