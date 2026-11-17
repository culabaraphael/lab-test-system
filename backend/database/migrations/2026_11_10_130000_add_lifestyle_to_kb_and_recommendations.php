<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('knowledge_base_entries', function (Blueprint $table) {
            // {food:[], routine:[], avoid:[], notes:[], sources:[{title,url}]}
            // Text taken from the cited sources; the AI does not write it.
            $table->json('lifestyle')->nullable();
        });

        Schema::table('ai_recommendations', function (Blueprint $table) {
            // Snapshot of the lifestyle tips from the retrieved KB entries.
            $table->json('lifestyle')->nullable();
            // Bisaya translation of the same tips (same shape, sources omitted).
            $table->json('lifestyle_ceb')->nullable();
            // Doctor can hide the lifestyle tips without hiding the explanation.
            $table->boolean('lifestyle_hidden')->default(false);
        });
    }

    public function down(): void
    {
        Schema::table('ai_recommendations', function (Blueprint $table) {
            $table->dropColumn(['lifestyle', 'lifestyle_ceb', 'lifestyle_hidden']);
        });

        Schema::table('knowledge_base_entries', function (Blueprint $table) {
            $table->dropColumn('lifestyle');
        });
    }
};
