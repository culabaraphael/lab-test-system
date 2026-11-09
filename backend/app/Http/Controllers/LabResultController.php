<?php

namespace App\Http\Controllers;

use App\Models\LabResult;
use App\Models\LabResultParameter;
use App\Models\Patient;
use App\Models\ReferenceRange;
use App\Models\TestType;
use App\Services\CbcMlPredictionService;
use App\Services\UrinalysisMlPredictionService;
use App\Services\RecommendationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class LabResultController extends Controller
{
    /**
     * Counter/Nurse only releases results through the QR code. They must not
     * see result values, flags, or AI text, so for that role return only the
     * fields needed for release (minimum necessary data).
     */
    private function counterView(LabResult $result): array
    {
        return [
            'id' => $result->id,
            'status' => $result->status,
            'submitted_at' => $result->submitted_at,
            'approved_at' => $result->approved_at,
            'created_at' => $result->created_at,
            'updated_at' => $result->updated_at,
            'access_token' => $result->access_token,
            'access_token_expires_at' => $result->access_token_expires_at,
            'patient' => $result->patient ? [
                'id' => $result->patient->id,
                'patient_id' => $result->patient->patient_id,
                'first_name' => $result->patient->first_name,
                'middle_name' => $result->patient->middle_name,
                'last_name' => $result->patient->last_name,
            ] : null,
            'test_type' => $result->testType ? [
                'id' => $result->testType->id,
                'name' => $result->testType->name,
            ] : null,
        ];
    }

    private function isCounter(Request $request): bool
    {
        return $request->user() && $request->user()->role === 'COUNTER';
    }

    public function index(Request $request): JsonResponse
    {
        if ($this->isCounter($request)) {
            $results = LabResult::with(['patient', 'testType'])
                ->where('status', 'APPROVED')
                ->orderByDesc('created_at')
                ->get()
                ->map(fn ($r) => $this->counterView($r));

            return response()->json([
                'success' => true,
                'lab_results' => $results,
            ]);
        }

        $results = LabResult::with([
            'patient',
            'testType',
            'parameters',
            'reviewer',
        ])
            ->orderByDesc('created_at')
            ->get();

        return response()->json([
            'success' => true,
            'lab_results' => $results,
        ]);
    }

    public function show(Request $request, LabResult $labResult): JsonResponse
    {
        if ($this->isCounter($request)) {
            $labResult->load(['patient', 'testType']);

            return response()->json([
                'success' => true,
                'lab_result' => $this->counterView($labResult),
            ]);
        }

        $labResult->load([
            'patient',
            'testType',
            'encoder',
            'reviewer',
            'parameters',
        ]);

        return response()->json([
            'success' => true,
            'lab_result' => $labResult,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'patient_id' => [
                'required',
                'integer',
                'exists:patients,id',
            ],

            'test_type_id' => [
                'required',
                'integer',
                'exists:test_types,id',
            ],

            'parameters' => [
                'required',
                'array',
                'min:1',
            ],

            'parameters.*.reference_range_id' => [
                'nullable',
                'integer',
                'exists:reference_ranges,id',
            ],

            'parameters.*.parameter_name' => [
                'nullable',
                'string',
                'max:255',
            ],

            'parameters.*.value_numeric' => [
                'nullable',
                'numeric',
            ],

            'parameters.*.value_text' => [
                'nullable',
                'string',
            ],

            'parameters.*.unit' => [
                'nullable',
                'string',
                'max:100',
            ],
        ]);

        $patient = Patient::findOrFail(
            $validated['patient_id']
        );

        $testType = TestType::findOrFail(
            $validated['test_type_id']
        );

        $labResult = DB::transaction(
            function () use (
                $validated,
                $patient,
                $testType
            ) {
                $result = LabResult::create([
                    'patient_id' => $patient->id,
                    'test_type_id' => $testType->id,

                    // Temporary development value.
                    // Replace with actual authenticated
                    // MedTech user ID after auth middleware
                    // is connected to this endpoint.
                    'encoded_by' => 1,

                    'status' => 'PENDING_REVIEW',
                    'submitted_at' => now(),
                    'reviewed_by' => null,
                    'approved_at' => null,
                    'rejected_at' => null,
                    'rejection_reason' => null,
                    'cancelled_at' => null,
                    'cancellation_reason' => null,
                ]);

                $parametersByName = $this->saveParameters(
                    $result,
                    $validated['parameters']
                );

                if ($testType->code === 'CBC') {
                    $prediction = (new CbcMlPredictionService())
                        ->predict($parametersByName);

                    if ($prediction !== null) {
                        $result->update([
                            'ml_predicted_diagnosis' =>
                                $prediction['predicted_diagnosis'] ?? null,
                            'ml_prediction_confidence' =>
                                $prediction['confidence'] ?? null,
                            'ml_prediction_details' => $prediction,
                        ]);
                    }
                }

                if ($testType->code === 'UA') {
                    $prediction = (new UrinalysisMlPredictionService())
                        ->predict($parametersByName, $patient);

                    if ($prediction !== null) {
                        $result->update([
                            'ml_predicted_diagnosis' =>
                                $prediction['predicted_diagnosis'] ?? null,
                            'ml_prediction_confidence' =>
                                $prediction['confidence'] ?? null,
                            'ml_prediction_details' => $prediction,
                        ]);
                    }
                }

                return $result->load([
                    'patient',
                    'testType',
                    'parameters',
                ]);
            }
        );

        return response()->json([
            'success' => true,
            'message' =>
                'Laboratory result submitted for Doctor review.',
            'lab_result' => $labResult,
        ], 201);
    }

    public function update(
        Request $request,
        LabResult $labResult
    ): JsonResponse {
        if (!in_array(
            $labResult->status,
            ['PENDING_REVIEW', 'REJECTED'],
            true
        )) {
            return response()->json([
                'success' => false,
                'message' =>
                    'Only pending or rejected results can be edited.',
            ], 422);
        }

        $validated = $request->validate([
            'parameters' => [
                'required',
                'array',
                'min:1',
            ],

            'parameters.*.reference_range_id' => [
                'nullable',
                'integer',
                'exists:reference_ranges,id',
            ],

            'parameters.*.parameter_name' => [
                'nullable',
                'string',
                'max:255',
            ],

            'parameters.*.value_numeric' => [
                'nullable',
                'numeric',
            ],

            'parameters.*.value_text' => [
                'nullable',
                'string',
            ],

            'parameters.*.unit' => [
                'nullable',
                'string',
                'max:100',
            ],
        ]);

        DB::transaction(function () use (
            $labResult,
            $validated
        ) {
            $labResult->update([
                'status' => 'PENDING_REVIEW',
                'reviewed_by' => null,
                'submitted_at' => now(),
                'approved_at' => null,
                'rejected_at' => null,
                'rejection_reason' => null,
            ]);

            $labResult->parameters()->delete();

            // Values changed, so any earlier AI recommendation is stale.
            $labResult->aiRecommendation()->delete();

            $this->saveParameters(
                $labResult,
                $validated['parameters']
            );
        });

        $labResult->load([
            'patient',
            'testType',
            'parameters',
        ]);

        return response()->json([
            'success' => true,
            'message' =>
                'Laboratory result updated and resubmitted for Doctor review.',
            'lab_result' => $labResult,
        ]);
    }

    public function cancel(
        Request $request,
        LabResult $labResult
    ): JsonResponse {
        if ($labResult->status !== 'PENDING_REVIEW') {
            return response()->json([
                'success' => false,
                'message' =>
                    'Only pending results can be cancelled.',
            ], 422);
        }

        $validated = $request->validate([
            'cancellation_reason' => [
                'nullable',
                'string',
                'max:500',
            ],
        ]);

        $labResult->update([
            'status' => 'CANCELLED',
            'cancelled_at' => now(),
            'cancellation_reason' =>
                $validated['cancellation_reason'] ?? null,
        ]);

        $labResult->load([
            'patient',
            'testType',
            'parameters',
        ]);

        return response()->json([
            'success' => true,
            'message' =>
                'Laboratory result cancelled successfully.',
            'lab_result' => $labResult,
        ]);
    }

    public function approve(
        Request $request,
        LabResult $labResult
    ): JsonResponse {
        if ($labResult->status !== 'PENDING_REVIEW') {
            return response()->json([
                'success' => false,
                'message' =>
                    'Only pending results can be approved.',
            ], 422);
        }

        $labResult->update([
            'status' => 'APPROVED',
            'reviewed_by' => $request->user()->id,
            'approved_at' => now(),
            'rejected_at' => null,
            'rejection_reason' => null,
        ]);

        // Issue a fresh QR-access token now that this result is
        // patient-visible. Counter/Nurse can regenerate it later if it
        // expires before the patient scans it.
        $this->generateAccessToken($labResult);

        // Figure 3-9 "AI Recommendation Generation Flow": only generate
        // when there's at least one abnormal parameter -- RecommendationService
        // checks this itself and returns null (no-op) when there isn't,
        // so no abnormal-check duplicated here. Best-effort: a failure
        // here (API down, no key configured, etc.) is logged inside the
        // service and never blocks approval.
        // If the Doctor already previewed/edited/hid a recommendation in the
        // review modal, keep that decision and do not regenerate over it.
        if (! $labResult->aiRecommendation()->exists()) {
            app(RecommendationService::class)->generate($labResult);
        }

        $labResult->load([
            'patient',
            'testType',
            'parameters',
            'reviewer',
            'aiRecommendation',
        ]);

        return response()->json([
            'success' => true,
            'message' =>
                'Laboratory result approved successfully.',
            'lab_result' => $labResult,
        ]);
    }

    public function reject(
        Request $request,
        LabResult $labResult
    ): JsonResponse {
        if ($labResult->status !== 'PENDING_REVIEW') {
            return response()->json([
                'success' => false,
                'message' =>
                    'Only pending results can be rejected.',
            ], 422);
        }

        $validated = $request->validate([
            'rejection_reason' => [
                'required',
                'string',
                'max:1000',
            ],
        ]);

        $labResult->update([
            'status' => 'REJECTED',
            'reviewed_by' => $request->user()->id,
            'rejected_at' => now(),
            'rejection_reason' =>
                $validated['rejection_reason'],

            'approved_at' => null,
        ]);

        $labResult->load([
            'patient',
            'testType',
            'parameters',
            'reviewer',
        ]);

        return response()->json([
            'success' => true,
            'message' =>
                'Laboratory result rejected successfully.',
            'lab_result' => $labResult,
        ]);
    }

    /**
     * Generates a new random, unguessable, time-limited access token for
     * a Doctor-approved result. This is what the QR code encodes: the
     * patient scans it and hits the public showByToken() endpoint below,
     * which never exposes the full patients/lab-results tables. Expires
     * 15 minutes after generation (see thesis Ch.3 methodology).
     */
    private function generateAccessToken(LabResult $labResult): void
    {
        $labResult->update([
            'access_token' => Str::random(48),
            'access_token_expires_at' => now()->addMinutes(15),
        ]);
    }

    /**
     * Public, token-scoped result lookup used by the Patient Portal after
     * scanning the QR code shown by the Counter/Nurse. Returns ONLY the
     * single result matching the token, never the full lab_results table,
     * and only while the token is unexpired and the result is APPROVED.
     */
    public function showByToken(string $token): JsonResponse
    {
        $labResult = LabResult::where('access_token', $token)->first();

        if (! $labResult) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid or unrecognized QR code.',
            ], 404);
        }

        if ($labResult->status !== 'APPROVED') {
            return response()->json([
                'success' => false,
                'message' => 'This result is not available for release.',
            ], 403);
        }

        if (
            ! $labResult->access_token_expires_at
            || now()->greaterThan($labResult->access_token_expires_at)
        ) {
            return response()->json([
                'success' => false,
                'message' =>
                    'This QR code has expired. Please ask the '
                    . 'Counter/Nurse to generate a new one.',
            ], 410);
        }

        $labResult->load([
            'patient',
            'testType',
            'parameters',
            'aiRecommendation',
        ]);

        // The Doctor may have hidden the AI text during review.
        if ($labResult->aiRecommendation?->is_hidden) {
            $labResult->setRelation('aiRecommendation', null);
        }

        return response()->json([
            'success' => true,
            'lab_result' => $labResult,
        ]);
    }

    /**
     * Doctor review: return the AI recommendation for a pending result,
     * generating it first if it does not exist yet. Best-effort: if
     * retrieval or the LLM fails, ai_recommendation is null and the
     * modal can retry.
     */
    public function previewRecommendation(
        LabResult $labResult
    ): JsonResponse {
        if ($labResult->status !== 'PENDING_REVIEW') {
            return response()->json([
                'success' => false,
                'message' =>
                    'Only pending results can be previewed.',
            ], 422);
        }

        $recommendation = $labResult->aiRecommendation
            ?? app(RecommendationService::class)->generate($labResult);

        return response()->json([
            'success' => true,
            'ai_recommendation' => $recommendation,
        ]);
    }

    /**
     * Doctor review: edit the AI text and/or hide it from the patient.
     */
    public function updateRecommendation(
        Request $request,
        LabResult $labResult
    ): JsonResponse {
        if ($labResult->status !== 'PENDING_REVIEW') {
            return response()->json([
                'success' => false,
                'message' =>
                    'Only pending results can be edited.',
            ], 422);
        }

        $recommendation = $labResult->aiRecommendation;

        if (! $recommendation) {
            return response()->json([
                'success' => false,
                'message' => 'No AI recommendation exists for this result.',
            ], 404);
        }

        $validated = $request->validate([
            'recommendation_text' => ['sometimes', 'string', 'min:1', 'max:3000'],
            'is_hidden' => ['sometimes', 'boolean'],
        ]);

        if (
            array_key_exists('recommendation_text', $validated)
            && trim($validated['recommendation_text']) !== trim($recommendation->recommendation_text)
        ) {
            $recommendation->recommendation_text = trim($validated['recommendation_text']);
            $recommendation->edited_by_doctor = true;
        }

        if (array_key_exists('is_hidden', $validated)) {
            $recommendation->is_hidden = $validated['is_hidden'];
        }

        $recommendation->save();

        return response()->json([
            'success' => true,
            'ai_recommendation' => $recommendation,
        ]);
    }

    /**
     * Lets the Counter/Nurse re-issue a fresh QR token for an APPROVED
     * result, e.g. once the previous one expired before the patient
     * scanned it, without needing the Doctor to re-approve anything.
     */
    public function regenerateAccessToken(
        LabResult $labResult
    ): JsonResponse {
        if ($labResult->status !== 'APPROVED') {
            return response()->json([
                'success' => false,
                'message' =>
                    'Only approved results can have a QR code generated.',
            ], 422);
        }

        $this->generateAccessToken($labResult);

        return response()->json([
            'success' => true,
            'access_token' => $labResult->access_token,
            'access_token_expires_at' => $labResult->access_token_expires_at,
        ]);
    }

    /**
     * Compares a submitted result value against its configured reference
     * range and returns a flag for the Doctor's review screen.
     *
     * Numeric parameters: LOW / HIGH / NORMAL by comparing value_numeric
     * against reference_low / reference_high.
     * Text parameters: NORMAL / ABNORMAL by comparing value_text against
     * the reference's normal_text (case-insensitive, trimmed).
     * UNASSESSED whenever there isn't enough configured reference data to
     * make a determination -- this is honest: most test types in this
     * system don't have reference ranges configured yet (see
     * ReferenceRangeSeeder), so UNASSESSED there reflects a real gap in
     * configured data, not a bug.
     */
    private function computeFlag(array $item, ?ReferenceRange $reference): string
    {
        if (!$reference) {
            return 'UNASSESSED';
        }

        $valueNumeric = $item['value_numeric'] ?? null;

        if ($valueNumeric !== null
            && $reference->low_value !== null
            && $reference->high_value !== null) {
            if ($valueNumeric < $reference->low_value) {
                return 'LOW';
            }

            if ($valueNumeric > $reference->high_value) {
                return 'HIGH';
            }

            return 'NORMAL';
        }

        $valueText = $item['value_text'] ?? null;

        if ($valueText !== null && $reference->normal_text !== null) {
            $matches = strcasecmp(
                trim($valueText),
                trim($reference->normal_text)
            ) === 0;

            return $matches ? 'NORMAL' : 'ABNORMAL';
        }

        return 'UNASSESSED';
    }

    private function saveParameters(
        LabResult $result,
        array $parameters
    ): array {
        $parametersByName = [];

        foreach ($parameters as $item) {
            $reference = null;

            if (!empty($item['reference_range_id'])) {
                $reference = ReferenceRange::find(
                    $item['reference_range_id']
                );
            }

            $resolvedName = $reference?->parameter_name
                ?? ($item['parameter_name'] ?? 'Unknown');

            $parametersByName[$resolvedName] =
                $item['value_numeric'] ?? $item['value_text'] ?? null;

            LabResultParameter::create([
                'lab_result_id' => $result->id,

                'reference_range_id' =>
                    $reference?->id,

                'parameter_name' =>
                    $reference?->parameter_name
                    ?? ($item['parameter_name'] ?? 'Unknown'),

                'value_numeric' =>
                    $item['value_numeric'] ?? null,

                'value_text' =>
                    $item['value_text'] ?? null,

                'unit' =>
                    $reference?->unit
                    ?? ($item['unit'] ?? null),

                'reference_low' =>
                    $reference?->low_value,

                'reference_high' =>
                    $reference?->high_value,

                'reference_text' =>
                    $reference?->normal_text,

                'flag' => $this->computeFlag($item, $reference),
            ]);
        }

        return $parametersByName;
    }
}