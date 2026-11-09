# RAG knowledge base

`knowledge_base.json` -- 29 hand-authored, citation-backed entries
(MedlinePlus/CDC), one per abnormal finding pattern across 16 test types.

## To (re)generate embeddings and load them into Postgres

```
cd rag
pip install -r requirements.txt
python generate_embeddings.py
cd ../backend
php artisan kb:seed
```

`generate_embeddings.py` produces `knowledge_base_with_embeddings.json`
(gitignored-worthy -- it's a derived file, safe to regenerate any time).
`php artisan kb:seed` upserts it into the `knowledge_base_entries` table
by `entry_key`, so it's safe to re-run after editing knowledge_base.json.
