<?php

namespace App\Http\Controllers;

use App\Models\Patient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PatientController extends Controller
{
    /**
     * Get all patients.
     */
    public function index(): JsonResponse
    {
        $patients = Patient::orderBy('created_at', 'desc')->get();

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
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Patient registered successfully.',
            'patient' => $patient,
        ], 201);
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