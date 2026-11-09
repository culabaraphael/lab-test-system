<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('lab_results', 'ml_predicted_diagnosis')) {
            return;
        }

        Schema::table('lab_results', function (Blueprint $table) {
            // Filled in automatically when a CBC result is submitted and
            // the ML microservice (backend/ml/api.py) responds successfully.
            // Stays NULL for test types with no trained model yet (e.g.
            // Urinalysis, until that model exists), or if the ML service
            // was unreachable at submission time -- this is best-effort,
            // never blocks a MedTech from submitting a result.
            $table->string('ml_predicted_diagnosis')
                ->nullable()
                ->after('rejection_reason');

            $table->float('ml_prediction_confidence')
                ->nullable()
                ->after('ml_predicted_diagnosis');

            $table->json('ml_prediction_details')
                ->nullable()
                ->after('ml_prediction_confidence');
        });
    }

    public function down(): void
    {
        Schema::table('lab_results', function (Blueprint $table) {
            $table->dropColumn([
                'ml_predicted_diagnosis',
                'ml_prediction_confidence',
                'ml_prediction_details',
            ]);
        });
    }
};
