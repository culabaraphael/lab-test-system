<?php

namespace App\Http\Controllers;

use App\Models\TestType;
use Illuminate\Http\JsonResponse;

class TestTypeController extends Controller
{
    public function index(): JsonResponse
    {
        $testTypes = TestType::where('is_active', true)
            ->orderBy('name')
            ->get();

        return response()->json([
            'success' => true,
            'test_types' => $testTypes,
        ]);
    }

    public function show(TestType $testType): JsonResponse
    {
        return response()->json([
            'success' => true,
            'test_type' => $testType,
        ]);
    }
}