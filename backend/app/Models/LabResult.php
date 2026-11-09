<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class LabResult extends Model
{
    use HasFactory;

    protected $fillable = [
        'patient_id',
        'test_type_id',
        'encoded_by',
        'reviewed_by',
        'status',
        'submitted_at',
        'approved_at',
        'rejected_at',
        'rejection_reason',
        'cancelled_at',
        'cancellation_reason',
        'access_token',
        'access_token_expires_at',
        'ml_predicted_diagnosis',
        'ml_prediction_confidence',
        'ml_prediction_details',
    ];

    protected $casts = [
        'submitted_at' => 'datetime',
        'approved_at' => 'datetime',
        'rejected_at' => 'datetime',
        'cancelled_at' => 'datetime',
        'access_token_expires_at' => 'datetime',
        'ml_prediction_details' => 'array',
    ];

    public function patient()
    {
        return $this->belongsTo(Patient::class);
    }

    public function testType()
    {
        return $this->belongsTo(TestType::class);
    }

    public function encoder()
    {
        return $this->belongsTo(User::class, 'encoded_by');
    }

    public function reviewer()
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    public function parameters()
    {
        return $this->hasMany(LabResultParameter::class);
    }

    public function aiRecommendation()
    {
        return $this->hasOne(AiRecommendation::class);
    }
}