<?php

namespace Database\Seeders;

use App\Models\ReferenceRange;
use App\Models\TestType;
use Illuminate\Database\Seeder;

class ReferenceRangeSeeder extends Seeder
{
    public function run(): void
    {
        /*
         * Reference ranges, updated 2026-11-13.
         *
         * SOURCE A (hospital): result forms and analyzer printouts of the
         * Esperanza hospital laboratory, received from the hospital's Medical
         * Technologist on 2026-11-12/13 (CBC printouts for Woman and Man,
         * Clinical Chemistry form, Lipid Profile, Serum Electrolytes form,
         * HbA1c form) plus the MedTech's written answers (BUN 6-24 mg/dL,
         * HDL without flag, qualitative result values).
         *
         * SOURCE B (published, per the MedTech's advice to use standard
         * references for Urinalysis and Fecalysis):
         *   StatPearls, "Urinalysis" (Queremel Milani & Jialal, updated
         *   2023-05-01), https://www.ncbi.nlm.nih.gov/books/NBK557685/
         *
         * All ranges are ADULT ranges. min_age / max_age are not used by the
         * app yet, so pediatric patients are compared against adult ranges
         * and must be interpreted by the Doctor.
         *
         * A one-sided range (low or high null) flags only the defined side.
         * computeFlag() flags HIGH when value > high, so a value equal to the
         * high bound counts as NORMAL.
         *
         * Rows from an older version of this seeder that are no longer listed
         * here (e.g. Creatinine 'Any' before it became Male/Female) are set to
         * is_active = false at the end, not deleted, so old results keep their
         * reference_range_id.
         */

        $tests = [
            // SOURCE A: hospital CBC analyzer printouts (Group: Woman / Man).
            // Only RBC, HGB and HCT differ by sex; all other items are the
            // same on both printouts.
            'CBC' => [
                ['parameter_name' => 'Hemoglobin', 'data_type' => 'numeric', 'unit' => 'g/dL', 'ranges' => [
                    ['sex' => 'Male', 'low' => 13.0, 'high' => 17.5],
                    ['sex' => 'Female', 'low' => 11.5, 'high' => 15.0],
                ]],
                ['parameter_name' => 'White Blood Cell Count', 'data_type' => 'numeric', 'unit' => 'x10^9/L', 'ranges' => [
                    ['sex' => 'Any', 'low' => 5.0, 'high' => 10.0],
                ]],
                ['parameter_name' => 'Red Blood Cell Count', 'data_type' => 'numeric', 'unit' => 'x10^12/L', 'ranges' => [
                    ['sex' => 'Male', 'low' => 4.30, 'high' => 5.80],
                    ['sex' => 'Female', 'low' => 3.80, 'high' => 5.10],
                ]],
                ['parameter_name' => 'Hematocrit', 'data_type' => 'numeric', 'unit' => '%', 'ranges' => [
                    ['sex' => 'Male', 'low' => 40.0, 'high' => 50.0],
                    ['sex' => 'Female', 'low' => 35.0, 'high' => 45.0],
                ]],
                ['parameter_name' => 'Platelet Count', 'data_type' => 'numeric', 'unit' => 'x10^9/L', 'ranges' => [
                    ['sex' => 'Any', 'low' => 150, 'high' => 350],
                ]],
                ['parameter_name' => 'Mean Corpuscular Volume', 'data_type' => 'numeric', 'unit' => 'fL', 'ranges' => [
                    ['sex' => 'Any', 'low' => 82.0, 'high' => 100.0],
                ]],
                ['parameter_name' => 'Mean Corpuscular Hemoglobin', 'data_type' => 'numeric', 'unit' => 'pg', 'ranges' => [
                    ['sex' => 'Any', 'low' => 27, 'high' => 34],
                ]],
                // Added 2026-11-13 because the hospital CBC report lists them.
                ['parameter_name' => 'Mean Corpuscular Hemoglobin Concentration', 'data_type' => 'numeric', 'unit' => 'g/dL', 'ranges' => [
                    ['sex' => 'Any', 'low' => 32.0, 'high' => 35.0],
                ]],
                ['parameter_name' => 'Lymphocytes', 'data_type' => 'numeric', 'unit' => '%', 'ranges' => [
                    ['sex' => 'Any', 'low' => 20.0, 'high' => 50.0],
                ]],
                ['parameter_name' => 'Monocytes', 'data_type' => 'numeric', 'unit' => '%', 'ranges' => [
                    ['sex' => 'Any', 'low' => 3.0, 'high' => 10.0],
                ]],
                ['parameter_name' => 'Neutrophils', 'data_type' => 'numeric', 'unit' => '%', 'ranges' => [
                    ['sex' => 'Any', 'low' => 40.0, 'high' => 75.0],
                ]],
                ['parameter_name' => 'Eosinophils', 'data_type' => 'numeric', 'unit' => '%', 'ranges' => [
                    ['sex' => 'Any', 'low' => 0.4, 'high' => 8.0],
                ]],
                ['parameter_name' => 'Basophils', 'data_type' => 'numeric', 'unit' => '%', 'ranges' => [
                    ['sex' => 'Any', 'low' => 0.0, 'high' => 1.0],
                ]],
                ['parameter_name' => 'RDW-SD', 'data_type' => 'numeric', 'unit' => 'fL', 'ranges' => [
                    ['sex' => 'Any', 'low' => 37.0, 'high' => 54.0],
                ]],
                ['parameter_name' => 'RDW-CV', 'data_type' => 'numeric', 'unit' => '%', 'ranges' => [
                    ['sex' => 'Any', 'low' => 11.5, 'high' => 14.5],
                ]],
                ['parameter_name' => 'Mean Platelet Volume', 'data_type' => 'numeric', 'unit' => 'fL', 'ranges' => [
                    ['sex' => 'Any', 'low' => 7.4, 'high' => 10.4],
                ]],
                ['parameter_name' => 'Platelet Distribution Width', 'data_type' => 'numeric', 'unit' => 'fL', 'ranges' => [
                    ['sex' => 'Any', 'low' => 10.0, 'high' => 14.0],
                ]],
                ['parameter_name' => 'Plateletcrit', 'data_type' => 'numeric', 'unit' => '%', 'ranges' => [
                    ['sex' => 'Any', 'low' => 0.10, 'high' => 0.28],
                ]],
            ],

            // SOURCE B (StatPearls Urinalysis) where a range is given.
            // Free-text fields with several normal wordings (Color) and the
            // microscopy fields written as ranges ("0-2") stay unflagged,
            // because normal_text matching accepts only one exact wording.
            'UA' => [
                ['parameter_name' => 'Color', 'data_type' => 'text', 'unit' => null],
                ['parameter_name' => 'Specific Gravity', 'data_type' => 'numeric', 'unit' => null, 'ranges' => [
                    ['sex' => 'Any', 'low' => 1.002, 'high' => 1.035],
                ]],
                ['parameter_name' => 'pH', 'data_type' => 'numeric', 'unit' => null, 'ranges' => [
                    ['sex' => 'Any', 'low' => 4.5, 'high' => 8.0],
                ]],
                ['parameter_name' => 'Appearance', 'data_type' => 'text', 'unit' => null, 'normal_text' => 'Clear'],
                ['parameter_name' => 'Protein', 'data_type' => 'text', 'unit' => null, 'normal_text' => 'Negative'],
                ['parameter_name' => 'Glucose', 'data_type' => 'text', 'unit' => null, 'normal_text' => 'Negative'],
                ['parameter_name' => 'Ketones', 'data_type' => 'text', 'unit' => null, 'normal_text' => 'Negative'],
                ['parameter_name' => 'Blood', 'data_type' => 'text', 'unit' => null, 'normal_text' => 'Negative'],
                // Microscopy fields used by the Urinalysis ML model
                // (see ml/urinalysis_api.py). Keep these names unchanged.
                ['parameter_name' => 'White Blood Cells', 'data_type' => 'text', 'unit' => '/HPF'],
                ['parameter_name' => 'Red Blood Cells', 'data_type' => 'text', 'unit' => '/HPF'],
                ['parameter_name' => 'Epithelial Cells', 'data_type' => 'text', 'unit' => null],
                ['parameter_name' => 'Mucous Threads', 'data_type' => 'text', 'unit' => null],
                ['parameter_name' => 'Amorphous Urates', 'data_type' => 'text', 'unit' => null],
                ['parameter_name' => 'Bacteria', 'data_type' => 'text', 'unit' => null],
            ],

            // No hospital range. Color and Consistency stay unflagged (free
            // text with several normal wordings).
            'FECAL' => [
                ['parameter_name' => 'Color', 'data_type' => 'text', 'unit' => null],
                ['parameter_name' => 'Consistency', 'data_type' => 'text', 'unit' => null],
                ['parameter_name' => 'Occult Blood', 'data_type' => 'text', 'unit' => null, 'normal_text' => 'Negative'],
                ['parameter_name' => 'Parasites / Ova', 'data_type' => 'text', 'unit' => null, 'normal_text' => 'None Seen'],
            ],

            // SOURCE A: hospital Clinical Chemistry form.
            'FBS' => [
                ['parameter_name' => 'Blood Glucose', 'data_type' => 'numeric', 'unit' => 'mg/dL', 'ranges' => [
                    ['sex' => 'Any', 'low' => 74, 'high' => 100],
                ]],
            ],

            // SOURCE A: hospital Lipid Profile form ("Normal: < 200",
            // "Normal: < 150", "Optimal: < 100", VLDL "2 to 30").
            // HDL: the MedTech said not to flag it, so no range.
            'LIPID' => [
                ['parameter_name' => 'Total Cholesterol', 'data_type' => 'numeric', 'unit' => 'mg/dL', 'ranges' => [
                    ['sex' => 'Any', 'low' => null, 'high' => 200],
                ]],
                ['parameter_name' => 'Triglycerides', 'data_type' => 'numeric', 'unit' => 'mg/dL', 'ranges' => [
                    ['sex' => 'Any', 'low' => null, 'high' => 150],
                ]],
                ['parameter_name' => 'HDL Cholesterol', 'data_type' => 'numeric', 'unit' => 'mg/dL'],
                ['parameter_name' => 'LDL Cholesterol', 'data_type' => 'numeric', 'unit' => 'mg/dL', 'ranges' => [
                    ['sex' => 'Any', 'low' => null, 'high' => 100],
                ]],
                ['parameter_name' => 'VLDL Cholesterol', 'data_type' => 'numeric', 'unit' => 'mg/dL', 'ranges' => [
                    ['sex' => 'Any', 'low' => 2, 'high' => 30],
                ]],
            ],

            'CREAT' => [
                ['parameter_name' => 'Creatinine', 'data_type' => 'numeric', 'unit' => 'mg/dL', 'ranges' => [
                    ['sex' => 'Male', 'low' => 0.7, 'high' => 1.5],
                    ['sex' => 'Female', 'low' => 0.6, 'high' => 1.3],
                ]],
            ],

            'BUA' => [
                ['parameter_name' => 'Uric Acid', 'data_type' => 'numeric', 'unit' => 'mg/dL', 'ranges' => [
                    ['sex' => 'Male', 'low' => 3.4, 'high' => 7.0],
                    ['sex' => 'Female', 'low' => 2.4, 'high' => 6.0],
                ]],
            ],

            // SOURCE A: MedTech's answer on 2026-11-13 (the printed form
            // said 18.0-55.0).
            'BUN' => [
                ['parameter_name' => 'Blood Urea Nitrogen', 'data_type' => 'numeric', 'unit' => 'mg/dL', 'ranges' => [
                    ['sex' => 'Any', 'low' => 6, 'high' => 24],
                ]],
            ],

            // SOURCE A: "up to 42" / "up to 49".
            'SGOT_SGPT' => [
                ['parameter_name' => 'SGOT / AST', 'data_type' => 'numeric', 'unit' => 'U/L', 'ranges' => [
                    ['sex' => 'Any', 'low' => null, 'high' => 42],
                ]],
                ['parameter_name' => 'SGPT / ALT', 'data_type' => 'numeric', 'unit' => 'U/L', 'ranges' => [
                    ['sex' => 'Any', 'low' => null, 'high' => 49],
                ]],
            ],

            // SOURCE A: MedTech's answer on 2026-11-13: ">= 6.5 % = presence
            // of diabetes" (hospital HbA1c form). No lower limit given.
            // computeFlag() flags HIGH when value > high, and HbA1c is
            // reported to one decimal, so high = 6.4 flags 6.5 and above.
            'HBA1C' => [
                ['parameter_name' => 'HbA1c', 'data_type' => 'numeric', 'unit' => '%', 'ranges' => [
                    ['sex' => 'Any', 'low' => null, 'high' => 6.4],
                ]],
            ],

            // SOURCE A: hospital Serum Electrolytes form.
            'ELECTROLYTES' => [
                ['parameter_name' => 'Sodium', 'data_type' => 'numeric', 'unit' => 'mmol/L', 'ranges' => [
                    ['sex' => 'Any', 'low' => 135, 'high' => 145],
                ]],
                ['parameter_name' => 'Potassium', 'data_type' => 'numeric', 'unit' => 'mmol/L', 'ranges' => [
                    ['sex' => 'Any', 'low' => 3.5, 'high' => 5.5],
                ]],
                ['parameter_name' => 'Chloride', 'data_type' => 'numeric', 'unit' => 'mmol/L', 'ranges' => [
                    ['sex' => 'Any', 'low' => 98, 'high' => 108],
                ]],
            ],

            // SOURCE A: MedTech's answer: Nonreactive or Reactive;
            // Positive or Negative. Normal wording kept as before.
            'HBSAG' => [
                ['parameter_name' => 'HBsAg', 'data_type' => 'text', 'unit' => null, 'normal_text' => 'Non-Reactive'],
            ],
            'SYPHILIS' => [
                ['parameter_name' => 'Syphilis Screening Result', 'data_type' => 'text', 'unit' => null, 'normal_text' => 'Non-Reactive'],
            ],
            'HIV' => [
                ['parameter_name' => 'HIV Screening Result', 'data_type' => 'text', 'unit' => null, 'normal_text' => 'Non-Reactive'],
            ],
            'DENGUE' => [
                ['parameter_name' => 'Dengue NS1', 'data_type' => 'text', 'unit' => null, 'normal_text' => 'Negative'],
                ['parameter_name' => 'Dengue IgM', 'data_type' => 'text', 'unit' => null, 'normal_text' => 'Negative'],
                ['parameter_name' => 'Dengue IgG', 'data_type' => 'text', 'unit' => null, 'normal_text' => 'Negative'],
            ],
            'SALMONELLA' => [
                ['parameter_name' => 'Salmonella Typhi Result', 'data_type' => 'text', 'unit' => null, 'normal_text' => 'Negative'],
            ],

            // Blood type is a value (A/B/O/AB, Rh positive/negative), never
            // normal or abnormal, so no flag.
            'BLOOD_TYPE' => [
                ['parameter_name' => 'ABO Blood Group', 'data_type' => 'text', 'unit' => null],
                ['parameter_name' => 'Rh Factor', 'data_type' => 'text', 'unit' => null],
            ],
        ];

        foreach ($tests as $testCode => $parameters) {
            $testType = TestType::where('code', $testCode)->first();

            if (!$testType) {
                continue;
            }

            $keptIds = [];

            foreach ($parameters as $parameter) {
                $ranges = $parameter['ranges'] ?? [
                    ['sex' => 'Any', 'low' => null, 'high' => null],
                ];

                foreach ($ranges as $range) {
                    $row = ReferenceRange::updateOrCreate(
                        [
                            'test_type_id' => $testType->id,
                            'parameter_name' => $parameter['parameter_name'],
                            'sex' => $range['sex'],
                        ],
                        [
                            'data_type' => $parameter['data_type'],
                            'unit' => $parameter['unit'],
                            'low_value' => $range['low'],
                            'high_value' => $range['high'],
                            'normal_text' => $parameter['normal_text'] ?? null,
                            'min_age' => null,
                            'max_age' => null,
                            'is_active' => true,
                        ]
                    );

                    $keptIds[] = $row->id;
                }
            }

            // Deactivate rows of this test type that this version no longer
            // lists (not deleted: old results still point to them).
            ReferenceRange::where('test_type_id', $testType->id)
                ->whereNotIn('id', $keptIds)
                ->update(['is_active' => false]);
        }
    }
}
