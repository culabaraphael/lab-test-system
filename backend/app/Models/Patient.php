<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Patient extends Model
{
    use HasFactory;

    protected $fillable = [
        'patient_id',
        'first_name',
        'middle_name',
        'last_name',
        'date_of_birth',
        'sex',
        'contact_number',
        'address',
    ];
}