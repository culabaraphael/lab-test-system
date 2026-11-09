<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('reference_ranges', function (Blueprint $table) {
            $table->id();

            $table->foreignId('test_type_id')
                ->constrained('test_types')
                ->cascadeOnDelete();

            $table->string('parameter_name');

            $table->enum('data_type', [
                'numeric',
                'text',
            ])->default('numeric');

            $table->string('unit')->nullable();

            $table->decimal('low_value', 12, 4)->nullable();
            $table->decimal('high_value', 12, 4)->nullable();

            $table->string('normal_text')->nullable();

            $table->enum('sex', [
                'Male',
                'Female',
                'Any',
            ])->default('Any');

            $table->unsignedInteger('min_age')->nullable();
            $table->unsignedInteger('max_age')->nullable();

            $table->boolean('is_active')->default(true);

            $table->timestamps();

            $table->index([
                'test_type_id',
                'parameter_name',
                'sex',
            ]);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('reference_ranges');
    }
};