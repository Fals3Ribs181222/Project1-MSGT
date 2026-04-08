import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { extractText as extractPdfText } from "https://esm.sh/unpdf";

const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const CHUNK_SIZE = 400;
const CHUNK_OVERLAP = 50;

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function splitIntoChunks(text: string, size: number, overlap: number): string[] {
    const words = text.split(/\s+/).filter(Boolean);
    const chunks: string[] = [];
    for (let i = 0; i < words.length; i += size - overlap) {
        const chunk = words.slice(i, i + size).join(" ");
        if (chunk.trim().length > 20) chunks.push(chunk);
    }
    return chunks;
}

async function embedChunks(chunks: string[]): Promise<number[][]> {
    const res = await fetch("https://api.voyageai.com/v1/embeddings", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${Deno.env.get("VOYAGE_API_KEY")}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            model: "voyage-3-lite",
            input: chunks,
        }),
    });

    if (!res.ok) {
        const err = await res.json();
        throw new Error(`Voyage AI error: ${JSON.stringify(err)}`);
    }

    const data = await res.json();
    return data.data.map((d: any) => d.embedding);
}

async function extractText(url: string): Promise<string> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch file: ${res.status}`);

    // Detect PDF by URL extension (strip query params — Supabase URLs include token params)
    const urlWithoutParams = url.split("?")[0].toLowerCase();
    if (urlWithoutParams.endsWith(".pdf")) {
        const buffer = await res.arrayBuffer();
        const { text } = await extractPdfText(new Uint8Array(buffer), { mergePages: true });
        return text;
    }

    // Plain text fallback for .txt, .md, and other text-based files
    return await res.text();
}

Deno.serve(async (req) => {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const { file_id, file_url, subject, grade, teacher_id } = await req.json();

        if (!file_id || !file_url || !subject || !grade) {
            return new Response(
                JSON.stringify({ error: "Missing required fields" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const text = await extractText(file_url);
        if (!text || text.trim().length < 10) {
            return new Response(
                JSON.stringify({ error: "File appears to be empty or unreadable" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const chunks = splitIntoChunks(text, CHUNK_SIZE, CHUNK_OVERLAP);
        if (chunks.length === 0) {
            return new Response(
                JSON.stringify({ error: "No content chunks generated" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        await supabase.from("material_chunks").delete().eq("file_id", file_id);

        const embeddings = await embedChunks(chunks);

        const rows = chunks.map((content, i) => ({
            file_id,
            chunk_index: i,
            content,
            embedding: embeddings[i],
            subject,
            grade,
            teacher_id: teacher_id ?? null,
        }));

        const { error } = await supabase.from("material_chunks").insert(rows);
        if (error) throw new Error(`Supabase insert error: ${error.message}`);

        // Invalidate doubt cache for this subject+grade (material changed)
        await supabase.from("doubt_cache").delete().eq("subject", subject).eq("grade", grade);

        return new Response(
            JSON.stringify({ success: true, chunks_indexed: chunks.length }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (err) {
        console.error("index-material error:", err.message);
        return new Response(
            JSON.stringify({ error: err.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});