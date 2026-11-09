<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class LabResultParameter extends Model
{
    use HasFactory;

    protected $fillable = [
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
    ];

    protected $casts = [
        'value_numeric' => 'decimal:4',
        'reference_low' => 'decimal:4',
        'reference_high' => 'decimal:4',
    ];

    public function labResult()
    {
        return $this->belongsTo(LabResult::class);
    }

    public function referenceRange()
    {
        return $this->belongsTo(ReferenceRange::class);
    }
}