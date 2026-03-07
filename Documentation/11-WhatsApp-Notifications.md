# WhatsApp Notifications (Twilio Integration)

The system sends automated WhatsApp messages to students when their attendance is marked. This is powered by Twilio's WhatsApp API and Supabase Edge Functions.

## Architecture

The notification pipeline is fully serverless — no separate backend is required.

1.  **Attendance Marked:** A teacher marks a student present, absent, or late via the dashboard. This inserts a row into the `attendance` table.
2.  **Database Webhook:** A Supabase Webhook (`attendance_whatsapp_notify`) fires automatically on every `INSERT` into the `attendance` table.
3.  **Edge Function:** The webhook triggers the `attendance-notify` Edge Function, which:
    - Fetches the student's name and phone number from `profiles`.
    - Fetches the class date, batch name, and subject from `classes` and `batches`.
    - Builds a formatted WhatsApp message based on attendance status.
    - Sends the message via the Twilio API.
4.  **WhatsApp Delivery:** The student receives a WhatsApp message on the phone number stored in their profile.

## Key Files

| File | Purpose |
|---|---|
| `supabase/functions/attendance-notify/index.ts` | Edge Function (Deno) that handles the webhook and calls Twilio |
| `components/add_student.html` | Student registration form (includes phone number field) |
| `js/dashboard/students.js` | Handles form submission and saves phone to `profiles` table |

## Database

The `profiles` table includes a `phone` column (`TEXT`) to store the student's 10-digit Indian mobile number (without the `+91` prefix). The Edge Function prepends `whatsapp:+91` before sending.

## Environment Secrets (Edge Functions)

These are stored in Supabase Dashboard → Settings → Edge Functions → Secrets:

| Secret | Description |
|---|---|
| `TWILIO_ACCOUNT_SID` | Your Twilio Account SID |
| `TWILIO_AUTH_TOKEN` | Your Twilio Auth Token |
| `TWILIO_WHATSAPP_FROM` | Twilio sender number, e.g. `whatsapp:+14155238886` |

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are automatically available inside Edge Functions.

## Message Templates

The Edge Function sends different messages based on attendance status:

- **Present:** ✅ Confirmation message with class details.
- **Absent:** ❌ Absence alert with instructions to contact the teacher if incorrect.
- **Late:** ⏰ Late arrival notice with class details.

## Deployment

To redeploy the Edge Function after making changes:

```bash
.\supabase.exe login
.\supabase.exe link --project-ref tksruuqtzxflgglnljef
.\supabase.exe functions deploy attendance-notify
```

## Testing (Twilio Sandbox)

During development with the Twilio Sandbox:
1.  Each student must send `join <sandbox-keyword>` to `+14155238886` on WhatsApp to opt in.
2.  The sandbox keyword is found in Twilio Console → Messaging → Try it out → Send a WhatsApp message.
3.  Once opted in, marking attendance for that student will trigger the WhatsApp notification.

When you upgrade to a production Twilio number, the opt-in step is no longer required.
