<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('lab_result_parameters', 'lab_result_id')) {
            return;
        }

        Schema::table('lab_result_parameters', function (Blueprint $table) {
            $table->foreignId('lab_result_id')
                ->after('id')
                ->constrained('lab_results')
                ->cascadeOnDelete();

            $table->foreignId('reference_range_id')
                ->nullable()
                ->after('lab_result_id')
                ->constrained('reference_ranges')
                ->nullOnDelete();

            $table->string('parameter_name')
                ->after('reference_range_id');

            $table->decimal('value_numeric', 12, 4)
                ->nullable()
                ->after('parameter_name');

            $table->text('value_text')
                ->nullable()
                ->after('value_numeric');

            $table->string('unit')
                ->nullable()
                ->after('value_text');

            $table->decimal('reference_low', 12, 4)
                ->nullable()
                ->after('unit');

            $table->decimal('reference_high', 12, 4)
                ->nullable()
                ->after('reference_low');

            $table->string('reference_text')
                ->nullable()
                ->after('reference_high');

            $table->string('flag')
                ->default('UNASSESSED')
                ->after('reference_text');
        });
    }

    public function down(): void
    {
        Schema::table('lab_result_parameters', function (Blueprint $table) {
            $table->dropForeign(['lab_result_id']);
            $table->dropForeign(['reference_range_id']);

            $table->dropColumn([
                'lab_result_id',
                'reference_range_id',
                'parameter_name',
                'value_numeric',
                'value_text',
                'unit',
                'reference_low',
                'reference_high',
                'reference_text',
                'flag',
            ]);
        });
    }
};