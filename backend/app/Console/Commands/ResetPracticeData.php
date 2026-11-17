<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

/**
 * Removes all practice data (patients, lab results, result parameters, AI
 * recommendations and their QR tokens) for a fresh start.
 *
 * Kept: user accounts, test types, reference ranges, knowledge base, cache,
 * jobs and personal access tokens.
 *
 * Before deleting, the four tables are exported to
 * storage/app/backups/practice-data-<timestamp>.json.
 *
 * Usage:
 *   php artisan lab:reset-data           # shows counts and asks to confirm
 *   php artisan lab:reset-data --force   # no confirmation question
 */
class ResetPracticeData extends Command
{
    protected $signature = 'lab:reset-data {--force : Do not ask for confirmation}';

    protected $description = 'Delete all patients, lab results and AI recommendations (practice data) after saving a JSON backup';

    /** Child tables first. */
    private const TABLES = [
        'ai_recommendations',
        'lab_result_parameters',
        'lab_results',
        'patients',
    ];

    public function handle(): int
    {
        $counts = [];
        foreach (self::TABLES as $table) {
            $counts[$table] = DB::table($table)->count();
        }

        $this->table(['Table', 'Rows to delete'], collect($counts)->map(
            fn ($n, $t) => [$t, $n]
        )->values()->all());

        if (array_sum($counts) === 0) {
            $this->info('Nothing to delete. The practice data is already empty.');
            return self::SUCCESS;
        }

        if (! $this->option('force')
            && ! $this->confirm('Delete ALL patients, lab results and AI recommendations? User accounts, test types, reference ranges and the knowledge base are kept.')) {
            $this->warn('Cancelled. Nothing was deleted.');
            return self::FAILURE;
        }

        // 1. Backup.
        $backup = [];
        foreach (self::TABLES as $table) {
            $backup[$table] = DB::table($table)->orderBy('id')->get();
        }

        $path = 'backups/practice-data-' . now()->format('Ymd_His') . '.json';
        Storage::disk('local')->put($path, json_encode($backup, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
        $this->info('Backup saved: ' . Storage::disk('local')->path($path));

        // 2. Delete and restart the id counters, so the next patient is P-000001.
        DB::statement('TRUNCATE TABLE ' . implode(', ', self::TABLES) . ' RESTART IDENTITY');

        foreach (self::TABLES as $table) {
            $this->line(str_pad($table, 24) . DB::table($table)->count() . ' rows left');
        }

        $this->info('Done. Accounts, test types, reference ranges and the knowledge base were not touched.');

        return self::SUCCESS;
    }
}
