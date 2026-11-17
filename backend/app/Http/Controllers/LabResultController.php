<?php

namespace App\Http\Controllers;

use App\Models\LabResult;
use App\Models\LabResultParameter;
use App\Models\Patient;
use App\Models\ReferenceRange;
use App\Support\AllergyFilter;
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

    /** Validation rules for one test's parameters (shared by store and storeBatch). */
    private function parameterRules(string $prefix): array
    {
        return [
            $prefix => ['required', 'array', 'min:1'],
            $prefix . '.*.reference_range_id' => ['nullable', 'integer', 'exists:reference_ranges,id'],
            $prefix . '.*.parameter_name' => ['nullable', 'string', 'max:255'],
            $prefix . '.*.value_numeric' => ['nullable', 'numeric'],
            $prefix . '.*.value_text' => ['nullable', 'string'],
            $prefix . '.*.unit' => ['nullable', 'string', 'max:100'],
        ];
    }

    /**
     * Creates one PENDING_REVIEW result with its parameters, flags and (for
     * CBC / Urinalysis) the supplementary ML suggestion. Called inside a
     * transaction by store() and storeBatch().
     */
    private function createResult(
        Patient $patient,
        TestType $testType,
        array $parameters,
        int $encodedBy,
        ?string $requestGroup = null
    ): LabResult {
        $result = LabResult::create([
            'patient_id' => $patient->id,
            'test_type_id' => $testType->id,
            'encoded_by' => $encodedBy,
            'request_group' => $requestGroup,
            'status' => 'PENDING_REVIEW',
            'submitted_at' => now(),
            'reviewed_by' => null,
            'approved_at' => null,
            'rejected_at' => null,
            'rejection_reason' => null,
            'cancelled_at' => null,
            'cancellation_reason' => null,
        ]);

        $parametersByName = $this->saveParameters($result, $parameters);

        $prediction = null;
        if ($testType->code === 'CBC') {
            $prediction = (new CbcMlPredictionService())->predict($parametersByName);
        } elseif ($testType->code === 'UA') {
            $prediction = (new UrinalysisMlPredictionService())->predict($parametersByName, $patient);
        }

        if ($prediction !== null) {
            $result->update([
                'ml_predicted_diagnosis' => $prediction['predicted_diagnosis'] ?? null,
                'ml_prediction_confidence' => $prediction['confidence'] ?? null,
                'ml_prediction_details' => $prediction,
            ]);
        }

        return $result->load(['patient', 'testType', 'parameters']);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate(array_merge([
            'patient_id' => ['required', 'integer', 'exists:patients,id'],
            'test_type_id' => ['required', 'integer', 'exists:test_types,id'],
        ], $this->parameterRules('parameters')));

        $patient = Patient::findOrFail($validated['patient_id']);
        $testType = TestType::findOrFail($validated['test_type_id']);

        $labResult = DB::transaction(fn () => $this->createResult(
            $patient,
            $testType,
            $validated['parameters'],
            $request->user()->id
        ));

        return response()->json([
            'success' => true,
            'message' =>
                'Laboratory result submitted for Doctor review.',
            'lab_result' => $labResult,
        ], 201);
    }

    /**
     * MedTech encodes several tests of one patient at once. All results are
     * saved together (all or nothing) and share one request_group, so the
     * patient later sees them under one QR code. Each test stays its own
     * result, so the Doctor can approve or reject each one.
     */
    public function storeBatch(Request $request): JsonResponse
    {
        $validated = $request->validate(array_merge([
            'patient_id' => ['required', 'integer', 'exists:patients,id'],
            'tests' => ['required', 'array', 'min:1', 'max:20'],
            'tests.*.test_type_id' => ['required', 'integer', 'distinct', 'exists:test_types,id'],
        ], $this->parameterRules('tests.*.parameters')));

        $patient = Patient::findOrFail($validated['patient_id']);
        $group = count($validated['tests']) > 1 ? (string) Str::uuid() : null;
        $userId = $request->user()->id;

        $results = DB::transaction(function () use ($validated, $patient, $group, $userId) {
            $created = [];
            foreach ($validated['tests'] as $test) {
                $created[] = $this->createResult(
                    $patient,
                    TestType::findOrFail($test['test_type_id']),
                    $test['parameters'],
                    $userId,
                    $group
                );
            }
            return $created;
        });

        $count = count($results);

        return response()->json([
            'success' => true,
            'message' => $count === 1
                ? 'Laboratory result submitted for Doctor review.'
                : $count . ' laboratory results submitted for Doctor review.',
            'request_group' => $group,
            'lab_results' => $results,
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
     * Loads one approved result for the Patient Portal and applies the
     * Doctor's hide choices and the allergy filter (same rules as before).
     */
    private function prepareForPatient(LabResult $labResult): LabResult
    {
        $labResult->load([
            'patient',
            'testType',
            'parameters',
            'aiRecommendation',
            // Names only, for the signature lines of the printed copy.
            'encoder:id,name',
            'reviewer:id,name',
        ]);

        // The Doctor may have hidden the AI text during review.
        if ($labResult->aiRecommendation?->is_hidden) {
            $labResult->setRelation('aiRecommendation', null);
        }

        // The Doctor may have hidden only the lifestyle tips.
        if ($labResult->aiRecommendation?->lifestyle_hidden) {
            $labResult->aiRecommendation->lifestyle = null;
            $labResult->aiRecommendation->lifestyle_ceb = null;
        }

        // Tips that mention a food matching the patient's allergies are hidden
        // automatically, unless the Doctor chose to show them. The Bisaya tips
        // are only used when they were translated from the same visible lines.
        if ($rec = $labResult->aiRecommendation) {
            if ($rec->lifestyle) {
                $visible = AllergyFilter::visible(
                    $rec->lifestyle,
                    $labResult->patient?->allergies,
                    $rec->allergy_kept_lines
                );

                if ($visible !== $rec->lifestyle) {
                    $rec->lifestyle = $visible;

                    if (! AllergyFilter::sameShape($rec->lifestyle_ceb, $visible)) {
                        $rec->lifestyle_ceb = null;
                    }
                }
            }

            $rec->makeHidden('allergy_kept_lines');
        }

        return $labResult;
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

        $this->prepareForPatient($labResult);

        // Tests encoded together (same request_group) are shown under the same
        // QR code, but only those the Doctor has approved.
        $group = collect([$labResult]);
        if ($labResult->request_group) {
            $others = LabResult::where('request_group', $labResult->request_group)
                ->where('patient_id', $labResult->patient_id)
                ->where('status', 'APPROVED')
                ->where('id', '!=', $labResult->id)
                ->orderBy('id')
                ->get()
                ->each(fn ($r) => $this->prepareForPatient($r));
            $group = $group->concat($others);
        }

        return response()->json([
            'success' => true,
            'lab_result' => $labResult,
            'lab_results' => $group->values(),
        ]);
    }

    /**
     * Patient Portal: Bisaya (Cebuano) version of the doctor-approved English
     * health information, requested by the patient. Same token checks as
     * showByToken. The translation is made once, saved, and reused. It is
     * machine-translated and NOT reviewed by the Doctor, so the portal labels it.
     */
    public function translateByToken(Request $request, string $token): JsonResponse
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
                'message' => 'This QR code has expired. Please ask the '
                    . 'Counter/Nurse to generate a new one.',
            ], 410);
        }

        // Another approved test of the same request (shown under the same QR).
        if ($request->filled('result') && (int) $request->query('result') !== $labResult->id) {
            $sibling = $labResult->request_group
                ? LabResult::where('id', (int) $request->query('result'))
                    ->where('request_group', $labResult->request_group)
                    ->where('patient_id', $labResult->patient_id)
                    ->where('status', 'APPROVED')
                    ->first()
                : null;

            if (! $sibling) {
                return response()->json([
                    'success' => false,
                    'message' => 'No health information is available for this result.',
                ], 404);
            }

            $labResult = $sibling;
        }

        $recommendation = $labResult->aiRecommendation;

        if (! $recommendation || $recommendation->is_hidden) {
            return response()->json([
                'success' => false,
                'message' => 'No health information is available for this result.',
            ], 404);
        }

        // Translate only the tips the patient will see (allergy-matching tips
        // are hidden automatically unless the Doctor kept them).
        $life = $recommendation->lifestyle_hidden
            ? null
            : AllergyFilter::visible(
                $recommendation->lifestyle,
                $labResult->patient?->allergies,
                $recommendation->allergy_kept_lines
            );

        $needsTranslation = ! $recommendation->recommendation_text_ceb
            || ($life && ! AllergyFilter::sameShape($recommendation->lifestyle_ceb, $life));

        if ($needsTranslation) {
            @set_time_limit(180);

            $bundle = app(RecommendationService::class)
                ->translateBundleToBisaya($recommendation->recommendation_text, $life);

            if ($bundle === null) {
                return response()->json([
                    'success' => false,
                    'message' => 'The Bisaya translation is unavailable right now. Please try again.',
                ], 503);
            }

            $recommendation->recommendation_text_ceb = $bundle['text'];
            $recommendation->lifestyle_ceb = $bundle['lifestyle'];
            $recommendation->save();
        }

        return response()->json([
            'success' => true,
            'recommendation_text_ceb' => $recommendation->recommendation_text_ceb,
            'lifestyle_ceb' => $recommendation->lifestyle_hidden ? null : $recommendation->lifestyle_ceb,
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

        // Older recommendations were saved before lifestyle tips existed:
        // fill them in from the KB entries they were grounded on.
        if (
            $recommendation
            && $recommendation->lifestyle === null
            && ! empty($recommendation->retrieved_entry_keys)
        ) {
            $life = app(RecommendationService::class)
                ->lifestyleForKeys($recommendation->retrieved_entry_keys);

            if ($life !== null) {
                $recommendation->lifestyle = $life;
                $recommendation->save();
            }
        }

        return response()->json([
            'success' => true,
            'ai_recommendation' => $this->withAllergyInfo($recommendation, $labResult),
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
            'lifestyle_hidden' => ['sometimes', 'boolean'],
            'lifestyle' => ['sometimes', 'array'],
            'lifestyle.food' => ['sometimes', 'array', 'max:8'],
            'lifestyle.routine' => ['sometimes', 'array', 'max:8'],
            'lifestyle.avoid' => ['sometimes', 'array', 'max:8'],
            'lifestyle.notes' => ['sometimes', 'array', 'max:5'],
            'lifestyle.*.*' => ['nullable', 'string', 'max:400'],
            'recommendation_text_ceb' => ['sometimes', 'nullable', 'string', 'max:3000'],
            'lifestyle_ceb' => ['sometimes', 'array'],
            'lifestyle_ceb.food' => ['sometimes', 'array', 'max:8'],
            'lifestyle_ceb.routine' => ['sometimes', 'array', 'max:8'],
            'lifestyle_ceb.avoid' => ['sometimes', 'array', 'max:8'],
            'lifestyle_ceb.notes' => ['sometimes', 'array', 'max:5'],
            'lifestyle_ceb.*.*' => ['nullable', 'string', 'max:400'],
            'allergy_kept_lines' => ['sometimes', 'array', 'max:40'],
            'allergy_kept_lines.*' => ['string', 'max:400'],
        ]);

        if (
            array_key_exists('recommendation_text', $validated)
            && trim($validated['recommendation_text']) !== trim($recommendation->recommendation_text)
        ) {
            $recommendation->recommendation_text = trim($validated['recommendation_text']);
            $recommendation->edited_by_doctor = true;

            // The English text changed, so older Bisaya text is out of date.
            // It is kept only when the same request also sends Bisaya edits.
            if (! array_key_exists('recommendation_text_ceb', $validated)) {
                $recommendation->recommendation_text_ceb = null;
            }

            if (! array_key_exists('lifestyle_ceb', $validated)) {
                $recommendation->lifestyle_ceb = null;
            }
        }

        if (array_key_exists('recommendation_text_ceb', $validated)) {
            $ceb = trim((string) $validated['recommendation_text_ceb']);
            $recommendation->recommendation_text_ceb = $ceb === '' ? null : $ceb;
        }

        if (array_key_exists('is_hidden', $validated)) {
            $recommendation->is_hidden = $validated['is_hidden'];
        }

        if (array_key_exists('lifestyle_hidden', $validated)) {
            $recommendation->lifestyle_hidden = $validated['lifestyle_hidden'];
        }

        // Doctor edited the lifestyle tips. Sources stay as retrieved from the KB.
        if (
            array_key_exists('lifestyle', $validated)
            && is_array($recommendation->lifestyle)
        ) {
            $current = $recommendation->lifestyle;
            $clean = [];

            foreach (['food', 'routine', 'avoid', 'notes'] as $field) {
                $clean[$field] = array_values(array_filter(
                    array_map(
                        fn ($line) => trim((string) $line),
                        $validated['lifestyle'][$field] ?? []
                    ),
                    fn ($line) => $line !== ''
                ));
            }

            $changed = false;

            foreach ($clean as $field => $lines) {
                if (($current[$field] ?? []) !== $lines) {
                    $changed = true;
                }
            }

            if ($changed) {
                $recommendation->lifestyle = array_merge(
                    $clean,
                    ['sources' => $current['sources'] ?? []]
                );
                if (! array_key_exists('lifestyle_ceb', $validated)) {
                    $recommendation->lifestyle_ceb = null;
                }

                $recommendation->edited_by_doctor = true;
            }
        }

        // Doctor edited the Bisaya tips. All lines empty = no Bisaya tips (falls back to English).
        if (
            array_key_exists('lifestyle_ceb', $validated)
            && is_array($recommendation->lifestyle)
        ) {
            $cleanCeb = [];

            foreach (['food', 'routine', 'avoid', 'notes'] as $field) {
                $cleanCeb[$field] = array_values(array_filter(
                    array_map(
                        fn ($line) => trim((string) $line),
                        $validated['lifestyle_ceb'][$field] ?? []
                    ),
                    fn ($line) => $line !== ''
                ));
            }

            $isEmpty = collect($cleanCeb)->flatten()->isEmpty();
            $recommendation->lifestyle_ceb = $isEmpty ? null : $cleanCeb;
        }

        // Doctor chose to show (or hide again) a tip that matched an allergy.
        // The visible tips change, so the Bisaya tips are translated again.
        if (array_key_exists('allergy_kept_lines', $validated)) {
            $recommendation->allergy_kept_lines = array_values(array_unique(
                $validated['allergy_kept_lines']
            ));
            $recommendation->lifestyle_ceb = null;
        }

        $recommendation->save();

        return response()->json([
            'success' => true,
            'ai_recommendation' => $this->withAllergyInfo($recommendation, $labResult),
        ]);
    }

    /**
     * Doctor review: Bisaya preview of the saved English text. The translation is
     * stored and reused (the patient portal shows the same one). Editing the
     * English text clears it, so it always matches the English version.
     */
    public function translateRecommendation(
        LabResult $labResult
    ): JsonResponse {
        if ($labResult->status !== 'PENDING_REVIEW') {
            return response()->json([
                'success' => false,
                'message' => 'Only pending results can be translated.',
            ], 422);
        }

        $recommendation = $labResult->aiRecommendation;

        if (! $recommendation) {
            return response()->json([
                'success' => false,
                'message' => 'No AI recommendation exists for this result.',
            ], 404);
        }

        // Translate only the tips the patient will see (allergy-matching tips
        // are hidden automatically unless the Doctor kept them).
        $life = $recommendation->lifestyle_hidden
            ? null
            : AllergyFilter::visible(
                $recommendation->lifestyle,
                $labResult->patient?->allergies,
                $recommendation->allergy_kept_lines
            );

        $needsTranslation = ! $recommendation->recommendation_text_ceb
            || ($life && ! AllergyFilter::sameShape($recommendation->lifestyle_ceb, $life));

        if ($needsTranslation) {
            @set_time_limit(180);

            $bundle = app(RecommendationService::class)
                ->translateBundleToBisaya($recommendation->recommendation_text, $life);

            if ($bundle === null) {
                return response()->json([
                    'success' => false,
                    'message' => 'The Bisaya translation is unavailable right now. Please try again.',
                ], 503);
            }

            $recommendation->recommendation_text_ceb = $bundle['text'];
            $recommendation->lifestyle_ceb = $bundle['lifestyle'];
            $recommendation->save();
        }

        return response()->json([
            'success' => true,
            'ai_recommendation' => $this->withAllergyInfo($recommendation, $labResult),
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
    /**
     * Recommendation for the Doctor's review screen, plus the tip lines that are
     * hidden from the patient because they match the patient's allergies.
     */
    private function withAllergyInfo($recommendation, LabResult $labResult): ?array
    {
        if (! $recommendation) {
            return null;
        }

        return array_merge($recommendation->toArray(), [
            'allergy_hidden_lines' => $recommendation->lifestyle_hidden
                ? []
                : AllergyFilter::hiddenLines(
                    $recommendation->lifestyle,
                    $labResult->patient?->allergies,
                    $recommendation->allergy_kept_lines
                ),
        ]);
    }

    private function oneSidedReferenceText(?ReferenceRange $reference): ?string
    {
        if (! $reference) {
            return null;
        }

        $low = $reference->low_value;
        $high = $reference->high_value;

        if ($low === null && $high !== null) {
            // computeFlag() treats a value equal to the high bound as NORMAL,
            // so show it as "up to" (<=) to match the flag.
            return '<= ' . (string) (float) $high;
        }

        if ($low !== null && $high === null) {
            return '>= ' . (string) (float) $low;
        }

        return null;
    }

    /**
     * Lowercases a text result and keeps only letters and digits, so that
     * spelling variants of the same word compare as equal.
     */
    private function normalizeResultText(string $text): string
    {
        return preg_replace('/[^a-z0-9]/', '', strtolower($text));
    }

    private function computeFlag(array $item, ?ReferenceRange $reference): string
    {
        if (!$reference) {
            return 'UNASSESSED';
        }

        $valueNumeric = $item['value_numeric'] ?? null;

        // A range may have only one bound (e.g. Total Cholesterol is "< 200"
        // with no lower limit). Check whichever bound exists.
        if ($valueNumeric !== null
            && ($reference->low_value !== null
                || $reference->high_value !== null)) {
            if ($reference->low_value !== null
                && $valueNumeric < $reference->low_value) {
                return 'LOW';
            }

            if ($reference->high_value !== null
                && $valueNumeric > $reference->high_value) {
                return 'HIGH';
            }

            return 'NORMAL';
        }

        $valueText = $item['value_text'] ?? null;

        if ($valueText !== null && $reference->normal_text !== null) {
            // Compare letters and digits only, ignoring case, spaces,
            // hyphens and other punctuation, so "Nonreactive",
            // "non reactive" and "Non-Reactive" all match "Non-Reactive".
            $matches = $this->normalizeResultText($valueText)
                === $this->normalizeResultText($reference->normal_text);

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

                // Text tests keep their normal text; a one-sided numeric range
                // is shown as "< 200" or "> 5" instead of a bare number.
                'reference_text' =>
                    $reference?->normal_text
                    ?? $this->oneSidedReferenceText($reference),

                'flag' => $this->computeFlag($item, $reference),
            ]);
        }

        return $parametersByName;
    }
}
