import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID')!;
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET')!;
const GOOGLE_REFRESH_TOKEN = Deno.env.get('GOOGLE_REFRESH_TOKEN')!;
const DRIVE_FOLDER_ID = Deno.env.get('DRIVE_FOLDER_ID')!;
const DRIVE_WATCH_TOKEN = Deno.env.get('DRIVE_WATCH_TOKEN')!;

// Exchange refresh token for a short-lived access token
async function getAccessToken(): Promise<string> {
    const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: GOOGLE_CLIENT_ID,
            client_secret: GOOGLE_CLIENT_SECRET,
            refresh_token: GOOGLE_REFRESH_TOKEN,
            grant_type: 'refresh_token',
        }),
    });
    if (!res.ok) {
        const err = await res.text();
        throw new Error(`OAuth token error: ${err}`);
    }
    const json = await res.json();
    return json.access_token as string;
}

// Parse filename into metadata. Supports formats:
//   "Accounts Gr11 2025-05-13"
//   "12th_Accounts_Journal_Q1"
//   "Accounts_Grade_12_May_2025"
function parseFilename(filename: string): { title: string; subject: string | null; grade: string | null; recordedAt: string | null } {
    const nameWithoutExt = filename.replace(/\.[^.]+$/, '');
    const normalised = nameWithoutExt.replace(/[_\-]/g, ' ');

    // Extract subject
    const subjectMatch = normalised.match(/\b(accounts|economics)\b/i);
    const subject = subjectMatch
        ? subjectMatch[1].charAt(0).toUpperCase() + subjectMatch[1].slice(1).toLowerCase()
        : null;

    // Extract grade: "11", "12", "11th", "12th", "Gr11", "Grade 11"
    const gradeMatch = normalised.match(/\b(?:gr(?:ade)?\s*|(\d+)(?:st|nd|rd|th)\s*)?(11|12)\b/i);
    const grade = gradeMatch ? gradeMatch[2] ?? gradeMatch[1] ?? null : null;

    // Extract date: YYYY-MM-DD
    const dateMatch = normalised.match(/(\d{4}[-\/]\d{2}[-\/]\d{2})/);
    const recordedAt = dateMatch ? dateMatch[1].replace(/\//g, '-') : null;

    // Extract remainder (anything that isn't subject, grade keyword, date, or standalone numbers)
    const remainder = normalised
        .replace(/\b(accounts|economics)\b/gi, '')
        .replace(/\b(?:gr(?:ade)?\s*)?(11|12)\b/gi, '')
        .replace(/\b\d{4}[-\/]\d{2}[-\/]\d{2}\b/, '')
        .replace(/\s+/g, ' ')
        .trim();

    const base = subject && grade ? `${subject} Grade ${grade}` : nameWithoutExt.replace(/[_\-]/g, ' ');
    const suffix = remainder ? ` — ${remainder}` : '';
    const datePart = recordedAt ? ` — ${recordedAt}` : '';
    const title = `${base}${suffix}${datePart}`;

    return { title, subject, grade, recordedAt };
}

Deno.serve(async (req) => {
    // Google Drive sends POST for notifications, GET for verification (handled separately)
    if (req.method !== 'POST') {
        return new Response('ok', { status: 200 });
    }

    // Verify this notification is genuinely from our registered watch
    const channelToken = req.headers.get('X-Goog-Channel-Token');
    if (channelToken !== DRIVE_WATCH_TOKEN) {
        console.error('drive-to-youtube: invalid channel token, ignoring');
        return new Response('ok', { status: 200 });
    }

    // Only process actual file additions/updates, not sync pings or removals
    const resourceState = req.headers.get('X-Goog-Resource-State');
    if (!resourceState || resourceState === 'sync' || resourceState === 'remove') {
        return new Response('ok', { status: 200 });
    }

    const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    try {
        const accessToken = await getAccessToken();

        // Find the newest video file in the watched folder not yet processed
        const listUrl = new URL('https://www.googleapis.com/drive/v3/files');
        listUrl.searchParams.set('q', `'${DRIVE_FOLDER_ID}' in parents and mimeType contains 'video' and trashed = false`);
        listUrl.searchParams.set('orderBy', 'createdTime desc');
        listUrl.searchParams.set('pageSize', '5');
        listUrl.searchParams.set('fields', 'files(id,name,mimeType,size,createdTime)');

        const listRes = await fetch(listUrl.toString(), {
            headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!listRes.ok) {
            const err = await listRes.text();
            throw new Error(`Drive list error: ${err}`);
        }
        const listJson = await listRes.json();
        const files: Array<{ id: string; name: string; mimeType: string; size: string; createdTime: string }> = listJson.files ?? [];

        if (files.length === 0) {
            console.log('drive-to-youtube: no video files found in folder');
            return new Response('ok', { status: 200 });
        }

        // Process each file that hasn't been uploaded yet (idempotent via drive_file_id UNIQUE)
        for (const file of files) {
            const { data: existing } = await db
                .from('class_recordings')
                .select('id')
                .eq('drive_file_id', file.id)
                .maybeSingle();

            if (existing) {
                console.log(`drive-to-youtube: ${file.name} already processed, skipping`);
                continue;
            }

            console.log(`drive-to-youtube: processing ${file.name}`);

            const { title, subject, grade, recordedAt } = parseFilename(file.name);

            // Step 1: Initiate YouTube resumable upload
            const ytInitRes = await fetch(
                'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
                {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                        'X-Upload-Content-Type': file.mimeType,
                        ...(file.size ? { 'X-Upload-Content-Length': file.size } : {}),
                    },
                    body: JSON.stringify({
                        snippet: {
                            title,
                            description: `Class recording — ${subject ?? 'Unknown Subject'}, Grade ${grade ?? '?'}, ${recordedAt ?? file.createdTime.slice(0, 10)}`,
                            categoryId: '27', // Education
                        },
                        status: {
                            privacyStatus: 'unlisted',
                        },
                    }),
                }
            );

            if (!ytInitRes.ok) {
                const err = await ytInitRes.text();
                throw new Error(`YouTube init upload error: ${err}`);
            }

            const uploadUrl = ytInitRes.headers.get('Location');
            if (!uploadUrl) throw new Error('YouTube did not return an upload URL');

            // Step 2: Stream Drive file directly to YouTube (no local buffer)
            const driveStreamRes = await fetch(
                `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,
                { headers: { Authorization: `Bearer ${accessToken}` } }
            );

            if (!driveStreamRes.ok) {
                const err = await driveStreamRes.text();
                throw new Error(`Drive download error: ${err}`);
            }

            const contentType = driveStreamRes.headers.get('Content-Type') ?? file.mimeType;
            const contentLength = driveStreamRes.headers.get('Content-Length') ?? file.size;

            const ytUploadRes = await fetch(uploadUrl, {
                method: 'PUT',
                headers: {
                    'Content-Type': contentType,
                    ...(contentLength ? { 'Content-Length': contentLength } : {}),
                },
                body: driveStreamRes.body,
            });

            if (!ytUploadRes.ok) {
                const err = await ytUploadRes.text();
                throw new Error(`YouTube upload error: ${err}`);
            }

            const ytVideo = await ytUploadRes.json();
            const youtubeVideoId = ytVideo.id as string;

            if (!youtubeVideoId) throw new Error('YouTube did not return a video ID');

            // Step 3: Save to Supabase
            const { error: insertError } = await db.from('class_recordings').insert({
                title,
                subject,
                grade,
                youtube_video_id: youtubeVideoId,
                drive_file_id: file.id,
                recorded_at: recordedAt,
            });

            if (insertError) {
                console.error('drive-to-youtube: DB insert error', insertError);
            } else {
                console.log(`drive-to-youtube: saved ${title} → youtube.com/watch?v=${youtubeVideoId}`);
            }

            // Only process the first unprocessed file per notification to avoid timeouts
            break;
        }
    } catch (err) {
        // Always return 200 so Google doesn't retry aggressively
        console.error('drive-to-youtube error:', err);
    }

    return new Response('ok', { status: 200 });
});
