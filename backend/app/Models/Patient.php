<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Patient extends Model
{
    use HasFactory;

    /** Minutes the MedTech's Patients list shows "NEW" after the Counter sends a patient. */
    public const NEW_BADGE_MINUTES = 15;

    protected $fillable = [
        'patient_id',
        'first_name',
        'middle_name',
        'last_name',
        'date_of_birth',
        'sex',
        'contact_number',
        'address',
        'allergies',
        'registered_by',
        'sent_to_medtech_at',
    ];

    protected $casts = [
        'sent_to_medtech_at' => 'datetime',
    ];

    protected $appends = ['is_new'];

    /**
     * True for 15 minutes after the Counter/Nurse sent the patient to the
     * MedTech. Computed on the server so the badge does not depend on the
     * clock of the MedTech's computer.
     */
    public function getIsNewAttribute(): bool
    {
        return $this->sent_to_medtech_at !== null
            && $this->sent_to_medtech_at->gt(now()->subMinutes(self::NEW_BADGE_MINUTES));
    }
}
