<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('ai_recommendations', function (Blueprint $table) {
            // Doctor review controls: the Doctor can hide the AI text from
            // the patient, or edit it, before approving the result.
            $table->boolean('is_hidden')->default(false)->after('retrieved_entry_keys');
            $table->boolean('edited_by_doctor')->default(false)->after('is_hidden');
        });
    }

    public function down(): void
    {
        Schema::table('ai_recommendations', function (Blueprint $table) {
            $table->dropColumn(['is_hidden', 'edited_by_doctor']);
        });
    }
};
