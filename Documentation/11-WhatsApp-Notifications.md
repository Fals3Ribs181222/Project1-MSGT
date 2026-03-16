# WhatsApp Notifications (Twilio Integration)

The system sends WhatsApp messages to students and parents via a unified Edge Function. All messages are teacher-initiated — no automatic sends.

## Architecture

The messaging pipeline is fully serverless using a single Supabase Edge Function.

1.  **Teacher Action:** Teacher clicks a send button (e.g., "Notify Absent/Late", "Send Scores", or composes a custom message).
2.  **Frontend Helper:** `js/whatsapp.js` calls `window.whatsapp.send()`, which invokes the `send-whatsapp` Edge Function.
3.  **Edge Function:** `send-whatsapp` receives the message type, recipients, and payload, then:
    - Builds a formatted message from built-in templates.
    - Sends via Twilio WhatsApp API.
    - Logs every message to `whatsapp_log` with recipient details.
4.  **WhatsApp Delivery:** Recipients receive the message on WhatsApp.

## Message Types

| Type | Template | Typical Trigger |
|---|---|---|
| `attendance` | Absent/Late alert with class details | Attendance page → "Notify Absent/Late" button |
| `score` | Test score notification | Manage Marks page → "Send Scores via WhatsApp" button |
| `announcement` | Batch announcement broadcast | Announcements page → "Also send via WhatsApp" checkbox |
| `report` | AI-generated progress report | Student detail → "Send WhatsApp" button |
| `custom` | Free-form text message | Messages tab → Compose section |

## Key Files

| File | Purpose |
|---|---|
| `supabase/functions/send-whatsapp/index.ts` | Unified Edge Function (Deno) — Twilio API + auto-logging |
| `js/whatsapp.js` | Shared frontend helper: `send()`, `resolveRecipients()`, `getLog()`, `getAllLogs()` |
| `components/tabs/messages.html` | Messages tab UI (Compose + History) |
| `js/dashboard/messages.js` | Messages tab logic |

Integration points in existing files:
- `js/dashboard/attendance.js` — Notify Absent/Late handler
- `js/manage_marks.js` — Send Scores handler
- `js/dashboard/announcement.js` — WhatsApp checkbox handler
- `js/dashboard/students.js` — Report send (refactored)

## Database

### `profiles` table
- `phone` (TEXT) — Student's 10-digit Indian mobile number (without `+91` prefix)
- `parent_phone` (TEXT) — Parent's phone number

The Edge Function prepends `whatsapp:+91` before sending.

### `whatsapp_log` table
Every sent message is logged with:
- `student_id`, `message_type`, `preview`, `sent_by`, `sent_at`
- `recipient_phone`, `recipient_name`, `recipient_type` (student/parent)

## Environment Secrets (Edge Functions)

Stored in Supabase Dashboard → Settings → Edge Functions → Secrets:

| Secret | Description |
|---|---|
| `TWILIO_ACCOUNT_SID` | Your Twilio Account SID |
| `TWILIO_AUTH_TOKEN` | Your Twilio Auth Token |
| `TWILIO_WHATSAPP_FROM` | Twilio sender number, e.g. `whatsapp:+14155238886` |

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are automatically available inside Edge Functions.

## Deployment

To deploy or redeploy the Edge Function:

```bash
npx supabase functions deploy send-whatsapp
```

## Testing (Twilio Sandbox)

During development with the Twilio Sandbox:
1.  Each recipient must send `join <sandbox-keyword>` to `+14155238886` on WhatsApp to opt in.
2.  The sandbox keyword is found in Twilio Console → Messaging → Try it out → Send a WhatsApp message.
3.  Trial accounts have a **50 messages/day limit**.

When you upgrade to a production Twilio number, the opt-in step and daily limit are removed.
