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
         * IMPORTANT:
         * The parameter catalog below is a PROVISIONAL software catalog.
         *
         * The thesis identifies the supported TEST TYPES, but it does
         * not provide the complete parameter list or clinical reference
         * ranges for every test.
         *
         * Therefore:
         * - parameter names are used to build the dynamic Encode Results UI
         * - clinical ranges remain NULL
         * - a qualified Medical Technologist/clinical source must verify
         *   the parameter definitions and reference values before real use
         */

        $tests = [
            'CBC' => [
                /*
                 * Reference ranges below are adult ranges sourced from:
                 * "Normal and Abnormal Complete Blood Count With
                 * Differential", StatPearls (NCBI Bookshelf, NBK604207),
                 * accessed 2026-09-23: https://www.ncbi.nlm.nih.gov/books/NBK604207/
                 *
                 * Hemoglobin, Hematocrit, and RBC differ by sex per this
                 * source, so those 3 parameters get 2 rows each (Male /
                 * Female). WBC, Platelet Count, MCV, and MCH are given as
                 * single adult ranges with no sex differentiation in this
                 * source, so those stay as 'Any'.
                 *
                 * These are general adult ranges, not pediatric, not
                 * pregnancy-adjusted, and not adjusted for altitude or lab
                 * instrument. A qualified Medical Technologist should still
                 * verify these against Esperanza Municipal Hospital's own
                 * lab equipment/method-specific ranges before clinical use.
                 */
                [
                    'parameter_name' => 'Hemoglobin',
                    'data_type' => 'numeric',
                    'unit' => 'g/dL',
                    'ranges' => [
                        ['sex' => 'Male', 'low' => 13.0, 'high' => 18.0],
                        ['sex' => 'Female', 'low' => 12.0, 'high' => 16.0],
                    ],
                ],
                [
                    'parameter_name' => 'White Blood Cell Count',
                    'data_type' => 'numeric',
                    'unit' => 'x10^9/L',
                    'ranges' => [
                        ['sex' => 'Any', 'low' => 4.5, 'high' => 11.0],
                    ],
                ],
                [
                    'parameter_name' => 'Red Blood Cell Count',
                    'data_type' => 'numeric',
                    'unit' => 'x10^12/L',
                    'ranges' => [
                        ['sex' => 'Male', 'low' => 4.6, 'high' => 6.2],
                        ['sex' => 'Female', 'low' => 4.2, 'high' => 5.4],
                    ],
                ],
                [
                    'parameter_name' => 'Hematocrit',
                    'data_type' => 'numeric',
                    'unit' => '%',
                    'ranges' => [
                        ['sex' => 'Male', 'low' => 40.0, 'high' => 54.0],
                        ['sex' => 'Female', 'low' => 36.0, 'high' => 48.0],
                    ],
                ],
                [
                    'parameter_name' => 'Platelet Count',
                    'data_type' => 'numeric',
                    'unit' => 'x10^9/L',
                    'ranges' => [
                        ['sex' => 'Any', 'low' => 150.0, 'high' => 400.0],
                    ],
                ],
                [
                    'parameter_name' => 'Mean Corpuscular Volume',
                    'data_type' => 'numeric',
                    'unit' => 'fL',
                    'ranges' => [
                        ['sex' => 'Any', 'low' => 80.0, 'high' => 100.0],
                    ],
                ],
                [
                    'parameter_name' => 'Mean Corpuscular Hemoglobin',
                    'data_type' => 'numeric',
                    'unit' => 'pg',
                    'ranges' => [
                        ['sex' => 'Any', 'low' => 27.0, 'high' => 32.0],
                    ],
                ],
            ],

            'UA' => [
                [
                    'parameter_name' => 'Color',
                    'data_type' => 'text',
                    'unit' => null,
                ],
                /* Specific Gravity and pH ranges: Medscape eMedicine,
                 * "Urinalysis: Reference Range, Interpretation, Collection
                 * and Panels," article 2074001.
                 * https://emedicine.medscape.com/article/2074001-overview */
                [
                    'parameter_name' => 'Specific Gravity',
                    'data_type' => 'numeric',
                    'unit' => null,
                    'ranges' => [
                        ['sex' => 'Any', 'low' => 1.005, 'high' => 1.025],
                    ],
                ],
                [
                    'parameter_name' => 'pH',
                    'data_type' => 'numeric',
                    'unit' => null,
                    'ranges' => [
                        ['sex' => 'Any', 'low' => 4.5, 'high' => 8.0],
                    ],
                ],
                [
                    'parameter_name' => 'Appearance',
                    'data_type' => 'text',
                    'unit' => null,
                    'normal_text' => 'Clear',
                ],
                [
                    'parameter_name' => 'Protein',
                    'data_type' => 'text',
                    'unit' => null,
                    'normal_text' => 'Negative',
                ],
                [
                    'parameter_name' => 'Glucose',
                    'data_type' => 'text',
                    'unit' => null,
                    'normal_text' => 'Negative',
                ],
                [
                    'parameter_name' => 'Ketones',
                    'data_type' => 'text',
                    'unit' => null,
                    'normal_text' => 'Negative',
                ],
                [
                    'parameter_name' => 'Blood',
                    'data_type' => 'text',
                    'unit' => null,
                    'normal_text' => 'Negative',
                ],
                /* Added for the Urinalysis ML model (train_urinalysis.py),
                 * which needs these microscopy fields in addition to the
                 * dipstick fields above. Values entered here should match
                 * the categories the model was trained on -- see
                 * backend/ml/urinalysis_api.py field descriptions. */
                [
                    'parameter_name' => 'White Blood Cells',
                    'data_type' => 'text',
                    'unit' => '/HPF',
                ],
                [
                    'parameter_name' => 'Red Blood Cells',
                    'data_type' => 'text',
                    'unit' => '/HPF',
                ],
                [
                    'parameter_name' => 'Epithelial Cells',
                    'data_type' => 'text',
                    'unit' => null,
                ],
                [
                    'parameter_name' => 'Mucous Threads',
                    'data_type' => 'text',
                    'unit' => null,
                ],
                [
                    'parameter_name' => 'Amorphous Urates',
                    'data_type' => 'text',
                    'unit' => null,
                ],
                [
                    'parameter_name' => 'Bacteria',
                    'data_type' => 'text',
                    'unit' => null,
                ],
            ],

            'FECAL' => [
                [
                    'parameter_name' => 'Color',
                    'data_type' => 'text',
                    'unit' => null,
                ],
                [
                    'parameter_name' => 'Consistency',
                    'data_type' => 'text',
                    'unit' => null,
                ],
                [
                    'parameter_name' => 'Occult Blood',
                    'data_type' => 'text',
                    'unit' => null,
                    'normal_text' => 'Negative',
                ],
                [
                    'parameter_name' => 'Parasites / Ova',
                    'data_type' => 'text',
                    'unit' => null,
                    'normal_text' => 'None Seen',
                ],
            ],

            /* FBS, LIPID, CREAT, BUN ranges: "Appendix A - Normal
             * Reference Ranges," in Health Alterations (Chippewa Valley
             * Technical College, OpenRN, 2024), NCBI Bookshelf NBK613071.
             * https://www.ncbi.nlm.nih.gov/books/NBK613071/
             * Cross-checked against the same values in "Normal Reference
             * Ranges," in Nursing Health Promotion (Christman, OpenRN,
             * 2025), NCBI Bookshelf NBK615342. */
            'FBS' => [
                [
                    'parameter_name' => 'Blood Glucose',
                    'data_type' => 'numeric',
                    'unit' => 'mg/dL',
                    'ranges' => [
                        ['sex' => 'Any', 'low' => 65, 'high' => 110],
                    ],
                ],
            ],

            'LIPID' => [
                [
                    /* Source states desirable Total Cholesterol as
                     * "< 200 mg/dL" with no lower bound given, so low is
                     * left null rather than invented. */
                    'parameter_name' => 'Total Cholesterol',
                    'data_type' => 'numeric',
                    'unit' => 'mg/dL',
                    'ranges' => [
                        ['sex' => 'Any', 'low' => null, 'high' => 200],
                    ],
                ],
                [
                    'parameter_name' => 'Triglycerides',
                    'data_type' => 'numeric',
                    'unit' => 'mg/dL',
                    'ranges' => [
                        ['sex' => 'Any', 'low' => 50, 'high' => 150],
                    ],
                ],
                [
                    'parameter_name' => 'HDL Cholesterol',
                    'data_type' => 'numeric',
                    'unit' => 'mg/dL',
                    'ranges' => [
                        ['sex' => 'Any', 'low' => 40, 'high' => 80],
                    ],
                ],
                [
                    'parameter_name' => 'LDL Cholesterol',
                    'data_type' => 'numeric',
                    'unit' => 'mg/dL',
                    'ranges' => [
                        ['sex' => 'Any', 'low' => 85, 'high' => 125],
                    ],
                ],
            ],

            'CREAT' => [
                [
                    'parameter_name' => 'Creatinine',
                    'data_type' => 'numeric',
                    'unit' => 'mg/dL',
                    'ranges' => [
                        ['sex' => 'Any', 'low' => 0.8, 'high' => 1.3],
                    ],
                ],
            ],

            /* Uric Acid range is sex-specific: Medscape eMedicine,
             * "Uric Acid: Reference Range, Interpretation, Collection and
             * Panels," article 2088516.
             * https://emedicine.medscape.com/article/2088516-overview */
            'BUA' => [
                [
                    'parameter_name' => 'Uric Acid',
                    'data_type' => 'numeric',
                    'unit' => 'mg/dL',
                    'ranges' => [
                        ['sex' => 'Male', 'low' => 2.5, 'high' => 8.0],
                        ['sex' => 'Female', 'low' => 1.9, 'high' => 7.5],
                    ],
                ],
            ],

            'BUN' => [
                [
                    'parameter_name' => 'Blood Urea Nitrogen',
                    'data_type' => 'numeric',
                    'unit' => 'mg/dL',
                    'ranges' => [
                        ['sex' => 'Any', 'low' => 8, 'high' => 21],
                    ],
                ],
            ],

            /* SGOT/AST and SGPT/ALT ranges: same NBK613071/NBK615342
             * source cited above for FBS/LIPID/CREAT/BUN. */
            'SGOT_SGPT' => [
                [
                    'parameter_name' => 'SGOT / AST',
                    'data_type' => 'numeric',
                    'unit' => 'U/L',
                    'ranges' => [
                        ['sex' => 'Any', 'low' => 5, 'high' => 30],
                    ],
                ],
                [
                    'parameter_name' => 'SGPT / ALT',
                    'data_type' => 'numeric',
                    'unit' => 'U/L',
                    'ranges' => [
                        ['sex' => 'Any', 'low' => 5, 'high' => 30],
                    ],
                ],
            ],

            'HBA1C' => [
                [
                    'parameter_name' => 'HbA1c',
                    'data_type' => 'numeric',
                    'unit' => '%',
                    'ranges' => [
                        ['sex' => 'Any', 'low' => 3.9, 'high' => 6.2],
                    ],
                ],
            ],

            /* Sodium/Potassium/Chloride ranges: same NBK613071/NBK615342
             * source cited above. */
            'ELECTROLYTES' => [
                [
                    'parameter_name' => 'Sodium',
                    'data_type' => 'numeric',
                    'unit' => 'mmol/L',
                    'ranges' => [
                        ['sex' => 'Any', 'low' => 135, 'high' => 145],
                    ],
                ],
                [
                    'parameter_name' => 'Potassium',
                    'data_type' => 'numeric',
                    'unit' => 'mmol/L',
                    'ranges' => [
                        ['sex' => 'Any', 'low' => 3.5, 'high' => 5.0],
                    ],
                ],
                [
                    'parameter_name' => 'Chloride',
                    'data_type' => 'numeric',
                    'unit' => 'mmol/L',
                    'ranges' => [
                        ['sex' => 'Any', 'low' => 95, 'high' => 105],
                    ],
                ],
            ],

            'HBSAG' => [
                [
                    'parameter_name' => 'HBsAg',
                    'data_type' => 'text',
                    'unit' => null,
                    'normal_text' => 'Non-Reactive',
                ],
            ],

            'SYPHILIS' => [
                [
                    'parameter_name' => 'Syphilis Screening Result',
                    'data_type' => 'text',
                    'unit' => null,
                    'normal_text' => 'Non-Reactive',
                ],
            ],

            'HIV' => [
                [
                    'parameter_name' => 'HIV Screening Result',
                    'data_type' => 'text',
                    'unit' => null,
                    'normal_text' => 'Non-Reactive',
                ],
            ],

            'DENGUE' => [
                [
                    'parameter_name' => 'Dengue NS1',
                    'data_type' => 'text',
                    'unit' => null,
                    'normal_text' => 'Negative',
                ],
                [
                    'parameter_name' => 'Dengue IgM',
                    'data_type' => 'text',
                    'unit' => null,
                    'normal_text' => 'Negative',
                ],
                [
                    'parameter_name' => 'Dengue IgG',
                    'data_type' => 'text',
                    'unit' => null,
                    'normal_text' => 'Negative',
                ],
            ],

            'SALMONELLA' => [
                [
                    'parameter_name' => 'Salmonella Typhi Result',
                    'data_type' => 'text',
                    'unit' => null,
                    'normal_text' => 'Negative',
                ],
            ],

            'BLOOD_TYPE' => [
                [
                    'parameter_name' => 'ABO Blood Group',
                    'data_type' => 'text',
                    'unit' => null,
                ],
                [
                    'parameter_name' => 'Rh Factor',
                    'data_type' => 'text',
                    'unit' => null,
                ],
            ],
        ];

        foreach ($tests as $testCode => $parameters) {
            $testType = TestType::where('code', $testCode)->first();

            if (!$testType) {
                continue;
            }

            foreach ($parameters as $parameter) {
                // Default: no ranges provided yet for this parameter
                // (matches the original provisional/NULL behavior).
                $ranges = $parameter['ranges'] ?? [
                    ['sex' => 'Any', 'low' => null, 'high' => null],
                ];

                foreach ($ranges as $range) {
                    ReferenceRange::updateOrCreate(
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
                }
            }
        }
    }
}