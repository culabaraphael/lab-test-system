<?php

namespace App\Services;

use App\Models\Patient;
use Carbon\Carbon;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Calls the Urinalysis ML microservice (backend/ml/urinalysis_api.py, a
 * FastAPI app running separately on port 8002) to get a predicted UTI
 * diagnosis (NEGATIVE / POSITIVE) for a set of urinalysis values.
 *
 * IMPORTANT LIMITATION (also documented in urinalysis_api.py and the
 * thesis writeup): the training data was severely imbalanced (94.4%
 * Negative vs 5.6% Positive). Even with SMOTE, the model only catches
 * ~44% of true Positive cases. This is a supplementary signal for the
 * Doctor, not a diagnostic replacement -- same spirit as the CBC service.
 *
 * Best-effort: if the ML service is down, slow, or a required field is
 * missing, we log it and return null rather than blocking submission.
 */
class UrinalysisMlPredictionService
{
    /**
     * Maps this app's parameter_name strings (from ReferenceRangeSeeder,
     * 'UA' block) to the field names the trained model expects.
     * 'Appearance' is this app's existing field name for what the
     * training dataset called 'Transparency' -- same clinical concept
     * (urine clarity: clear / hazy / cloudy / turbid), different label.
     */
    private const PARAMETER_NAME_MAP = [
        'Color' => 'Color',
        'Appearance' => 'Transparency',
        'Specific Gravity' => 'Specific Gravity',
        'pH' => 'pH',
        'Protein' => 'Protein',
        'Glucose' => 'Glucose',
        'White Blood Cells' => 'WBC',
        'Red Blood Cells' => 'RBC',
        'Epithelial Cells' => 'Epithelial Cells',
        'Mucous Threads' => 'Mucous Threads',
        'Amorphous Urates' => 'Amorphous Urates',
        'Bacteria' => 'Bacteria',
    ];

    /**
     * @param array<string, mixed> $parametersByName parameter_name => value,
     *        as submitted in the lab result (numeric or text).
     * @param Patient $patient used for Age (from date_of_birth) and Gender (from sex)
     * @return array{predicted_diagnosis: string, confidence: float, class_probabilities: array}|null
     */
    public function predict(array $parametersByName, Patient $patient): ?array
    {
        $payload = [];

        foreach (self::PARAMETER_NAME_MAP as $paramName => $modelField) {
            if (!array_key_exists($paramName, $parametersByName)
                || $parametersByName[$paramName] === null
                || $parametersByName[$paramName] === '') {
                Log::info('Urinalysis ML prediction skipped: missing parameter', [
                    'missing' => $paramName,
                ]);
                return null;
            }

            $payload[$modelField] = $parametersByName[$paramName];
        }

        if (!$patient->date_of_birth || !$patient->sex) {
            Log::info('Urinalysis ML prediction skipped: patient missing date_of_birth or sex');
            return null;
        }

        // Matches the training dataset's own convention: age in years,
        // with infants under 1 year expressed as a fraction (e.g. an
        // 8-month-old is 0.08), per the dataset's documented preprocessing.
        $ageInYears = Carbon::parse($patient->date_of_birth)->diffInYears(now());
        if ($ageInYears < 1) {
            $ageInMonths = Carbon::parse($patient->date_of_birth)->diffInMonths(now());
            $payload['Age'] = round($ageInMonths / 100, 2);
        } else {
            $payload['Age'] = (float) $ageInYears;
        }

        $payload['Gender'] = strtoupper($patient->sex);

        $baseUrl = config('services.urinalysis_ml.url');

        if (!$baseUrl) {
            Log::warning('Urinalysis ML prediction skipped: URINALYSIS_ML_URL not configured');
            return null;
        }

        try {
            $response = Http::timeout(5)
                ->post(rtrim($baseUrl, '/') . '/predict/urinalysis', $payload);

            if (!$response->successful()) {
                Log::warning('Urinalysis ML prediction failed: non-2xx response', [
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);
                return null;
            }

            return $response->json();
        } catch (\Throwable $e) {
            Log::warning('Urinalysis ML prediction failed: request error', [
                'message' => $e->getMessage(),
            ]);
            return null;
        }
    }
}
