<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('ai_recommendations', function (Blueprint $table) {
            // Lifestyle tip lines that matched the patient's allergies but that
            // the Doctor chose to show anyway. All other matching lines are
            // hidden from the patient automatically (see App\Support\AllergyFilter).
            $table->json('allergy_kept_lines')->nullable()->after('lifestyle_hidden');
        });
    }

    public function down(): void
    {
        Schema::table('ai_recommendations', function (Blueprint $table) {
            $table->dropColumn('allergy_kept_lines');
        });
    }
};
