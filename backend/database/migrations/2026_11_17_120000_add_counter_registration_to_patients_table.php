<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Counter/Nurse registers the patient and sends the patient to the MedTech.
 *
 * - registered_by: the staff account that registered the patient.
 * - sent_to_medtech_at: when the Counter/Nurse sent the patient to the
 *   MedTech. NULL means registered but not sent yet, so the MedTech does
 *   not see the patient. The MedTech's Patients list shows "NEW" for
 *   15 minutes after this time.
 *
 * Existing patients (registered before this change, by the MedTech) are
 * marked as already sent, using their created_at, so they stay visible to
 * the MedTech and do not show as NEW.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('patients', function (Blueprint $table) {
            $table->foreignId('registered_by')->nullable()->after('allergies')
                ->constrained('users')->nullOnDelete();
            $table->timestamp('sent_to_medtech_at')->nullable()->after('registered_by');
        });

        DB::table('patients')
            ->whereNull('sent_to_medtech_at')
            ->update(['sent_to_medtech_at' => DB::raw('created_at')]);
    }

    public function down(): void
    {
        Schema::table('patients', function (Blueprint $table) {
            $table->dropConstrainedForeignId('registered_by');
            $table->dropColumn('sent_to_medtech_at');
        });
    }
};
