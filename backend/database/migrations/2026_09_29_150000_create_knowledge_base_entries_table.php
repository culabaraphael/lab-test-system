<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('knowledge_base_entries', function (Blueprint $table) {
            $table->id();

            // Matches the "id" field in knowledge_base.json, e.g. "cbc-wbc-high"
            $table->string('entry_key')->unique();

            $table->string('test_type_code');

            // Array of parameter names this entry is relevant to,
            // e.g. ["White Blood Cell Count"]
            $table->json('parameters');

            $table->enum('flag', [
                'LOW',
                'HIGH',
                'ABNORMAL',
            ]);

            $table->string('title');
            $table->text('content');

            $table->string('source_title');
            $table->string('source_url');

            $table->timestamps();

            $table->index('test_type_code');
        });

        // pgvector has no native Laravel column type, so the embedding
        // column is added with raw SQL. 384 dimensions matches the
        // sentence-transformers all-MiniLM-L6-v2 model used to embed
        // knowledge_base.json entries.
        DB::statement('ALTER TABLE knowledge_base_entries ADD COLUMN embedding vector(384)');

        // No ivfflat/hnsw index yet: with ~29 rows a sequential scan is
        // effectively instant, and pgvector's own docs recommend building
        // an approximate index only once there is real data to train it
        // on. Documented here as a known scaling item, not an oversight.
    }

    public function down(): void
    {
        Schema::dropIfExists('knowledge_base_entries');
    }
};
