<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Creates the base lab_results and lab_result_parameters tables.
     * The later migrations only add columns to them, so these must exist first.
     */
    public function up(): void
    {
        if (! Schema::hasTable('lab_results')) {
            Schema::create('lab_results', function (Blueprint $table) {
                $table->id();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('lab_result_parameters')) {
            Schema::create('lab_result_parameters', function (Blueprint $table) {
                $table->id();
                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('lab_result_parameters');
        Schema::dropIfExists('lab_results');
    }
};
