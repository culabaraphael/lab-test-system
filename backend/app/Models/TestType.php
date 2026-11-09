<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class TestType extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'code',
        'description',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    public function referenceRanges()
    {
        return $this->hasMany(ReferenceRange::class);
    }

    public function labResults()
    {
        return $this->hasMany(LabResult::class);
    }
}