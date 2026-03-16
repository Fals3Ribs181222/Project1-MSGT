import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

// ── Prompts ───────────────────────────────────────────────────
function buildDoubtPrompt(question: string, context: string): string {
    return `You are a helpful tutor assistant for an Indian commerce/accounts tuition centre.

Use ONLY the following excerpts from the teacher's study materials to answer the student's question.
If the answer isn't covered in the excerpts, say: "This topic may not be in the uploaded materials yet. Please ask your teacher directly."

--- STUDY MATERIAL EXCERPTS ---
${context}
--- END ---

Student's question: ${question}

Answer clearly and concisely. Use the same method and terminology as in the study material. Do not use markdown.`;
}

function buildTestPrompt(topic: string, context: string): string {
    return `You are creating a test paper for Indian commerce/accounts students.

Use ONLY the following excerpts from the teacher's notes to generate questions.

--- STUDY MATERIAL EXCERPTS ---
${context}
--- END ---

Generate a test paper on: ${topic}

Format:
- Section A: 5 short questions (2 marks each)
- Section B: 3 long/numerical questions (5 marks each)
- Answer Key at the end

Use the exact terminology and methods from the notes above. Do not use markdown formatting.`;
}

// ── Main handler ─────────────────────────────────────────────
Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const { query, subject, grade, mode } = await req.json();
        // mode = 'doubt' | 'test'

        if (!query || !subject || !grade || !mode) {
            return new Response(
                JSON.stringify({ error: "Missing required fields: query, subject, grade, mode" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // 1. Embed the query
        const embedding = await embedQuery(query);

        // 2. Vector search for relevant chunks
        const { data: chunks, error: searchError } = await supabase.rpc("match_chunks", {
            query_embedding: embedding,
            match_subject: subject,
            match_grade: grade,
            match_count: 5,
        });

        if (searchError) throw new Error(`Search error: ${searchError.message}`);

        if (!chunks || chunks.length === 0) {
            return new Response(
                JSON.stringify({ answer: "No relevant material found for this subject and grade. Please ask your teacher to upload study materials first." }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // 3. Build context from chunks
        const context = chunks
            .map((c: any, i: number) => `[Excerpt ${i + 1}]:\n${c.content}`)
            .join("\n\n");

        // 4. Build prompt based on mode
        const prompt = mode === "doubt"
            ? buildDoubtPrompt(query, context)
            : buildTestPrompt(query, context);

        // 5. Call Claude
        const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
                "x-api-key": Deno.env.get("ANTHROPIC_API_KEY")!,
                "anthropic-version": "2023-06-01",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "claude-haiku-4-5-20251001",
                max_tokens: 1024,
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