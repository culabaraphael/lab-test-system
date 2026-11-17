<?php

namespace App\Support;

/**
 * Hides lifestyle tip lines that mention a food matching the patient's known
 * allergies. Words of the same food group are matched too ("peanuts" also
 * matches "nuts"). It is a simple word match and can miss a food, so it does
 * not replace the Doctor's review: the Doctor sees every hidden line and can
 * choose to show it anyway (allergy_kept_lines).
 *
 * The same word groups are used for the warning in the Doctor review screen
 * (frontend/src/pages/doctor/PendingReview.jsx).
 */
class AllergyFilter
{
    private const GROUPS = [
        ['nut', 'nuts', 'peanut', 'peanuts', 'almond', 'almonds', 'walnut', 'walnuts', 'cashew', 'cashews'],
        ['shellfish', 'shrimp', 'shrimps', 'crab', 'crabs', 'lobster', 'mussel', 'mussels', 'scallop', 'scallops', 'clam', 'clams', 'oyster', 'oysters', 'seafood'],
        ['fish', 'salmon', 'tuna', 'sardine', 'sardines', 'anchovy', 'anchovies', 'trout', 'seafood'],
        ['egg', 'eggs'],
        ['milk', 'dairy', 'cheese', 'yogurt', 'lactose'],
        ['soy', 'soya', 'tofu'],
        ['wheat', 'gluten', 'bread', 'cereal', 'cereals', 'grain', 'grains', 'oat', 'oats'],
        ['bean', 'beans', 'legume', 'legumes', 'pea', 'peas', 'lentil', 'lentils'],
    ];

    private const STOPWORDS = [
        'allergy', 'allergies', 'allergic', 'none', 'with', 'mild', 'severe',
        'food', 'foods', 'the', 'all', 'any', 'known',
    ];

    private const FIELDS = ['food', 'routine', 'avoid', 'notes'];

    /** @return string[] */
    public static function keywords(?string $allergies): array
    {
        $terms = preg_split('/[,;\/\n]|\band\b/', strtolower((string) $allergies)) ?: [];
        $words = [];

        foreach ($terms as $term) {
            foreach (preg_split('/\s+/', trim($term)) ?: [] as $w) {
                $word = preg_replace('/[^a-z]/', '', $w);

                if (strlen($word) < 3 || in_array($word, self::STOPWORDS, true)) {
                    continue;
                }

                $words[$word] = true;

                foreach (self::GROUPS as $group) {
                    if (in_array($word, $group, true)) {
                        foreach ($group as $g) {
                            $words[$g] = true;
                        }
                    }
                }
            }
        }

        return array_keys($words);
    }

    public static function mentions(string $line, array $keywords): bool
    {
        foreach ($keywords as $k) {
            if (preg_match('/\b' . preg_quote($k, '/') . '\b/i', $line)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Tip lines that are hidden from the patient: they match an allergy and the
     * Doctor has not chosen to keep them.
     *
     * @return string[]
     */
    public static function hiddenLines(?array $lifestyle, ?string $allergies, ?array $kept): array
    {
        $keywords = self::keywords($allergies);

        if (! $lifestyle || empty($keywords)) {
            return [];
        }

        $kept = $kept ?? [];
        $hidden = [];

        foreach (self::FIELDS as $field) {
            foreach (($lifestyle[$field] ?? []) as $line) {
                if (! in_array($line, $kept, true) && self::mentions((string) $line, $keywords)) {
                    $hidden[] = $line;
                }
            }
        }

        return $hidden;
    }

    /** Lifestyle without the hidden lines; null when nothing is left. */
    public static function visible(?array $lifestyle, ?string $allergies, ?array $kept): ?array
    {
        if (! $lifestyle) {
            return $lifestyle;
        }

        $hidden = self::hiddenLines($lifestyle, $allergies, $kept);

        if (empty($hidden)) {
            return $lifestyle;
        }

        $out = $lifestyle;
        $any = false;

        foreach (self::FIELDS as $field) {
            $out[$field] = array_values(array_filter(
                $lifestyle[$field] ?? [],
                fn ($line) => ! in_array($line, $hidden, true)
            ));

            if ($field !== 'notes' && ! empty($out[$field])) {
                $any = true;
            }
        }

        return $any ? $out : null;
    }

    /** True when two lifestyle arrays have the same number of lines per field. */
    public static function sameShape(?array $a, ?array $b): bool
    {
        if (! $a || ! $b) {
            return false;
        }

        foreach (self::FIELDS as $field) {
            if (count($a[$field] ?? []) !== count($b[$field] ?? [])) {
                return false;
            }
        }

        return true;
    }
}
