<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

class UserSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // Medical Technologist account
        User::updateOrCreate(
            ['username' => 'medtech01'],
            [
                'name' => 'Medical Technologist',
                'email' => 'medtech01@labtest.local',
                'password' => 'Medtech@123',
                'role' => 'Medical Technologist',
            ]
        );

        // Doctor account
        User::updateOrCreate(
            ['username' => 'doctor01'],
            [
                'name' => 'Doctor',
                'email' => 'doctor01@labtest.local',
                'password' => 'Doctor@123',
                'role' => 'Doctor',
            ]
        );

        // Counter/Nurse account (check-in + QR result release,
        // no result-value visibility)
        User::updateOrCreate(
            ['username' => 'counter01'],
            [
                'name' => 'Counter/Nurse',
                'email' => 'counter01@labtest.local',
                'password' => 'Counter@123',
                'role' => 'COUNTER',
            ]
        );
    }
}