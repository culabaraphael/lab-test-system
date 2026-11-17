<?php

namespace App\Http\Controllers;

use App\Models\Patient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PatientController extends Controller
{
    /**
     * Get all patients.
     *
     * The MedTech sees only patients the Counter/Nurse has sent, newest
     * sent first, so a newly sent patient appears at the top of the list.
     * Other staff roles see every patient, newest registered first.
     */
    public function index(Request $request): JsonResponse
    {
        if ($request->user() && $request->user()->role === 'Medical Technologist') {
            $patients = Patient::whereNotNull('sent_to_medtech_at')
                ->orderBy('sent_to_medtech_at', 'desc')
                ->orderBy('created_at', 'desc')
                ->get();
        } else {
            $patients = Patient::orderBy('created_at', 'desc')->get();
        }

        return response()->json([
            'success' => true,
            'patients' => $patients,
        ]);
    }

    /**
     * Create a patient.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'first_name' => ['required', 'string', 'max:100'],
            'middle_name' => ['nullable', 'string', 'max:100'],
            'last_name' => ['required', 'string', 'max:100'],
            'date_of_birth' => ['nullable', 'date'],
            'sex' => ['nullable', 'in:Male,Female'],
            'contact_number' => ['nullable', 'string', 'max:30'],
            'address' => ['nullable', 'string', 'max:500'],
            'allergies' => ['nullable', 'string', 'max:500'],
        ]);

        $patient = Patient::create([
            'patient_id' => $this->generatePatientId(),
            'first_name' => trim($validated['first_name']),
            'middle_name' => !empty($validated['middle_name'])
                ? trim($validated['middle_name'])
                : null,
            'last_name' => trim($validated['last_name']),
            'date_of_birth' => $validated['date_of_birth'] ?? null,
            'sex' => $validated['sex'] ?? null,
            'contact_number' => !empty($validated['contact_number'])
                ? trim($validated['contact_number'])
                : null,
            'address' => !empty($validated['address'])
                ? trim($validated['address'])
                : null,
            'allergies' => !empty($validated['allergies'])
                ? trim($validated['allergies'])
                : null,
            'registered_by' => $request->user()?->id,
            // Not sent yet: the Counter/Nurse sends the patient to the
            // MedTech with sendToMedtech() right after registering.
            'sent_to_medtech_at' => null,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Patient registered successfully.',
            'patient' => $patient->fresh(),
        ], 201);
    }

    /**
     * Counter/Nurse sends a registered patient to the MedTech.
     * The patient then appears in the MedTech's Patients list with "NEW".
     */
    public function sendToMedtech(Patient $patient): JsonResponse
    {
        if ($patient->sent_to_medtech_at !== null) {
            return response()->json([
                'success' => true,
                'message' => 'Patient ' . $patient->patient_id . ' was already sent to the MedTech.',
                'patient' => $patient,
            ]);
        }

        $patient->update(['sent_to_medtech_at' => now()]);

        return response()->json([
            'success' => true,
            'message' => 'Patient ' . $patient->patient_id . ' sent to the MedTech.',
            'patient' => $patient->fresh(),
        ]);
    }

    /**
     * Update a patient.
     */
    public function update(
        Request $request,
        Patient $patient
    ): JsonResponse {
        $validated = $request->validate([
            'first_name' => ['required', 'string', 'max:100'],
            'middle_name' => ['nullable', 'string', 'max:100'],
            'last_name' => ['required', 'string', 'max:100'],
            'date_of_birth' => ['nullable', 'date'],
            'sex' => ['nullable', 'in:Male,Female'],
            'contact_number' => ['nullable', 'string', 'max:30'],
            'address' => ['nullable', 'string', 'max:500'],
            'allergies' => ['nullable', 'string', 'max:500'],
        ]);

        $patient->update([
            'first_name' => trim($validated['first_name']),
            'middle_name' => !empty($validated['middle_name'])
                ? trim($validated['middle_name'])
                : null,
            'last_name' => trim($validated['last_name']),
            'date_of_birth' => $validated['date_of_birth'] ?? null,
            'sex' => $validated['sex'] ?? null,
            'contact_number' => !empty($validated['contact_number'])
                ? trim($validated['contact_number'])
                : null,
            'address' => !empty($validated['address'])
                ? trim($validated['address'])
                : null,
            'allergies' => !empty($validated['allergies'])
                ? trim($validated['allergies'])
                : null,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Patient updated successfully.',
            'patient' => $patient->fresh(),
        ]);
    }

    /**
     * Delete a patient.
     */
    public function destroy(Patient $patient): JsonResponse
    {
        $patientId = $patient->patient_id;

        $patient->delete();

        return response()->json([
            'success' => true,
            'message' => 'Patient ' . $patientId . ' deleted successfully.',
        ]);
    }

    /**
     * Generate the next patient ID.
     */
    private function generatePatientId(): string
    {
        $lastPatient = Patient::orderBy('id', 'desc')->first();

        if (!$lastPatient) {
            return 'P-000001';
        }

        $lastNumber = (int) str_replace(
            'P-',
            '',
            $lastPatient->patient_id
        );

        return 'P-' . str_pad(
            $lastNumber + 1,
            6,
            '0',
            STR_PAD_LEFT
        );
    }
}