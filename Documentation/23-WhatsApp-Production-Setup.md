# WhatsApp API — Production Setup Tracker

Tracks the step-by-step progress of bringing the Meta WhatsApp Cloud API to production for Mitesh Sir's Study Circle.

---

## Status Legend
- ✅ Done
- 🔄 In Progress
- ⏳ Waiting (on Meta / external)
- ❌ Not Started
- ❓ Needs Decision

---

## 1. Meta Business Setup

| Step | Status | Notes |
|------|--------|-------|
| Create Meta Business Account at business.facebook.com | ✅ Done | |
| Complete Meta Business Verification (submit business documents) | ❌ Not Started | **Optional for now** — Tier 1 (1,000 recipients/day) works without it. Needed later for higher tiers / display name. Submit GST certificate or business registration doc if required. |
| Create WhatsApp Business App in Meta Developer Console | ✅ Done | |

---

## 2. Phone Number Decision

| Question | Answer |
|----------|--------|
| Number to use for sending | ✅ **+91 91372 62656** (Mitesh Sir's business number) |
| Number type | ✅ Existing business number — confirmed not on regular WhatsApp |

---

## 3. Phone Number Registration (Meta)

| Step | Status | Notes |
|------|--------|-------|
| Add real phone number to Meta App (WhatsApp → API Setup) | ✅ Done | +91 91372 62656 |
| Complete OTP verification for the number | ✅ Done | |
| Ensure number is not registered as regular WhatsApp account | ✅ Done | Confirmed |
| Note down the real **Phone Number ID** | ✅ Done | `1036480289552955` |

---

## 4. Access Token — Permanent System User Token

| Step | Status | Notes |
|------|--------|-------|
| Create a System User in Meta Business Settings → System Users | ✅ Done | System user: **MSSC-bot** |
| Assign system user admin/developer role on the WhatsApp app | ✅ Done | |
| Generate permanent (never-expiring) System User Access Token | ✅ Done | Permissions: `whatsapp_business_messaging`, `whatsapp_business_management` |
| Save the token securely | ✅ Done | |

---

## 5. Supabase Secrets (Edge Functions)

| Secret | Status | Value / Notes |
|--------|--------|---------------|
| `WHATSAPP_PHONE_NUMBER_ID` | ✅ Set | |
| `WHATSAPP_ACCESS_TOKEN` | ✅ Set | Permanent system user token (MSSC-bot) |
| `WHATSAPP_VERIFY_TOKEN` | ✅ Set | |

Set via: Supabase Dashboard → Settings → Edge Functions → Secrets

---

## 6. Edge Function Deployment

| Step | Status | Notes |
|------|--------|-------|
| Deploy `send-whatsapp` | ✅ Done | |
| Deploy `whatsapp-webhook` | ✅ Done | |
| Note deployed webhook URL | ✅ Done | `https://tksruuqtzxflgglnljef.supabase.co/functions/v1/whatsapp-webhook` |

---

## 7. Webhook Registration (Meta)

| Step | Status | Notes |
|------|--------|-------|
| Enter webhook Callback URL in Meta Developer Console | ✅ Done | `https://tksruuqtzxflgglnljef.supabase.co/functions/v1/whatsapp-webhook` |
| Enter Verify Token | ✅ Done | |
| Click Verify and Save — confirm 200 response | ✅ Done | |
| Subscribe to `messages` webhook field | ✅ Done | |

---

## 8. Message Templates

> **Why needed:** Free-form text messages only work if the recipient messaged the business number first (within 24 hours). For outbound-only notifications (attendance, scores), Meta-approved templates are required.

| Template | Category | Status | Notes |
|----------|----------|--------|-------|
| Attendance alert (absent/late) | UTILITY | ❌ Not Created | |
| Test score notification | UTILITY | ❌ Not Created | |
| Announcement | UTILITY or MARKETING | ❌ Not Created | |

Steps:
1. Create templates in Meta Business Manager → WhatsApp → Message Templates
2. Submit for Meta approval (typically 24–48 hours)
3. Once approved, update `send-whatsapp/index.ts` to send `type: "template"` payloads for these message types

---

## 9. Code Changes Required After Templates Are Approved

- [ ] Update `send-whatsapp/index.ts` — switch attendance, score, announcement message types from free-form `type: "text"` to `type: "template"` with the approved template names and parameter mappings
- [ ] Redeploy `send-whatsapp` after changes

---

## 10. Testing Checklist (Before Go-Live)

| Test | Status | Notes |
|------|--------|-------|
| Send test message to Mitesh Sir's own number | ✅ | |
| Receive a reply — confirm it appears in the dashboard Inbox tab | ✅ | Replies from students visible in Inbox tab |
| Test attendance message type | ✅ | Absence alert delivered to Ribhhu Misraa |
| Test score message type | ❌ | |
| Test announcement message type | ❌ | |
| Test custom message type | ✅ | |
| Confirm `whatsapp_log` rows are being written in Supabase | ❌ | |
| Confirm `whatsapp_incoming` rows are written on reply | ✅ | Confirmed via Inbox tab |

---

## 11. Final Production Checks

| Check | Status | Notes |
|-------|--------|-------|
| Remove sandbox test numbers from Meta app | ❌ | |
| Confirm RLS on `whatsapp_log` and `whatsapp_incoming` tables | ❌ | Only authenticated teachers should be able to read |
| Set up Meta Business Manager quality rating alerts | ❌ | Alerts if quality drops to yellow/red |
| Monitor messaging tier (starts at Tier 1 = 1,000/day) | ❌ | Upgrades automatically with volume |

---

## Key IDs & Credentials (fill in as you go)

> **Do not commit real tokens to git.** This section is for reference only — store actual values in Supabase secrets.

| Item | Value |
|------|-------|
| Meta App ID | |
| WhatsApp Phone Number ID (real) | `1036480289552955` |
| WhatsApp Business Account ID | `2133711207463092` |
| Supabase Project Ref | `tksruuqtzxflgglnljef` |
| Webhook URL | `https://tksruuqtzxflgglnljef.supabase.co/functions/v1/whatsapp-webhook` |
| Verify Token (self-defined) | *(store in Supabase secrets only)* |

---

## Open Decisions

| Decision | Status |
|----------|--------|
| Which phone number will be used for WhatsApp Business? | ✅ +91 91372 62656 |
| Will Meta Business Verification be pursued now or later? | ❓ TBD |
