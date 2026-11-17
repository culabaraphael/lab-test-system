<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('patients', function (Blueprint $table) {
            // Known allergies as told by the patient at registration
            // (free text, e.g. "peanuts, shellfish"). Shown to the Doctor during
            // review so lifestyle tips that mention a matching food can be
            // edited or hidden before approval.
            $table->text('allergies')->nullable()->after('address');
        });
    }

    public function down(): void
    {
        Schema::table('patients', function (Blueprint $table) {
            $table->dropColumn('allergies');
        });
    }
};
