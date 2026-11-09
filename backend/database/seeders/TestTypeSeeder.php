<?php

namespace Database\Seeders;

use App\Models\TestType;
use Illuminate\Database\Seeder;

class TestTypeSeeder extends Seeder
{
    public function run(): void
    {
        $tests = [
            [
                'name' => 'Complete Blood Count',
                'code' => 'CBC',
                'description' => 'Complete Blood Count',
            ],
            [
                'name' => 'Urinalysis',
                'code' => 'UA',
                'description' => 'Urinalysis',
            ],
            [
                'name' => 'Fecalysis',
                'code' => 'FECAL',
                'description' => 'Fecalysis',
            ],
            [
                'name' => 'Fasting Blood Sugar',
                'code' => 'FBS',
                'description' => 'Fasting Blood Sugar',
            ],
            [
                'name' => 'Lipid Profile',
                'code' => 'LIPID',
                'description' => 'Lipid Profile',
            ],
            [
                'name' => 'Creatinine',
                'code' => 'CREAT',
                'description' => 'Creatinine',
            ],
            [
                'name' => 'Blood Uric Acid',
                'code' => 'BUA',
                'description' => 'Blood Uric Acid',
            ],
            [
                'name' => 'Blood Urea Nitrogen',
                'code' => 'BUN',
                'description' => 'Blood Urea Nitrogen',
            ],
            [
                'name' => 'SGOT/SGPT',
                'code' => 'SGOT_SGPT',
                'description' => 'SGOT/SGPT',
            ],
            [
                'name' => 'Glycosylated Hemoglobin',
                'code' => 'HBA1C',
                'description' => 'Glycosylated Hemoglobin',
            ],
            [
                'name' => 'Serum Electrolytes',
                'code' => 'ELECTROLYTES',
                'description' => 'Serum Electrolytes',
            ],
            [
                'name' => 'HBsAg',
                'code' => 'HBSAG',
                'description' => 'Hepatitis B Surface Antigen',
            ],
            [
                'name' => 'Syphilis',
                'code' => 'SYPHILIS',
                'description' => 'Syphilis Screening',
            ],
            [
                'name' => 'HIV',
                'code' => 'HIV',
                'description' => 'HIV Screening',
            ],
            [
                'name' => 'Dengue Duo',
                'code' => 'DENGUE',
                'description' => 'Dengue Duo Screening',
            ],
            [
                'name' => 'Salmonella Typhi',
                'code' => 'SALMONELLA',
                'description' => 'Salmonella Typhi Testing',
            ],
            [
                'name' => 'Blood Typing',
                'code' => 'BLOOD_TYPE',
                'description' => 'ABO and Rh Blood Typing',
            ],
        ];

        foreach ($tests as $test) {
            TestType::updateOrCreate(
                ['code' => $test['code']],
                $test
            );
        }
    }
}