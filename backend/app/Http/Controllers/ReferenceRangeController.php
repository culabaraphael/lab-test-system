<?php

namespace App\Http\Controllers;

use App\Models\ReferenceRange;
use App\Models\TestType;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ReferenceRangeController extends Controller
{
    /**
     * Returns one reference range row per parameter_name for this test
     * type, to build the Encode Results form.
     *
     * Some parameters (e.g. CBC's Hemoglobin, Hematocrit, RBC) have
     * separate Male / Female rows with the same parameter_name. This
     * picks the row matching the given ?sex= query param when present,
     * falls back to the 'Any' row, and otherwise just takes whichever
     * row comes first -- so the form always shows exactly one field per
     * parameter, never duplicates.
     */
    public function index(TestType $testType, Request $request): JsonResponse
    {
        $requestedSex = $request->query('sex');

        $allRanges = ReferenceRange::where('test_type_id', $testType->id)
            ->where('is_active', true)
            ->orderBy('id')
            ->get();

        $ranges = $allRanges
            ->groupBy('parameter_name')
            ->map(function ($group) use ($requestedSex) {
                if ($requestedSex) {
                    $match = $group->firstWhere('sex', $requestedSex);
                    if ($match) {
                        return $match;
                    }
                }

                return $group->firstWhere('sex', 'Any') ?? $group->first();
            })
            ->values();

        return response()->json([
            'success' => true,
            'test_type' => $testType,
            'parameters' => $ranges,
        ]);
    }
}