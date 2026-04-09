import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Hash a question for cache lookup ────────────────────────
async function hashQuestion(q: string): Promise<string> {
    const normalized = q.toLowerCase().replace(/\s+/g, " ").trim();
    const data = new TextEncoder().encode(normalized);
    const buf = await crypto.subtle.digest("SHA-256", data);
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}

// ── Embed a single query using Voyage AI ─────────────────────
async function embedQuery(text: string): Promise<number[]> {
    const res = await fetch("https://api.voyageai.com/v1/embeddings", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${Deno.env.get("VOYAGE_API_KEY")}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            model: "voyage-3-lite",
            input: [text],
        }),
    });

    if (!res.ok) {
        const err = await res.json();
        throw new Error(`Voyage AI error: ${JSON.stringify(err)}`);
    }

    const data = await res.json();
    return data.data[0].embedding;
}

// ── Cosine similarity (bypasses PostgREST vector type issues) ──
function cosineSim(a: number[], b: number[]): number {
    let dot = 0, magA = 0, magB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        magA += a[i] * a[i];
        magB += b[i] * b[i];
    }
    const denom = Math.sqrt(magA) * Math.sqrt(magB);
    return denom === 0 ? 0 : dot / denom;
}

function parseEmbedding(v: any): number[] {
    if (Array.isArray(v)) return v as number[];
    if (typeof v === "string") return JSON.parse(v) as number[];
    return [];
}

async function fetchSimilarChunks(
    embedding: number[],
    subject: string,
    grade: string,
    file_id: string | undefined,
    count: number,
    threshold: number,
): Promise<Array<{ content: string; file_id: string; similarity: number }>> {
    let query = supabase.from("material_chunks").select("content, embedding, file_id");
    if (file_id) {
        query = query.eq("file_id", file_id);
    } else {
        query = query.eq("subject", subject).eq("grade", grade);
    }
    const { data, error } = await query;
    if (error) throw new Error(`Chunk fetch error: ${error.message}`);
    return (data || [])
        .map((c: any) => ({
            content: c.content as string,
            file_id: c.file_id as string,
            similarity: cosineSim(embedding, parseEmbedding(c.embedding)),
        }))
        .filter(c => c.similarity >= threshold)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, count);
}

// ── Doubt Solver Prompts ──────────────────────────────────────
function buildDoubtSystemPrompt(context: string): string {
    return `You are an expert tutor for ISC Class 12 Commerce and Accountancy at Mitesh Sir's Study Circle, Mumbai.

Your job is to give students thorough, exam-ready answers. Use the study material excerpts below as your primary source — follow their structure, terminology, acronyms, and examples exactly. Where the excerpts give a definition, point list, or case example, reproduce and explain it fully. You may expand on points with clear reasoning and relevant Indian business examples to deepen understanding, as long as you stay true to the material's content and ISC exam style.

If the topic is not covered at all in the excerpts, respond ONLY with: "This topic may not be in the uploaded materials yet. Please ask your teacher directly." — nothing else.

--- STUDY MATERIAL EXCERPTS ---
${context}
--- END ---`;
}

function buildDoubtUserInstruction(): string {
    return `Give a complete, well-structured answer suitable for ISC exam preparation. Follow the study material's own format — if it uses numbered points, acronyms, or tables, use the same. Explain each point fully: definition, significance, and example where applicable. Do not pad with filler phrases or meta-commentary.

Use markdown formatting (bold headings, numbered lists, tables) to organise the answer clearly.

After your answer, write "---SUGGESTIONS---" on a new line followed by 2-3 brief follow-up questions the student might ask next, each on its own line.`;
}

// ── ISC Test Paper Prompt ─────────────────────────────────────
// marksTarget: total marks for the test (e.g. 20, 25, 40, 80)
// sections: which sections to include e.g. "A", "AB", "ABC"
// cogFocus: "balanced" | "recall" | "application"
function buildTestPrompt(
    topic: string,
    context: string,
    marksTarget: number,
    sections: string,
    cogFocus: string,
    subject: string,
    grade: string,
    secAMarks: number,
    secBMarks: number,
    secCMarks: number,
): string {

    // ── Build section instructions using per-section marks ──────
    const includeA = sections.includes("A") && secAMarks > 0;
    const includeB = sections.includes("B") && secBMarks > 0;
    const includeC = sections.includes("C") && secCMarks > 0;
    let sectionInstructions = "";

    if (includeC) {
        const aMarks = secAMarks;
        const bMarks = secBMarks;
        const cMarks = secCMarks;
        const bCount = Math.round(bMarks / 4);
        const cCount = Math.round(cMarks / 8);
        const sectionAPart = includeA ? `SECTION A — ${aMarks} MARKS (all compulsory, no internal choice)
Question 1 has sub-parts (i) through (xiv). Each sub-part carries [1] mark, except those with two internal parts (a) and (b) which carry [2] marks total. Number as (i), (ii), (iii)... NOT Q1, Q2, Q3.

Exact mix (follow this distribution):
- 6-7 scenario-based MCQs with 4 options [1 mark each]
- 1 Assertion-Reason question [1 mark] — preamble: "Given below are two statements marked Assertion and Reason. Read the statements carefully and choose the correct option." Options EXACTLY:
  (a) Both Assertion and Reason are true and Reason is the correct explanation for Assertion.
  (b) Both Assertion and Reason are true but Reason is not the correct explanation for Assertion.
  (c) Assertion is true and Reason is false.
  (d) Both Assertion and Reason are false.
- 1 Analogy with two parts (a) and (b) [2 marks total]
- 1 True/False with two parts (a) and (b) [2 marks total]
- 2-3 Fill in the blank / Identify from diagram or image [1 mark each]
- 2-3 Scenario → identify the concept (open answer, no MCQ options) [1 mark each]

` : "";
        const sectionBPart = includeB ? `SECTION B — ${bMarks} MARKS (${bCount} questions × 4 marks each, internal choice in 2 questions — for those, provide (i) OR (ii) format)
At least 6 out of 8 questions (~75%) MUST be case/scenario-based. Use a MIX of:
- "[Case scenario] — Name and explain the [type/source/method] used." (Understanding)
- "[Case scenario] — Which principle/concept of Henri Fayol can be applied? Explain." (Application, 2+2 split)
- "[Case scenario] — (i) State the [level/type]. [1] (ii) Discuss any three [functions/features]. [3]" (Understanding)
- "As a [role in a scenario], explain four [features/factors/objectives] of [concept]." (Understanding with role-play framing)
- "[Case scenario] — Enumerate any four distinctions between [X] and [Y]." (Analysis, tabular with common basis)
The remaining 2 questions may be direct format:
- "Explain any four [importance/features/characteristics/objectives] of [concept]." (Understanding)
- "Discuss the interplay/relationship between [X] and [Y]." (Understanding)
Use ISC action verbs: Explain, Outline, Elucidate, Illustrate, Discuss, Enumerate, Compare, Evaluate.
At least 3 questions should use a named Indian company or person in a scenario.

` : "";
        sectionInstructions = `${sectionAPart}${sectionBPart}SECTION C — ${cMarks} MARKS (${cCount} questions × 8 marks each, internal choice in 1 question — provide alternate (i)+(ii) OR (iii)+(iv), both sub-parts replaced as a pair)

Use TWO split patterns — ~75% should be 5+3, ~25% should be 2+2+2+2:

PATTERN A — 5+3 split (use for 3 out of 4 questions):
  (i) [5 marks] — Use one of these formats:
    • "Explain any five [importance/objectives/points] of [concept]"
    • "Evaluate three advantages and two disadvantages of [concept]" (3+2=5)
    • "[Scenario] — Which [type/security]? Explain any four features" (1+4=5)
    • "Name and explain [technique/concept] with its components"
    • "Justify the statement by explaining any five [objectives/reasons]"
  (ii) [3 marks] — Related but different sub-topic:
    • "Explain any three differences between [X] and [Y]"
    • "State any three features of [concept]"
    • "Identify and explain three [rights/elements/types]"

PATTERN B — 2+2+2+2 split (use for 1 out of 4 questions, typically Q13 passage-based):
  Present a case passage (8-12 sentences) about a realistic business situation. Include "(Source (edited): [author/publication])". Follow with 3-4 sub-questions:
  (i) [2 marks] — Identify/discuss concepts from the passage (Analysis)
  (ii) [2 marks] — Mention objectives/features with reference to the case (Understanding)
  (iii) [2 marks] — Apply/evaluate a specific aspect of the case (Application)
  (iv) [2 marks] — Suggest/recommend based on the passage (Analysis)
  OR use a 2+2+4 variant: (i)[2] + (ii)[2] + (iii)[4]`;

    } else if (includeB) {
        const aMarks = secAMarks;
        const bMarks = secBMarks;
        const bCount = Math.round(bMarks / 4);
        const sectionAPart = includeA ? `SECTION A — ${aMarks} MARKS (all compulsory, no internal choice)
Question 1 has sub-parts (i) through (xiv). Number as (i), (ii), (iii)... NOT Q1, Q2, Q3.
Mix: 6-7 scenario-based MCQs (4 options), 1 Assertion-Reason (use exact ISC 4-option format), 1 Analogy [2 marks], 1 True/False [2 marks], 2-3 fill-in-the-blank or identify-from-diagram, 2-3 scenario→identify-term (no options).

` : "";
        sectionInstructions = `${sectionAPart}SECTION B — ${bMarks} MARKS (${bCount} questions × 4 marks each)
At least 75% of questions MUST be case/scenario-based. Use a MIX of:
- "[Case scenario] — Name and explain the [type/source/method] used." (Understanding)
- "[Case scenario] — Which principle/concept can be applied? Explain." (Application)
- "[Case scenario] — (i) State the [level/type]. [1] (ii) Discuss any three [functions/features]. [3]"
- "As a [role in a scenario], explain four [features/factors/objectives] of [concept]." (Understanding)
- "[Case scenario] — Enumerate any four distinctions between [X] and [Y]." (Analysis, tabular)
The remaining may be direct:
- "Explain any four [importance/features/characteristics] of [concept]." (Understanding)
- "Discuss the interplay/relationship between [X] and [Y]." (Understanding)
At least 3 questions MUST use a real-world scenario with a named Indian company or person (Amul, TCS, Samsung, Swiggy, Reliance, or a fictional person like Rajan/Meera/Siddhi).`;

    } else {
        // Section A only
        const aMarks = secAMarks || marksTarget;
        sectionInstructions = `SECTION A — ${aMarks} MARKS
Question 1 has sub-parts (i) through (xiv). Number as (i), (ii), (iii)... NOT Q1, Q2, Q3.
Mix: 6-7 scenario-based MCQs (4 options), 1 Assertion-Reason [use exact ISC format: (a) Both Assertion and Reason are true and Reason is the correct explanation for Assertion. (b) Both...but not the correct explanation... (c) Assertion is true and Reason is false. (d) Both Assertion and Reason are false.], 1 Analogy [2 marks], 1 True/False [2 marks], 2-3 fill-in-the-blank or identify-from-diagram, 2-3 scenario→identify-term (no options).`;
    }

    // ── Cognitive level guidance ────────────────────────────────
    const cogGuidance: Record<string, string> = {
        balanced: "Mix cognitive levels: ~55% Application (identify principle from scenario, suggest suitable option for case, name and explain from situation), ~35% Analysis (evaluate case, identify concept from complex scenario, compare, justify), ~10% Understanding (explain/describe/discuss). Aim for ZERO pure Recall questions — even definitional content should be wrapped in a scenario. Tag each question with its cognitive domain in parentheses after the question: (Application), (Analysis), (Understanding).",
        recall: "Focus on Recall and Understanding levels (~50% Recall: define/state/name/True-False, ~30% Understanding: explain/distinguish/describe, ~20% Application). Tag each question with its cognitive domain in parentheses: (Recall), (Understanding), (Application).",
        application: `ZERO DIRECT QUESTIONS in Section A. Every Section A question must begin with a scenario, case paragraph, or real-world situation. The student must extract, identify, or apply concepts. Never name the concept in the question stem.
Tag each question with its cognitive domain in parentheses: (Application), (Analysis), (Evaluate), (Understanding).

STRICT RULES FOR APPLICATION MODE:

Section A (1-mark): ONLY scenario-based MCQs or identify-from-case questions.
- BANNED: "Define X", "State one feature of X", "True or False: X is...", "Fill in the blank: X is called ___"
- REQUIRED: Give a 2-3 sentence scenario. Ask "Which concept / principle / element is illustrated here?" or "What should [person] do in this situation?" with 4 options.
- ALSO ALLOWED: Case passage followed by 4 statements (P, Q, R, S). Ask "Which combination is correct?" with options like (a) Only (P) and (Q), (b) Only (Q) and (R), etc. — tests analysis of the passage.

Section B: At least 5 out of 8 questions MUST be scenario/case-based.
- "[Case scenario] — Name and explain the [type/source/method] used."
- "[Case scenario] — Which principle/concept can be applied? Explain." (2+2 split)
- "[Case scenario] — (i) State the [level/type]. [1] (ii) Discuss three [functions/features]. [3]"
- Paragraph-based distinction: Describe two concepts in a business situation without naming them. Ask "(a) Identify the two concepts [1] (b) Distinguish between them on any three bases [3]"
The remaining 2-3 may use direct format WITH analytical framing:
- "Discuss the interplay between X and Y" (Understanding)
- "As a [role], explain four [features/factors/objectives]" (Understanding)
- "Evaluate three advantages and two disadvantages of [concept]" (Evaluate)
BANNED: Plain "Explain any four features of X" without any scenario or analytical framing.

Section C: Follow the standard 5+3 split. Questions 10-12: (i)[5] + (ii)[3]. Question 13: Reading passage with 2-3 sub-questions. At least Q13 must be a full case passage.`,
    };

    // ── Recall mode: override section instructions ──────────────
    if (cogFocus === "recall") {
        const includeA = sections.includes("A") && secAMarks > 0;
        const includeB = sections.includes("B") && secBMarks > 0;
        const includeC = sections.includes("C") && secCMarks > 0;

        const recA = includeA ? `SECTION A — ${secAMarks} MARKS
Question 1 has sub-parts (i) through (xiv). Number as (i), (ii), (iii)... NOT Q1, Q2, Q3.
ONLY use these direct recall question types — NO scenarios, NO case paragraphs:
- "Define [term]." or "What is meant by [term]?"
- "State one feature / advantage / function of [concept]."
- "True or False: [direct factual statement about a concept]." (two parts (a) and (b), [2 marks total])
- "Fill in the blank: [Sentence describing a conceptual relationship with one key term blanked out]."
- "Analogy: X : Y :: Z : ___" (two parts (a) and (b), [2 marks total])
- "Name the type of [shares/plan/source] that [brief factual description]."
- 1 Assertion-Reason question with exact ISC format: (a) Both Assertion and Reason are true and Reason is the correct explanation for Assertion. (b) Both...but not the correct explanation... (c) Assertion is true and Reason is false. (d) Both Assertion and Reason are false.
Every question must be answerable with a single word, phrase, or one sentence.

` : "";

        const recB = includeB ? `SECTION B — ${secBMarks} MARKS (${Math.round(secBMarks / 4)} questions × 4 marks each)
ONLY use these direct recall/understanding formats — NO case scenarios, NO company names, NO paragraphs:
- "Distinguish between [X] and [Y] on any four bases." (tabular format — give the bases explicitly e.g. Basis of Meaning / Basis of Risk / Basis of Control)
- "Explain any four features / advantages / disadvantages of [concept]."
- "State any four points on the importance / significance of [concept]."
- "What is [concept]? State any three characteristics of [concept]."
- "Explain the steps / procedure of [process] in brief."
Questions must be purely textbook/definitional. Students answer from memory, not by reading a situation.
BANNED in recall Section B: Any scenario, any named company, any "identify from the above case" phrasing.

` : "";

        const recC = includeC ? `SECTION C — ${secCMarks} MARKS (${Math.round(secCMarks / 8)} questions × 8 marks each)
Use TWO split patterns — ~75% should be 5+3, ~25% should be 2+2+2+2:

PATTERN A — 5+3 split (3 out of 4 questions):
(i) [5 marks] — direct long-answer formats:
  • "What is [concept]? Explain any four [components/functions/steps]." (1+4=5)
  • "Explain the importance of [concept] by giving any five points."
  • "Explain any three advantages and two disadvantages of [concept]." (3+2=5)
(ii) [3 marks] — related sub-topic:
  • "Distinguish between [X] and [Y] on any three bases."
  • "State any three features/types of [related concept]."

PATTERN B — 2+2+2+2 split (1 out of 4 questions):
  (i) [2 marks] — "Define [concept] and state one key feature."
  (ii) [2 marks] — "Explain two [types/components] of [concept]."
  (iii) [2 marks] — "State two [advantages/differences]."
  (iv) [2 marks] — "Name and explain two [related terms]."
BANNED in recall Section C: Full case passages requiring inference or identification. Students should answer purely from textbook knowledge.` : "";

        sectionInstructions = `${recA}${recB}${recC}`.trim();
    }

    // ── Application mode: override section instructions ─────────
    if (cogFocus === "application") {
        const includeA = sections.includes("A") && secAMarks > 0;
        const includeB = sections.includes("B") && secBMarks > 0;
        const includeC = sections.includes("C") && secCMarks > 0;

        const appA = includeA ? `SECTION A — ${secAMarks} MARKS
Question 1 has sub-parts (i) through (xiv). Number as (i), (ii), (iii)... NOT Q1, Q2, Q3.
Every question MUST be scenario-based. Format:
"[2-3 sentence real-world scenario describing a situation without naming the concept]. Which [principle / element / type of plan / level of management / source of finance] is being illustrated here?"
(a) Option 1  (b) Option 2  (c) Option 3  (d) Option 4
ALSO ALLOWED:
- Case passage with 4 statements (P, Q, R, S), "Which combination is correct?" with options like (a) Only (P) and (Q), etc.
- 1 Assertion-Reason (use exact ISC 4-option format)
- Scenario → identify term (no MCQ options, open answer) [1 mark each]
NO "Define X", NO fill-in-the-blank, NO direct True/False.

` : "";

        const appB = includeB ? `SECTION B — ${secBMarks} MARKS (${Math.round(secBMarks / 4)} questions × 4 marks each)
At least 5 out of 8 questions MUST be scenario/case-based:

FORMAT 1 — Paragraph-based distinction:
Write a 4-6 sentence paragraph describing two concepts in a real business situation. Do NOT name either concept. Then ask:
"(a) Identify the two concepts described in the above paragraph. [1]
 (b) Distinguish between them on any three bases in tabular format. [3]"

FORMAT 2 — Scenario identify+explain:
Give a 3-4 sentence real company scenario (Amul, TCS, Samsung, Swiggy etc.). Ask:
"(a) Identify the [principle / element / type / level] illustrated in the above case. [1]
 (b) Explain any three [features / advantages / functions] of the identified [concept]. [3]"

FORMAT 3 — Case + principle application:
"[Case scenario] — Which principle/concept of Henri Fayol can be applied? Explain." (2+2 split)

The remaining 2-3 questions may use direct format WITH analytical framing:
- "Discuss the interplay between [X] and [Y]." (Understanding)
- "As a [role], explain four [features/objectives] of [concept]." (Understanding)
- "Evaluate three advantages and two disadvantages of [concept]." (Evaluate)
BANNED: Plain "Explain any four features of X" without any framing.

` : "";

        const appC = includeC ? `SECTION C — ${secCMarks} MARKS (${Math.round(secCMarks / 8)} questions × 8 marks each)
Use TWO split patterns — ~75% should be 5+3, ~25% should be 2+2+2+2:

PATTERN A — 5+3 split (use for 3 out of 4 questions):
  (i) [5 marks] — Case/scenario-based:
    • "[Scenario] — Which [type/security]? Explain any four features" (1+4=5)
    • "Evaluate three advantages and two disadvantages of [concept] as a [role]" (3+2=5)
    • "Justify the statement by explaining any five [objectives/reasons]"
  (ii) [3 marks] — Related sub-topic:
    • "Explain any three differences between [X] and [Y]"
    • "State and explain any three [rights/features/elements]"
    • "Identify [concept] and state any two features"

PATTERN B — 2+2+2+2 split (use for 1 question, typically Q13 as a reading passage):
  Write a passage of 8-12 sentences about a realistic Indian business situation. Include "(Source (edited): [realistic publication])". Follow with 3-4 sub-questions:
  (i) [2 marks] — Identify/discuss concepts from the passage (Analysis)
  (ii) [2 marks] — Mention objectives/features with reference to the case (Understanding)
  (iii) [2 marks] — Apply/evaluate a specific aspect (Application)
  (iv) [2 marks] — Suggest/recommend (Analysis)
All sub-questions must reference the passage.` : "";

        sectionInstructions = `${appA}${appB}${appC}`.trim();
    }

    // ── Meaning-only guardrails ─────────────────────────────────
    const meaningOnlyWarning = `
CRITICAL SYLLABUS RESTRICTIONS (2026 ISC Commerce — DO NOT VIOLATE):
The following topics are "meaning only" in scope. NEVER ask for features, advantages, disadvantages, or detailed explanation of these — only definition/identification/meaning questions are valid:
- UPI, E-Wallet / Digital Wallet
- QIP (Qualified Institutional Placement)
- Bonus Shares, Rights Issue, ESOP, Sweat Equity Shares — only meaning, NOT features or merits
- Leadership Styles (Democratic, Autocratic, Laissez-faire, Bureaucratic) — only meaning/identification
- Pricing Strategies (cost-plus, competitive, price-skimming, penetration, value-based) — only meaning/identification
- Elements of Physical Distribution — only meaning
- CPA 2019 (amended 2023) — provisions regarding misleading advertisements CAN be asked in detail (penalties, endorser liability, CCPA powers). Other CPA sections: only meaning/identification.
Digital Banking — features CAN be asked (3 features were tested in official SQP)

HIGH-WEIGHT TOPIC: Banking and Latest Trends in Banking is the MOST frequently tested topic in CISCE competency papers and SQPs. Include at least 3-4 questions on banking across sections, covering: RTGS/NEFT/IMPS differences and features, e-banking features, UPI and digital wallets (meaning only), debit vs credit cards, ATM features, CBS, MMID, bank drafts, SMS alerts.`;

    // ── Answer key format ───────────────────────────────────────
    const answerKeyFormat = `
ANSWER KEY FORMAT (after all questions):
Write "ANSWER KEY" as a heading, then "SECTION A — 16 MARKS", "SECTION B — 32 MARKS", "SECTION C — 32 MARKS".
For each question, provide:
- For MCQ/True-False/Fill-blank/Analogy: just the answer, e.g. "(c) or Public Deposits"
- For distinction questions: a 3-column table (Basis | X | Y) with 4 rows
- For case identification questions: Name of principle/concept + 1-line explanation of why
- For explain/enumerate questions: Bulleted list of point headings + 1 sentence each
- For Section C 5+3 questions: separate answers for (i) and (ii)
- Where multiple valid answers exist, note alternatives: "(Also accept: Operating level / Supervisory level)"
- Include italicised guidance notes like real CISCE marking schemes: "(Candidates are required to explain any four factors. Each point must be explained briefly.)"
Do NOT write exhaustive answers. Match the concise style of CISCE marking schemes.
End with: "Note: The above answers are indicative. Accept any valid alternative."`;

    // ── Real-world examples to use ──────────────────────────────
    const realWorldExamples = `
PREFERRED REAL-WORLD EXAMPLES FOR SCENARIOS:
- TCS return-to-office mandate → Policy / Planning
- Amul pricing → Price mix, pricing strategies
- Samsung new phone launch → Price skimming
- Sundar Pichai / Google → Democratic leadership
- Warren Buffett → Laissez-faire leadership
- Steve Jobs / Apple → Autocratic leadership
- Swiggy / Zomato → ESOP, short-term finance, staffing
- Muthoot → Debentures / NCD issuance
- Bharat Biotech / Covaxin → Publicity (promotion mix)
- Diwali seasonal offers → Sales promotion
- Consumer court cases → CPA 2019, consumer rights
- Supreme Court firecracker ban → Legal/Political environment (Business Environment)
- Celebrity endorsing weight loss pills → CPA misleading advertisements, CCPA powers
- Naval Academy submarine training → Vestibule training / Safety training
- Tech start-up retaining talent → Sweat equity shares
- Café owner choosing debit vs credit card → Banking comparison
- School budget allocation → Budget as a type of plan
- Mobile phone pricing (high launch → price drop) → Price skimming + Competitive pricing
- Soft Skills Training Academy → Services and their features
- RTGS ₹4 lakh transfer → RTGS vs NEFT (Banking)
- College student using phone payments → UPI / E-Wallet (Banking)
- Fraudulent ATM withdrawals → E-banking risks, SMS alerts (Banking)
- Face serum without storage instructions → Right to be informed (Consumer Protection)
- Builder not giving plot possession → Right to be heard, CDRC (Consumer Protection)
Use these OR invent similar realistic scenarios with named fictional people (Rajan, Meera, Siddhi, Asha, Vivek, Arjun, Shreya, Prerna).`;

    return `You are an expert ISC Commerce question paper setter for Class ${grade} students following the 2026 syllabus.
Institution: Mitesh Sir's Study Circle, Mumbai
Subject: ${subject} | Grade: ${grade}${topic ? ` | Topic/Unit: ${topic}` : " | Scope: Cover ALL topics from the provided study material excerpts comprehensively"}
Total marks: ${marksTarget}

The paper header must read:
MITESH SIR'S STUDY CIRCLE
${subject.toUpperCase()} — CLASS ${grade}
${topic ? topic.toUpperCase() + " TEST" : "PRACTICE TEST"}
Maximum Marks: ${marksTarget}

${sectionInstructions}

COGNITIVE LEVEL DISTRIBUTION:
${cogGuidance[cogFocus] ?? cogGuidance["balanced"]}

${meaningOnlyWarning}

${realWorldExamples}

STUDY MATERIAL CONTEXT (use this as the source of content — questions must be answerable from this):
--- EXCERPTS ---
${context}
--- END ---

FORMATTING RULES:
- Do NOT use markdown (no **, no ##, no bullet points in questions)
- Number Section A as Question 1 (i), (ii), (iii)... Section B as Question 2, 3, 4... Section C as Question 10, 11, 12, 13
- Show marks in square brackets [1], [2], [4], [8] at the end of each question/part
- After each question/sub-part, include the cognitive domain in parentheses: (Recall), (Understanding), (Application), (Analysis), (Evaluate)
- For internal choices write "OR" centred between the two options
- Write in the formal ISC examination style — same tone as the board paper
- Use ISC action verbs: Explain, Outline, Elucidate, Illustrate, Discuss, Enumerate, Compare, Evaluate, Justify, Suggest
- After all questions, write the complete Answer Key

${answerKeyFormat}

Now generate the complete test paper.`;
}

// ── Main handler ─────────────────────────────────────────────
Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const {
            query,
            subject,
            grade,
            mode,
            marks_target,
            sections,
            cog_focus,
            file_id,
            sec_a_marks,
            sec_b_marks,
            sec_c_marks,
            conversation_history,
            session_chunks,
        } = await req.json();

        if (!query || !subject || !grade || !mode) {
            return new Response(
                JSON.stringify({ error: "Missing required fields: query, subject, grade, mode" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // ── DOUBT MODE ──────────────────────────────────────────
        if (mode === "doubt") {
            const history = Array.isArray(conversation_history) ? conversation_history : [];

            // 1. Cache check (skip if conversation has history — context-dependent)
            if (history.length === 0) {
                const qHash = await hashQuestion(query);
                const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
                const { data: cached } = await supabase
                    .from("doubt_cache")
                    .select("answer, sources, suggestions")
                    .eq("question_hash", qHash)
                    .eq("subject", subject)
                    .eq("grade", grade)
                    .gte("created_at", sevenDaysAgo)
                    .maybeSingle();

                if (cached) {
                    return new Response(
                        JSON.stringify({
                            answer: cached.answer,
                            sources: cached.sources,
                            suggestions: cached.suggestions,
                            cached: true,
                        }),
                        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                    );
                }
            }

            // 2. Embed + vector search (skip if client sent session_chunks for follow-ups)
            const providedChunks = Array.isArray(session_chunks) && session_chunks.length > 0 && history.length > 0;
            let chunks: Array<{ content: string; file_id: string; similarity: number }>;
            if (providedChunks) {
                chunks = (session_chunks as Array<{ content: string; file_id: string }>).map(c => ({ ...c, similarity: 1 }));
            } else {
                const embedding = await embedQuery(query);
                chunks = await fetchSimilarChunks(embedding, subject, grade, file_id, 5, 0.3);
            }

            if (chunks.length === 0) {
                return new Response(
                    JSON.stringify({
                        answer: "No relevant material found for this subject and grade. Please upload study materials first.",
                        sources: [],
                        suggestions: [],
                    }),
                    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }

            // 4. Resolve source file titles
            const fileIds = [...new Set(chunks.map((c: any) => c.file_id).filter(Boolean))];
            let sources: Array<{ file_id: string; title: string }> = [];
            if (fileIds.length > 0) {
                const { data: fileRecords } = await supabase
                    .from("files")
                    .select("id, title")
                    .in("id", fileIds);
                sources = (fileRecords || []).map((f: any) => ({ file_id: f.id, title: f.title }));
            }

            // 5. Build context and prompts
            const context = chunks
                .map((c: any, i: number) => `[Excerpt ${i + 1}]:\n${c.content}`)
                .join("\n\n");

            const systemPrompt = buildDoubtSystemPrompt(context);
            const userInstruction = buildDoubtUserInstruction();

            // Build proper messages array: history turns + new question
            const messages: Array<{ role: string; content: string }> = [];
            for (const h of history.slice(-3)) {
                messages.push({ role: "user",      content: h.question });
                messages.push({ role: "assistant", content: h.answer   });
            }
            messages.push({ role: "user", content: `${query}\n\n${userInstruction}` });

            // 6. Call Claude with streaming + prompt caching
            const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
                method: "POST",
                headers: {
                    "x-api-key": Deno.env.get("ANTHROPIC_API_KEY")!,
                    "anthropic-version": "2023-06-01",
                    "anthropic-beta": "prompt-caching-2024-07-31",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    model: "claude-sonnet-4-5-20250929",
                    max_tokens: 2048,
                    system: [
                        { type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } },
                    ],
                    messages,
                    stream: true,
                }),
            });

            if (!claudeRes.ok) {
                const err = await claudeRes.json();
                throw new Error(`Claude error: ${JSON.stringify(err)}`);
            }

            // 7. Stream SSE through to client
            let fullText = "";
            const encoder = new TextEncoder();
            const reader = claudeRes.body!.getReader();
            const decoder = new TextDecoder();

            const stream = new ReadableStream({
                async start(controller) {
                    let buffer = "";
                    try {
                        while (true) {
                            const { done, value } = await reader.read();
                            if (done) break;

                            buffer += decoder.decode(value, { stream: true });
                            const lines = buffer.split("\n");
                            buffer = lines.pop() || "";

                            for (const line of lines) {
                                if (!line.startsWith("data: ")) continue;
                                const jsonStr = line.slice(6).trim();
                                if (!jsonStr || jsonStr === "[DONE]") continue;

                                try {
                                    const evt = JSON.parse(jsonStr);
                                    if (evt.type === "content_block_delta" && evt.delta?.text) {
                                        fullText += evt.delta.text;
                                        controller.enqueue(
                                            encoder.encode(`data: ${JSON.stringify({ text: evt.delta.text })}\n\n`)
                                        );
                                    }
                                } catch {
                                    // skip malformed lines
                                }
                            }
                        }

                        // Parse suggestions from accumulated text
                        const [answerPart, suggestionsPart] = fullText.split("---SUGGESTIONS---");
                        const cleanAnswer = (answerPart || fullText).trim();
                        const suggestions = suggestionsPart
                            ? suggestionsPart.trim().split("\n").map(s => s.trim()).filter(s => s && s.length > 5).slice(0, 3)
                            : [];

                        // Send final event with metadata + chunks for session reuse
                        const returnChunks = chunks.map((c: any) => ({ content: c.content, file_id: c.file_id }));
                        controller.enqueue(
                            encoder.encode(`data: ${JSON.stringify({ done: true, sources, suggestions, session_chunks: returnChunks })}\n\n`)
                        );

                        // Cache the result (fire-and-forget)
                        const qHash = await hashQuestion(query);
                        supabase.from("doubt_cache").upsert({
                            question_hash: qHash,
                            subject,
                            grade,
                            question_text: query,
                            answer: cleanAnswer,
                            sources,
                            suggestions,
                        }, { onConflict: "question_hash,subject,grade" }).then(() => {});

                        controller.close();
                    } catch (err) {
                        controller.enqueue(
                            encoder.encode(`data: ${JSON.stringify({ error: (err as Error).message })}\n\n`)
                        );
                        controller.close();
                    }
                },
            });

            return new Response(stream, {
                headers: {
                    ...corsHeaders,
                    "Content-Type": "text/event-stream",
                    "Cache-Control": "no-cache",
                    "Connection": "keep-alive",
                },
            });
        }

        // ── TEST MODE (unchanged) ───────────────────────────────
        // 1. Embed the query
        const embedding = await embedQuery(query);

        // 2. Vector search — fetch more chunks for test mode (needs broader context)
        const isFullMaterial = query.includes("comprehensive review");
        const chunkCount = isFullMaterial ? 15 : 8;
        const chunks = await fetchSimilarChunks(embedding, subject, grade, file_id, chunkCount, 0);

        if (chunks.length === 0) {
            return new Response(
                JSON.stringify({
                    answer: "No relevant material found for this subject and grade. Please upload study materials first.",
                }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // 3. Build context from chunks
        const context = chunks
            .map((c: any, i: number) => `[Excerpt ${i + 1}]:\n${c.content}`)
            .join("\n\n");

        // 4. Build prompt
        const marksTarget = marks_target ?? 25;
        const sectionConfig = sections ?? "AB";
        const cogConfig = cog_focus ?? "balanced";
        const aMarks = sec_a_marks ?? 0;
        const bMarks = sec_b_marks ?? 0;
        const cMarks = sec_c_marks ?? 0;
        const prompt = buildTestPrompt(query, context, marksTarget, sectionConfig, cogConfig, subject, grade, aMarks, bMarks, cMarks);
        const maxTokens = isFullMaterial ? 6000 : 4000;

        // 5. Call Claude
        const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
                "x-api-key": Deno.env.get("ANTHROPIC_API_KEY")!,
                "anthropic-version": "2023-06-01",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "claude-sonnet-4-5-20250929",
                max_tokens: maxTokens,
                messages: [{ role: "user", content: prompt }],
            }),
        });

        if (!claudeRes.ok) {
            const err = await claudeRes.json();
            throw new Error(`Claude error: ${JSON.stringify(err)}`);
        }

        const claudeData = await claudeRes.json();
        const answer = claudeData.content[0].text;

        return new Response(
            JSON.stringify({ answer }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (err) {
        console.error("rag-query error:", err.message);
        return new Response(
            JSON.stringify({ error: err.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
