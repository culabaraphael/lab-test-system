<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ReferenceRange extends Model
{
    use HasFactory;

    protected $fillable = [
        'test_type_id',
        'parameter_name',
        'data_type',
        'unit',
        'low_value',
        'high_value',
        'normal_text',
        'sex',
        'min_age',
        'max_age',
        'is_active',
    ];

    protected $casts = [
        'low_value' => 'decimal:4',
        'high_value' => 'decimal:4',
        'min_age' => 'integer',
        'max_age' => 'integer',
        'is_active' => 'boolean',
    ];

    public function testType()
    {
        return $this->belongsTo(TestType::class);
    }
}