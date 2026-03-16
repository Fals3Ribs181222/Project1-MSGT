# RAG-Powered AI Tools

TuteFlow includes a Retrieval-Augmented Generation (RAG) system that powers two AI features: the **Student Doubt Solver** and the **Test Paper Generator**. Both tools answer questions and generate content grounded exclusively in study materials uploaded by the teacher — not generic internet knowledge.

---

## What is RAG?

RAG (Retrieval-Augmented Generation) is a technique where an AI model is given relevant excerpts from a knowledge base before generating a response. This ensures answers are:
- Grounded in the teacher's actual uploaded notes
- Consistent with the methods and terminology taught in class
- Scoped to the correct subject and grade

---

## Architecture

The system consists of two pipelines:

### Pipeline 1 — Indexing (runs on file upload)

```
Teacher uploads file
        ↓
index-material Edge Function
        ↓
Text extracted from file URL
        ↓
Text split into overlapping chunks (~400 words, 50-word overlap)
        ↓
Each chunk embedded via Voyage AI (voyage-3-lite → 512 dimensions)
        ↓
Chunks + embeddings stored in material_chunks table (pgvector)
```

### Pipeline 2 — Querying (runs on doubt/test request)

```
User submits question or topic
        ↓
rag-query Edge Function
        ↓
Question embedded via Voyage AI
        ↓
pgvector similarity search on material_chunks (filtered by subject + grade)
        ↓
Top 5 most relevant chunks retrieved
        ↓
Chunks injected into Claude prompt as context
        ↓
Claude (claude-haiku-4-5) generates answer or test paper
        ↓
Response returned to UI
```

---

## Database

### `material_chunks` table

| Column | Type | Description |
|---|---|---|
| `id` | uuid | Primary key |
| `file_id` | uuid | References `files(id)` — cascades on delete |
| `chunk_index` | int | Order of chunk within the file |
| `content` | text | Raw text content of the chunk |
| `embedding` | vector(512) | Voyage AI embedding for similarity search |
| `subject` | text | e.g. `Accounts`, `Commerce` |
| `grade` | text | e.g. `11th`, `12th` |
| `teacher_id` | uuid | References `profiles(id)` |

### `match_chunks` SQL function

Performs cosine similarity search filtered by subject and grade:

```sql
create or replace function match_chunks(
  query_embedding vector(512),
  match_subject text,
  match_grade text,
  match_count int default 5
)
returns table (content text, similarity float)
language sql stable
as $$
  select content, 1 - (embedding <=> query_embedding) as similarity
  from material_chunks
  where subject = match_subject
    and grade = match_grade
    and embedding is not null
  order by embedding <=> query_embedding
  limit match_count;
$$;
```

---

## Edge Functions

### `index-material`

**Trigger:** Called automatically from `upload.js` after a file is successfully inserted into the `files` table.

**Request body:**
```json
{
  "file_id": "uuid",
  "file_url": "https://...",
  "subject": "Accounts",
  "grade": "12th",
  "teacher_id": "uuid"
}
```

**Response:**
```json
{ "success": true, "chunks_indexed": 8 }
```

**Key behaviour:**
- Deletes existing chunks for `file_id` before re-indexing (safe for re-uploads)
- Skips chunks shorter than 20 characters
- Runs in the background — teacher does not wait for indexing to complete

### `rag-query`

**Trigger:** Called from `ai-tools.js` when teacher submits a doubt or test generation request.

**Request body:**
```json
{
  "query": "Define demand",
  "subject": "Accounts",
  "grade": "11th",
  "mode": "doubt"
}
```

`mode` can be `"doubt"` or `"test"`.

**Response:**
```json
{ "answer": "Demand refers to..." }
```

**If no material found:**
```json
{ "answer": "No relevant material found for this subject and grade. Please ask your teacher to upload study materials first." }
```

---

## Environment Secrets

| Secret | Description |
|---|---|
| `VOYAGE_API_KEY` | Voyage AI API key from voyageai.com |
| `ANTHROPIC_API_KEY` | Anthropic API key (shared with generate-report function) |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto-provided by Supabase runtime |

---

## Key Files

| File | Purpose |
|---|---|
| `supabase/functions/index-material/index.ts` | Chunks, embeds, and stores uploaded file content |
| `supabase/functions/rag-query/index.ts` | Semantic search + Claude response generation |
| `js/dashboard/ai-tools.js` | Frontend logic for Doubt Solver and Test Generator |
| `components/tabs/ai-tools.html` | UI for both AI tools |
| `js/dashboard/upload.js` | Triggers indexing after successful file upload |

---

## Deployment

```bash
npx supabase functions deploy index-material --no-verify-jwt
npx supabase functions deploy rag-query --no-verify-jwt
```

```bash
npx supabase secrets set VOYAGE_API_KEY=your-key-here
```

> [!IMPORTANT]
> Both functions require `--no-verify-jwt` for the same reason as `generate-report` — Supabase's JWT gateway blocks raw fetch requests from the browser.

---

## UI Behaviour

### Doubt Solver
- Teacher/student selects subject and grade, types a question
- AI answers using only the uploaded material for that subject/grade
- Copy button available to share the answer
- If no material is indexed for the selected subject/grade, a friendly message is shown

### Test Generator
- Teacher selects subject, grade, and enters a topic
- AI generates a structured test paper with Section A (2-mark questions) and Section B (5-mark questions) plus an answer key
- Output uses the exact terminology from uploaded notes
- Copy button available to paste into Word or WhatsApp

---

## Important Notes

- **File format:** Currently supports plain text (`.txt`) and text-based files. PDF text extraction requires additional parsing logic (future improvement).
- **Embedding model:** `voyage-3-lite` outputs 512-dimensional vectors. The `material_chunks` table and `match_chunks` function are both configured for 512 dimensions.
- **Re-uploads:** Uploading a new version of a file automatically re-indexes it — old chunks are deleted first.
- **Grade must be set:** Files uploaded without a grade will have `null` or `EMPTY` grade and will not be found by the similarity search. Always select a grade when uploading.
- **Cost:** Voyage AI free tier is sufficient for current scale. Embedding a full chapter costs fractions of a cent.
