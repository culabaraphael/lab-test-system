<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        /*
         * Laravel's PostgreSQL enum is implemented as a varchar
         * with a CHECK constraint. Remove the old constraint first.
         */
        DB::statement("
            ALTER TABLE lab_results
            DROP CONSTRAINT IF EXISTS lab_results_status_check
        ");

        DB::statement("
            ALTER TABLE lab_results
            ADD CONSTRAINT lab_results_status_check
            CHECK (
                status IN (
                    'PENDING_REVIEW',
                    'APPROVED',
                    'REJECTED',
                    'CANCELLED'
                )
            )
        ");

        Schema::table('lab_results', function (Blueprint $table) {
            $table->timestamp('cancelled_at')
                ->nullable()
                ->after('rejected_at');

            $table->text('cancellation_reason')
                ->nullable()
                ->after('rejection_reason');
        });
    }

    public function down(): void
    {
        DB::statement("
            UPDATE lab_results
            SET status = 'REJECTED'
            WHERE status = 'CANCELLED'
        ");

        DB::statement("
            ALTER TABLE lab_results
            DROP CONSTRAINT IF EXISTS lab_results_status_check
        ");

        DB::statement("
            ALTER TABLE lab_results
            ADD CONSTRAINT lab_results_status_check
            CHECK (
                status IN (
                    'PENDING_REVIEW',
                    'APPROVED',
                    'REJECTED'
                )
            )
        ");

        Schema::table('lab_results', function (Blueprint $table) {
            $table->dropColumn([
                'cancelled_at',
                'cancellation_reason',
            ]);
        });
    }
};