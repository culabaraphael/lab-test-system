<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Tests encoded together for one patient (MedTech "encode several tests at
 * once") share a request_group, so the Patient Portal can show them under
 * one QR code. NULL for a single test, and for results made before this.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('lab_results', function (Blueprint $table) {
            $table->string('request_group', 36)->nullable()->after('encoded_by')->index();
        });
    }

    public function down(): void
    {
        Schema::table('lab_results', function (Blueprint $table) {
            $table->dropIndex(['request_group']);
            $table->dropColumn('request_group');
        });
    }
};
