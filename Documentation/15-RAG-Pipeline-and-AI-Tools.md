# RAG-Powered AI Tools

TuteFlow includes a Retrieval-Augmented Generation (RAG) system that powers two AI features: the **Student Doubt Solver** and the **ISC Test Paper Generator**. Both tools generate content grounded exclusively in study materials uploaded by the teacher — not generic internet knowledge.

---

## What is RAG?

RAG (Retrieval-Augmented Generation) is a technique where an AI model is given relevant excerpts from a knowledge base before generating a response. This ensures answers are:
- Grounded in the teacher's actual uploaded notes
- Consistent with the methods and terminology taught in class
- Scoped to the correct subject and grade
- Not hallucinated from generic internet knowledge

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
User submits question or topic + config
        ↓
rag-query Edge Function
        ↓
Query embedded via Voyage AI
        ↓
pgvector similarity search on material_chunks
(filtered by subject + grade, or by specific file_id)
        ↓
Top 5–15 most relevant chunks retrieved
        ↓
Chunks + ISC-specific system prompt injected into Claude
        ↓
Claude (claude-sonnet-4-5) generates answer or test paper
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

Performs cosine similarity search with optional file-level filtering:

```sql
create or replace function match_chunks(
  query_embedding vector(512),
  match_subject   text,
  match_grade     text,
  match_count     int  default 5,
  match_file_id   uuid default null
)
returns table (content text, similarity float)
language sql stable
as $$
  select content, 1 - (embedding <=> query_embedding) as similarity
  from material_chunks
  where
    embedding is not null
    and (
      (match_file_id is not null and file_id = match_file_id)
      or
      (match_file_id is null and subject = match_subject and grade = match_grade)
    )
  order by embedding <=> query_embedding
  limit match_count;
$$;
```

**Key behaviour:** When `match_file_id` is provided, filtering is done purely by file — subject and grade are ignored. When `match_file_id` is null, filtering is by subject + grade across all indexed files.

---

## Edge Functions

### `index-material`

**Trigger:** Called automatically from `upload.js` after a file is successfully inserted into the `files` table.

**Request body:**
```json
{
  "file_id": "uuid",
  "file_url": "https://...",
  "subject": "Commerce",
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

---

### `rag-query`

**Trigger:** Called from `ai-tools.js` when the teacher submits a doubt question or test generation request.

**Request body — Doubt mode:**
```json
{
  "query": "What is the difference between equity and preference shares?",
  "subject": "Commerce",
  "grade": "12th",
  "mode": "doubt"
}
```

**Request body — Test mode:**
```json
{
  "query": "Principles of Management",
  "subject": "Commerce",
  "grade": "12th",
  "mode": "test",
  "marks_target": 25,
  "sections": "AB",
  "sec_a_marks": 10,
  "sec_b_marks": 15,
  "sec_c_marks": 0,
  "cog_focus": "application",
  "file_id": "uuid-optional"
}
```

**Test mode parameters:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `marks_target` | int | 25 | Total marks for the test |
| `sections` | string | `"AB"` | Which sections to include: `"A"`, `"AB"`, `"ABC"` |
| `sec_a_marks` | int | 0 | Marks allocated to Section A (1-mark questions) |
| `sec_b_marks` | int | 0 | Marks allocated to Section B (4-mark questions) |
| `sec_c_marks` | int | 0 | Marks allocated to Section C (8-mark questions) |
| `cog_focus` | string | `"balanced"` | Cognitive difficulty mode (see below) |
| `file_id` | uuid | null | Restrict AI to a specific indexed file |

**Response:**
```json
{ "answer": "SECTION A — 10 MARKS\n\nQ1. ..." }
```

**If no material found:**
```json
{ "answer": "No relevant material found for this subject and grade. Please upload study materials first." }
```

---

## Cognitive Focus Modes

The `cog_focus` parameter controls what kind of questions are generated. Each mode fully overrides the section instructions — it does not just append a suggestion.

### `balanced` (default)
Mixed cognitive levels following ISC distribution:
- ~20% Recall (define/state/name)
- ~30% Understanding (explain/describe/distinguish)
- ~25% Application (case-based, identify principle)
- ~15% Analysis (interpret scenario/org chart)
- ~10% Evaluate/Create

### `recall`
Purely direct, textbook-style questions. No scenarios, no company names, no paragraphs required to answer.

**Section A:** Only define, state, true/false, fill-in-the-blank, analogy questions.

**Section B:** Direct distinction tables with bases given explicitly (e.g., "Distinguish between X and Y on any four bases"), enumerate features/importance, explain steps of a process.

**Section C:** Long-answer direct format — "Explain any five features of X" + "State three merits of Y". No case passages.

**Banned in recall mode:** Any scenario, named company, or "identify from the above case" phrasing.

### `application`
Every single question — including 1-mark Section A — requires reading and analysing a scenario. Zero direct questions.

**Section A:** Only scenario-based MCQs. A 2–3 sentence real-world situation is given; student picks which concept is illustrated.

**Section B:** Two formats only:
1. **Paragraph-based distinction** — A 4–6 sentence paragraph describes two concepts side by side without naming them. Student must (a) identify both concepts [1] and (b) distinguish on any three bases [3]. The bases are NOT given — student determines them.
2. **Scenario identify+explain** — Real company scenario → (a) identify principle/element [1] → (b) explain three features with reference to the case [3].

**Section C:** Case passages only. Every sub-question is tied to the passage. No standalone "enumerate importance of X" questions.

**Banned in application mode:** Direct definitions, True/False, fill-in-the-blank, named topics in question stems, distinction questions that give the bases upfront.

---

## ISC-Specific Prompt Engineering

The test generator prompt is built with the following ISC-specific guardrails baked in:

### Syllabus restrictions (2026)
Topics marked "meaning only" in the ISC 2026 syllabus are never asked for features, advantages, or detailed explanation — only identification or definition:
- UPI, E-Wallet / Digital Wallet
- QIP (Qualified Institutional Placement)
- Bonus Shares, Rights Issue, ESOP, Sweat Equity Shares
- Leadership Styles (Democratic, Autocratic, Laissez-faire, Bureaucratic)
- Pricing Strategies (cost-plus, competitive, skimming, penetration, value-based)
- Elements of Physical Distribution
- CPA 2023 (misleading advertisements only)

Exception: Digital Banking features can be asked — tested in the official 2025 SQP.

### Real-world scenario bank
The prompt instructs Claude to use authentic Indian business contexts:
- TCS return-to-office → Policy/Planning
- Amul pricing → Price mix, pricing strategies
- Samsung phone launch → Price skimming
- Sundar Pichai / Google → Democratic leadership
- Warren Buffett → Laissez-faire leadership
- Steve Jobs / Apple → Autocratic leadership
- Swiggy / Zomato → ESOP, staffing
- Muthoot → Debentures / NCD issuance
- Bharat Biotech / Covaxin → Publicity
- Diwali offers → Sales promotion
- Consumer court cases → CPA 2019

### Answer key format
Generated answer keys follow CISCE marking scheme conventions:
- Distinction questions: 3-column table (Basis | X | Y) with 4 rows
- Case identification: concept name + 1-line explanation of why
- Enumerate questions: point headings + 1 sentence each
- MCQ/True-False/Fill-blank: answer only
- Acceptable variants noted (e.g., "High geared / Highly geared / Trading on thin equity — all acceptable")

### Chunk count by mode
| Mode | Topic given | Chunks fetched |
|---|---|---|
| Doubt | Any | 5 |
| Test | Specific topic | 8 |
| Test | No topic (comprehensive review) | 15 |

---

## UI — Test Generator

The Test Generator UI uses a custom section marks picker (matching the time-picker component pattern used elsewhere in the dashboard).

### Controls

| Control | Description |
|---|---|
| Class + Subject | Filters indexed material dropdown |
| Study Material | Optional — restricts AI to a single indexed file |
| Topic / Unit | Optional — leave blank to cover all uploaded material |
| Section A / B / C marks | Click each section to pick marks from a dropdown panel |
| Total marks display | Auto-updates as sections are configured |
| Cognitive Focus | Radio: Balanced / Recall-heavy / Application-heavy |

### Output actions
- **Copy** — copies full test paper text to clipboard
- **Download .txt** — saves as a `.txt` file named after the topic

### Material dropdown behaviour
- Populated on `init()` by querying `files` and `material_chunks` tables
- Only shows files that have been successfully indexed (chunks exist)
- Auto-filters by selected class and grade
- Restores previous selection if still valid after filter change

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
| `supabase/functions/rag-query/index.ts` | Semantic search + Claude prompt builder + response |
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
> Both functions require `--no-verify-jwt`. Supabase's JWT gateway blocks raw `fetch` requests from the browser. This is the same reason `generate-report` uses the flag.

---

## ISC Commerce — Subject Reference (2026 Syllabus)

This section documents the ISC Commerce subject knowledge baked into the test generator prompt. It is the source of truth for unit weightages, syllabus scope, high-yield topics, and question framing patterns.

---

### Unit Weightages — Paper I Theory (80 marks)

| Unit | Topic | Marks | % of Paper |
|---|---|---|---|
| 1 | Business Environment | 7 | 8.75% |
| 2 | Financing | 20 | 25% |
| 3 | Management | 33 | 41.25% |
| 4 | Marketing | 20 | 25% |

**Implication for test generation:** Management should get ~41% of questions. Financing and Marketing get ~25% each. Business Environment is the smallest unit at ~9%.

---

### Syllabus Additions by Year (2023 baseline → 2026)

**2024 additions:**
- Banking (Unit 2) — Digital Banking, UPI, E-Wallet added (meaning only)
- Management (Unit 3) — Levels of management: meaning and functions added
- Planning (Unit 3) — "Strategy" added to types of plans
- Organising (Unit 3) — Line & Line-and-staff structures REMOVED; only Functional & Divisional retained
- Consumer Protection (Unit 4) — Difference between CPA 1986 vs CPA 2019 added

**2025 additions:**
- Business Environment (Unit 1) — Environmental scanning: meaning added
- Management Principles (Unit 3) — Relevance of Taylor & Fayol in today's business scenario added
- Consumer Protection (Unit 4) — Revised pecuniary jurisdiction (Consumer Protection Rule 21) added

**2026 additions:**
- Financing (Unit 2) — Qualified Institutional Placement (QIP): meaning only
- Staffing (Unit 3) — On-the-job vs off-the-job training methods; difference between training & development
- Leadership (Unit 3) — "Qualities of a leader" CHANGED to Leadership Styles: Democratic, Autocratic, Laissez-faire, Bureaucratic (meaning only)
- Price Mix (Unit 4) — 5 pricing strategies: cost-plus, competitive, skimming, penetration, value-based (meaning only)
- Place Mix (Unit 4) — Elements of physical distribution (meaning only)
- Consumer Protection (Unit 4) — CPA 2023 reference added (misleading advertisements only)

---

### High-Yield Topics

These topics appear across multiple years and are near-certain exam content. The test generator prioritises these when no specific topic is provided.

| Topic | Unit | Priority | Why |
|---|---|---|---|
| Shares vs Debentures | Financing | Must prep | Distinction asked every year |
| Taylor vs Fayol | Management | Must prep | Comparison always in scope; 2025+ adds real-world relevance angle |
| Marketing vs Selling | Marketing | Must prep | Distinction + traditional vs modern marketing concept |
| 4 Ps of Marketing Mix | Marketing | Must prep | Core of Unit 4; sub-elements all individually testable |
| Delegation vs Decentralisation | Management | High value | Meaning, comparison, merits & demerits all in scope |
| Maslow's Theory | Management | High value | Motivation — consistent across all years |
| Leadership Styles | Management | New 2026 | Meaning-only for all 4 styles |
| Pricing Strategies | Marketing | New 2026 | 5 strategies; meaning-only scope |

---

### Question Framing Templates by Type

These are the standard question formats used in ISC Commerce papers. The test generator uses these as templates for each section.

**Define / State the meaning of** (1–2 mark questions, 3–4 per paper)
UPI, QIP, ESOP, Factoring, Environmental scanning, Trade credit, E-wallet, Management by Exception

**Distinguish between / Compare** (4–6 mark questions, tabular format expected)
Shares vs Debentures, Bonus vs Rights shares, Equity vs Preference shares, Debit vs Credit cards, Marketing vs Selling, Formal vs Informal organisation, Delegation vs Decentralisation, Training vs Development, CPA 1986 vs CPA 2019

**Explain / Discuss / Describe** (6–8 mark questions, usually 1 per unit)
Taylor's 5 principles, Fayol's 14 principles, Functions of management, Maslow's hierarchy, Sources of finance, Consumer rights (CPA 2019), Marketing Mix elements

**State merits & demerits / Advantages & disadvantages** (4 mark questions, often 2+2 split)
Equity shares, Preference shares, Debentures, Mobile banking, e-Banking, Public deposits, Retained earnings, Centralisation / Decentralisation

---

### Paper Structure Reference

| Section | Marks | Questions | Marks per Q | Internal Choice |
|---|---|---|---|---|
| A | 16 | 16 sub-parts | 1 each | None — all compulsory |
| B | 32 | 8 questions | 4 each | 2 questions offer OR |
| C | 32 | 4 questions | 8 each | 1 question offers OR |
| **Total** | **80** | **13 questions** | | |

**Section A question types:** MCQ (4 options) · Assertion-Reason · True/False · Analogy (X:Y::Z:___) · Fill in the blank · Identify from image/org chart · State one feature or term

**Section B question types:** Distinguish (tabular, 4 points) · Case → identify + explain 3 features · Name source/type + state 3 advantages · Explain any 4 factors · Multi-part (a) identify [1] + (b) state 3 components [3]

**Section C question types:** Case passage with 4–5 sub-questions (1+1+1+1+4 or 2+2+4 split) · Two-part: concept/case [5] + factual recall [3] · Long explanation: enumerate 4 points on importance/features

---

### Recurring Patterns in Board Papers

These question patterns appear consistently across years. The AI generator is prompted to use these.

| Pattern | Frequency | Example |
|---|---|---|
| Principle violation scenario | Very high | "Two managers gave conflicting instructions to the same employee. Which Fayol principle is violated?" |
| Identify the type of plan | Very high | "TCS links salary hikes to office attendance. Identify the type of plan." |
| Banking scenario identification | Very high | "Rohit needs to transfer ₹4L to a supplier immediately. Which mode should he use?" |
| Consumer protection multi-case | Very high | "Raghav missed boarding despite reaching on time. Is his complaint valid?" |
| Maslow's hierarchy applied | High | "Employees fear job loss after restructuring. Which need level is affected?" |
| Promotion mix identification | High | "Covaxin was covered extensively in news media. Identify the element of promotion mix." |
| Levels of management from scenario | High | "Priya develops company goals and strategies. At which level does she work?" |
| Leadership styles (new 2026) | Emerging | "Sundar Pichai fosters collaboration → Democratic. Warren Buffett → Laissez-faire." |
| Pricing strategies (new 2026) | Emerging | "Samsung launched a new phone at ₹1.5L, then reduced price after 6 months. Name the strategy." |

---

## Important Notes

- **Model:** `claude-sonnet-4-5` is used for test generation. Haiku was the original model but was replaced due to inconsistent formatting on complex structured output.
- **File format:** Currently supports plain text (`.txt`) and text-extractable files. PDF text extraction requires additional parsing (future improvement).
- **Embedding model:** `voyage-3-lite` → 512-dimensional vectors. Both `material_chunks` table and `match_chunks` function are configured for 512 dimensions.
- **Re-uploads:** Uploading a new version of a file automatically re-indexes it — old chunks are deleted first.
- **Grade must be set:** Files uploaded without a grade will not be found by similarity search when no `file_id` is specified. Always select a grade when uploading.
- **Token limits:** `max_tokens` is set to 4000 for standard test papers and 6000 for full-material comprehensive papers.
- **Cost:** Voyage AI free tier covers current scale. Embedding a full chapter costs a fraction of a cent.
