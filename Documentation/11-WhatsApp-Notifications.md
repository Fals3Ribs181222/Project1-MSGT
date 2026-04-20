# WhatsApp Notifications (Meta Cloud API)

The system sends WhatsApp messages to students and parents via a unified Edge Function. All messages are teacher-initiated — no automatic sends.

## Architecture

The messaging pipeline is fully serverless using Supabase Edge Functions and Meta's WhatsApp Cloud API directly (no third-party BSP).

1. **Teacher Action:** Teacher clicks a send button (e.g., "Send WhatsApp (N)", "Send Scores", or composes a custom message).
2. **Frontend Helper:** `js/whatsapp.js` calls `window.whatsapp.send()`, which invokes the `send-whatsapp` Edge Function.
3. **Edge Function:** `send-whatsapp` receives the message type, recipients, and payload, then:
   - Resolves the correct Meta-approved template and parameters per recipient.
   - Sends via Meta Cloud API (`graph.facebook.com/v19.0`).
   - Renders the full template body locally via `renderTemplatePreview()` and logs it to `whatsapp_log`.
4. **WhatsApp Delivery:** Recipients receive the message on WhatsApp.

### Incoming messages / webhook

A second edge function `whatsapp-webhook` handles inbound traffic from Meta:
- **GET** — Meta verification challenge (echoes `hub.challenge` if `WHATSAPP_VERIFY_TOKEN` matches)
- **POST** — Incoming messages and delivery status updates, logged to `whatsapp_incoming` table

Incoming message types are handled explicitly: `text` → body text, `reaction` → emoji, `image/audio/document/video` → descriptive label. Previously only `text` was extracted; other types stored `null`.

## Message Types

| Type | Delivery | Typical Trigger |
|---|---|---|
| `attendance` | Meta template (present/absent/late × student/parent) | Attendance page → "Send WhatsApp (N)" button |
| `score` | Meta template (`mssc_test_result_parent/student`) | Manage Marks page → "Send Scores via WhatsApp" button |
| `login` | Meta template (`mssc_welcome_student`) | Students tab → "Send Welcome" button |
| `announcement` | Free-form text | Announcements page → "Also send via WhatsApp" checkbox |
| `report` | Free-form text | Student detail → "Send WhatsApp" button |
| `custom` | Free-form text | Messages tab → Compose section |

> **Note:** Free-form text requires the recipient to have messaged the business number within the last 24 hours. Template messages (`attendance`, `score`, `login`) can be sent at any time.

## Key Files

| File | Purpose |
|---|---|
| `supabase/functions/send-whatsapp/index.ts` | Sends messages via Meta Cloud API + auto-logging |
| `supabase/functions/whatsapp-webhook/index.ts` | Receives incoming messages and status updates from Meta |
| `js/whatsapp.js` | Shared frontend helper: `send()`, `resolveRecipients()`, `getLog()`, `getAllLogs()` |
| `components/tabs/messages.html` | Messages tab UI — two-panel conversation interface (contact list + thread view) |
| `js/dashboard/messages.js` | Messages tab logic — loads conversations, renders threaded chat, handles compose and reply |

### Messages Tab UI

The Messages tab (`js/dashboard/messages.js`) is a conversation-centric interface:
- **Left panel:** Contact list grouped by student. Each student can have multiple entries (their own phone + parent phones). Groups are collapsible, sorted by most recent activity. An avatar dot indicates 24h window status: green (>10h left), amber (2–10h), red (<2h), grey (closed).
- **Right panel:** Thread view showing message bubbles with date dividers, a 24h window badge, and a reply input. The reply input auto-resizes and submits on Enter.
- **New message modal:** A "New message" button opens a modal to compose to a student (by name) or an arbitrary phone number.
- **Grade scoping:** `loadProfiles()` filters `allStudentsCache` to the teacher's assigned grade before conversations are loaded.

Integration points in existing files:
- `js/dashboard/attendance.js` — "Send WhatsApp (N)" handler (sends to all marked, un-notified students via attendance templates)
- `js/manage_marks.js` — Send Scores handler
- `js/dashboard/announcement.js` — WhatsApp checkbox handler
- `js/dashboard/students.js` — "Send Welcome" button (sends `mssc_welcome_student` template to student's own phone)

## Database

### `profiles` table
- `phone` (TEXT) — Student's 10-digit Indian mobile number (without `+91` prefix)
- `father_phone` (TEXT) — Father's phone number
- `mother_phone` (TEXT) — Mother's phone number

The edge function normalises numbers to E.164 format (prepends `91`) before sending.

### `whatsapp_log` table
Every sent message is logged with:
- `student_id`, `message_type`, `preview`, `sent_by`, `sent_at`
- `recipient_phone`, `recipient_name`, `recipient_type` (student/parent)

The `preview` field stores a full human-readable rendering of the message via `renderTemplatePreview()` in `send-whatsapp/index.ts`. This mirrors the actual Meta template body so the log is readable without decoding parameter arrays. Previously truncated to 120 chars — now stored in full.

### `whatsapp_incoming` table
Every inbound message or status update from Meta is logged with:
- `event_type` (`message` or `status`)
- `from_number`, `message_text`, `raw_payload`, `created_at`

`message_text` is resolved by type: plain text for `text` messages, emoji for `reaction`, and descriptive labels (`📷 Image`, `🎤 Voice message`, `📄 Document`, `🎥 Video`) for media types.

## Environment Secrets (Edge Functions)

Stored in Supabase Dashboard → Settings → Edge Functions → Secrets:

| Secret | Description |
|---|---|
| `WHATSAPP_PHONE_NUMBER_ID` | Meta phone number ID (from API Setup page) |
| `WHATSAPP_ACCESS_TOKEN` | Meta access token (temporary: 24hr / permanent: system user token) |
| `WHATSAPP_VERIFY_TOKEN` | Self-defined token used to verify the webhook endpoint with Meta |

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are automatically available inside Edge Functions.

## Deployment

```bash
npx supabase functions deploy send-whatsapp --no-verify-jwt
npx supabase functions deploy whatsapp-webhook --no-verify-jwt
```

## Sandbox / Testing

The Meta sandbox allows testing without a verified business:
1. A test number (`+1 555 193 9202`) is provided automatically
2. Up to 5 recipient numbers can be whitelisted in the API Setup page
3. Each whitelisted recipient must send any message to the test number first to open the 24-hour free-form window
4. Alternatively, use Meta's pre-approved `hello_world` template to send without the window

## Production Checklist

Before going live with Mitesh Sir's real number:
- [ ] Add real phone number to Meta Business Account (OTP verification required)
- [ ] Generate a permanent system user token (replaces the 24hr temporary token)
- [ ] Update `WHATSAPP_PHONE_NUMBER_ID` and `WHATSAPP_ACCESS_TOKEN` secrets
- [ ] Redeploy `send-whatsapp`
- [ ] Create and get approved Meta message templates for attendance, scores, announcements
- [ ] Complete Meta business verification to increase messaging limits
