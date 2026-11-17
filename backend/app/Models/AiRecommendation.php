<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class AiRecommendation extends Model
{
    use HasFactory;

    protected $fillable = [
        'lab_result_id',
        'recommendation_text',
        'recommendation_text_ceb',
        'lifestyle',
        'lifestyle_ceb',
        'lifestyle_hidden',
        'allergy_kept_lines',
        'model_used',
        'input_findings',
        'retrieved_entry_keys',
        'is_hidden',
        'edited_by_doctor',
        'generated_at',
    ];

    protected $casts = [
        'input_findings' => 'array',
        'retrieved_entry_keys' => 'array',
        'lifestyle' => 'array',
        'lifestyle_ceb' => 'array',
        'lifestyle_hidden' => 'boolean',
        'allergy_kept_lines' => 'array',
        'is_hidden' => 'boolean',
        'edited_by_doctor' => 'boolean',
        'generated_at' => 'datetime',
    ];

    public function labResult()
    {
        return $this->belongsTo(LabResult::class);
    }
}
