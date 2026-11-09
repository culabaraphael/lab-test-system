<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class SeedKnowledgeBase extends Command
{
    /**
     * php artisan kb:seed
     *   Loads rag/knowledge_base_with_embeddings.json (produced by
     *   rag/generate_embeddings.py) into the knowledge_base_entries table.
     *   Safe to re-run: upserts on entry_key.
     */
    protected $signature = 'kb:seed';

    protected $description = 'Load the RAG knowledge base (with embeddings) into knowledge_base_entries';

    public function handle(): int
    {
        $path = base_path('../rag/knowledge_base_with_embeddings.json');

        if (!file_exists($path)) {
            $this->error("File not found: {$path}");
            $this->line('Run rag/generate_embeddings.py first (see rag/README.md).');
            return self::FAILURE;
        }

        $entries = json_decode(file_get_contents($path), true);

        if (!is_array($entries)) {
            $this->error('Could not parse JSON, or it is not a list of entries.');
            return self::FAILURE;
        }

        $this->info('Loaded ' . count($entries) . ' entries from ' . basename($path));

        $inserted = 0;
        $updated = 0;

        foreach ($entries as $entry) {
            if (!isset($entry['embedding']) || !is_array($entry['embedding'])) {
                $this->warn("Skipping '{$entry['id']}': no embedding present.");
                continue;
            }

            if (count($entry['embedding']) !== 384) {
                $this->warn("Skipping '{$entry['id']}': embedding has "
                    . count($entry['embedding'])
                    . ' dimensions, expected 384.');
                continue;
            }

            $vectorLiteral = '[' . implode(',', $entry['embedding']) . ']';

            $exists = DB::table('knowledge_base_entries')
                ->where('entry_key', $entry['id'])
                ->exists();

            $common = [
                'test_type_code' => $entry['test_type'],
                'parameters' => json_encode($entry['parameters']),
                'flag' => $entry['flag'],
                'title' => $entry['title'],
                'content' => $entry['content'],
                'source_title' => $entry['source_title'],
                'source_url' => $entry['source_url'],
                'updated_at' => now(),
            ];

            if ($exists) {
                DB::table('knowledge_base_entries')
                    ->where('entry_key', $entry['id'])
                    ->update($common);
                $updated++;
            } else {
                DB::table('knowledge_base_entries')->insert(array_merge($common, [
                    'entry_key' => $entry['id'],
                    'created_at' => now(),
                ]));
                $inserted++;
            }

            // Vector column can't be set through the query builder's
            // normal bindings (no native pgvector type in Laravel), so
            // it's written separately with a raw statement, cast from
            // its string literal form ('[0.1,0.2,...]'::vector).
            DB::statement(
                'UPDATE knowledge_base_entries SET embedding = ?::vector WHERE entry_key = ?',
                [$vectorLiteral, $entry['id']]
            );
        }

        $this->info("Done. Inserted: {$inserted}, updated: {$updated}.");

        return self::SUCCESS;
    }
}
