<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('ai_recommendations', function (Blueprint $table) {
            // Optional Bisaya (Cebuano) version of the doctor-approved English text.
            // Generated on the Doctor's request and editable by the Doctor.
            $table->text('recommendation_text_ceb')->nullable()->after('recommendation_text');
        });
    }

    public function down(): void
    {
        Schema::table('ai_recommendations', function (Blueprint $table) {
            $table->dropColumn('recommendation_text_ceb');
        });
    }
};
