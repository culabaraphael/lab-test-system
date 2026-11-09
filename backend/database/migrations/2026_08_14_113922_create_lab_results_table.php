<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Skip if columns already exist (e.g. an older database)
        if (Schema::hasColumn('lab_results', 'patient_id')) {
            return;
        }

        Schema::table('lab_results', function (Blueprint $table) {
            $table->foreignId('patient_id')
                ->after('id')
                ->constrained('patients')
                ->cascadeOnDelete();

            $table->foreignId('test_type_id')
                ->after('patient_id')
                ->constrained('test_types')
                ->restrictOnDelete();

            $table->foreignId('encoded_by')
                ->after('test_type_id')
                ->constrained('users')
                ->restrictOnDelete();

            $table->foreignId('reviewed_by')
                ->nullable()
                ->after('encoded_by')
                ->constrained('users')
                ->nullOnDelete();

            $table->enum('status', [
                'PENDING_REVIEW',
                'APPROVED',
                'REJECTED',
            ])
                ->default('PENDING_REVIEW')
                ->after('reviewed_by');

            $table->timestamp('submitted_at')
                ->nullable()
                ->after('status');

            $table->timestamp('approved_at')
                ->nullable()
                ->after('submitted_at');

            $table->timestamp('rejected_at')
                ->nullable()
                ->after('approved_at');

            $table->text('rejection_reason')
                ->nullable()
                ->after('rejected_at');

            $table->index([
                'patient_id',
                'status',
            ]);
        });
    }

    public function down(): void
    {
        Schema::table('lab_results', function (Blueprint $table) {
            $table->dropForeign(['patient_id']);
            $table->dropForeign(['test_type_id']);
            $table->dropForeign(['encoded_by']);
            $table->dropForeign(['reviewed_by']);

            $table->dropIndex([
                'patient_id',
                'status',
            ]);

            $table->dropColumn([
                'patient_id',
                'test_type_id',
                'encoded_by',
                'reviewed_by',
                'status',
                'submitted_at',
                'approved_at',
                'rejected_at',
                'rejection_reason',
            ]);
        });
    }
};