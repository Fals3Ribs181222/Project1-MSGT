# WhatsApp Message Templates

All templates are **UTILITY** category, language **English**.
Header type: **Text** (plain). Body: below. Footer: `— Mitesh Sir's Study Circle`.
Button (all templates): **Visit website** → `https://www.miteshbhatt.in` (Static URL)

---

## Attendance Templates (6 total)

### 1. `mssc_attendance_absent_parent` ✅ Submitted

**Header:** Absence Alert

**Body:**
```
Dear {{1}},

{{2}} did not attend class on {{3}}.

Batch: {{4}}
Class time: {{5}}

Please ensure {{6}} is present next class.
```

**Button:** Visit website → https://www.miteshbhatt.in

**Variable samples:**
- {{1}} → Anshuman Misraa (parent name)
- {{2}} → Ribhhu (student name)
- {{3}} → Tuesday, 8 April 2026
- {{4}} → 12Acc B-1 M/F
- {{5}} → 12.30 - 2.30
- {{6}} → Ribhhu (student name again)

---

### 2. `mssc_attendance_absent_student` ✅ Submitted

**Header:** Absence Alert

**Body:**
```
Dear {{1}},

You did not attend class on {{2}}.

Batch: {{3}}
Class time: {{4}}

Please make sure to attend next class.
```

**Footer:** — Mitesh Sir's Study Circle

**Button:** Visit website → https://www.miteshbhatt.in

**Variable samples:**
- {{1}} → Ribhhu (student name)
- {{2}} → Tuesday, 8 April 2026
- {{3}} → 12Acc B-1 M/F
- {{4}} → 12.30

---

### 3. `mssc_attendance_late_parent` ✅ Submitted

**Header:** Late Arrival

**Body:**
```
Dear {{1}},

{{2}} arrived late to class on {{3}}.

Batch: {{4}}
Class time: {{5}}
Arrived at: {{6}}

Please ensure {{7}} arrives on time.
```

**Footer:** — Mitesh Sir's Study Circle

**Button:** Visit website → https://www.miteshbhatt.in

**Variable samples:**
- {{1}} → Anshuman Misraa (parent name)
- {{2}} → Ribhhu (student name)
- {{3}} → Tuesday, 8 April 2026
- {{4}} → 12Acc B-1 M/F
- {{5}} → 12.30
- {{6}} → 12.45 (punch-in time)
- {{7}} → Ribhhu (student name again)

---

### 4. `mssc_attendance_late_student` ✅ Submitted

**Header:** Late Arrival

**Body:**
```
Dear {{1}},

You arrived late to class on {{2}}.

Batch: {{3}}
Class time: {{4}}
Arrived at: {{5}}

Please try to arrive on time next class.
```

**Footer:** — Mitesh Sir's Study Circle

**Button:** Visit website → https://www.miteshbhatt.in

**Variable samples:**
- {{1}} → Ribhhu (student name)
- {{2}} → Tuesday, 8 April 2026
- {{3}} → 12Acc B-1 M/F
- {{4}} → 12.30
- {{5}} → 12.45 (punch-in time)

---

### 5. `mssc_attendance_present_parent` ✅ Submitted

**Header:** Attendance Confirmed

**Body:**
```
Dear {{1}},

{{2}} attended class on {{3}}.

Batch: {{4}}
Class time: {{5}}
Arrived at: {{6}}

Thank you and have a great day!
```

**Footer:** — Mitesh Sir's Study Circle

**Variable samples:**
- {{1}} → Anshuman Misraa (parent name)
- {{2}} → Ribhhu (student name)
- {{3}} → Tuesday, 8 April 2026
- {{4}} → 12Acc B-1 M/F
- {{5}} → 12.30
- {{6}} → 12.35 (punch-in time, "Not recorded" until biometric)

---

### 6. `mssc_attendance_present_student` ✅ Submitted

**Header:** Attendance Confirmed

**Body:**
```
Dear {{1}},

You attended class on {{2}}.

Batch: {{3}}
Class time: {{4}}
Arrived at: {{5}}

See you next class!
```

**Footer:** — Mitesh Sir's Study Circle

**Variable samples:**
- {{1}} → Ribhhu (student name)
- {{2}} → Tuesday, 8 April 2026
- {{3}} → 12Acc B-1 M/F
- {{4}} → 12.30
- {{5}} → 12.35 (punch-in time, "Not recorded" until biometric)

---

## Edge Function Parameter Mapping

Defined in `supabase/functions/send-whatsapp/index.ts` → `resolveAttendanceTemplate()`.

| Template | Params array |
|----------|-------------|
| `mssc_attendance_absent_parent` | `[parentName, studentName, dayDate, batchName, classTimeDisplay, studentName]` |
| `mssc_attendance_absent_student` | `[studentName, dayDate, batchName, classTimeDisplay]` |
| `mssc_attendance_late_parent` | `[parentName, studentName, dayDate, batchName, classTimeDisplay, punchDisplay, studentName]` |
| `mssc_attendance_late_student` | `[studentName, dayDate, batchName, classTimeDisplay, punchDisplay]` |
| `mssc_attendance_present_parent` | `[parentName, studentName, dayDate, batchName, classTimeDisplay, punchDisplay]` |
| `mssc_attendance_present_student` | `[studentName, dayDate, batchName, classTimeDisplay, punchDisplay]` |
| `mssc_test_result_parent` | `[parentName, studentName, testTitle, subject, score, total, average, studentName]` |
| `mssc_test_result_student` | `[studentName, testTitle, subject, score, total, average]` |
| `mssc_announcement` | `[recipientName, body]` where `body = title ? "*title* — message" : message` (newlines stripped) |
| `mssc_test_missed_parent` | `[parentName, studentName, testTitle, subject, date, studentName]` |
| `mssc_test_missed_student` | `[studentName, testTitle, subject, date]` |

## Test Result Templates

### 7. `mssc_test_result_parent` ✅ Submitted

**Header:** Test Result

**Body:**
```
Dear {{1}},

We are writing to share the latest test result for your child {{2}}.

Test: _{{3}}_
Subject: {{4}}
Marks: *{{5}}/{{6}}*
Class Average: *{{7}}*

Thank you for your continued support in {{8}}'s learning journey and discuss this with them and encourage continued effort.
```

**Footer:** — Mitesh Sir's Study Circle

**Button:** Visit website → https://www.miteshbhatt.in

**Variable samples:**
- {{1}} → Anshuman Misraa (parent name)
- {{2}} → Ribhhu (student name)
- {{3}} → Redemption of Debentures (test name)
- {{4}} → Accounts (subject)
- {{5}} → 36 (score)
- {{6}} → 40 (total marks)
- {{7}} → 33 (class average)
- {{8}} → Ribhhu (student name again)

---

### 8. `mssc_test_result_student` ✅ Submitted

**Header:** Test Result

**Body:**
```
Dear {{1}},

Your latest test result is now available.

Test: _{{2}}_
Subject: {{3}}
Marks: *{{4}}/{{5}}*
Class Average: *{{6}}*

Keep working hard and giving your best in every class!
```

**Footer:** — Mitesh Sir's Study Circle

**Button:** Visit website → https://www.miteshbhatt.in

**Variable samples:**
- {{1}} → Ribhhu (student name)
- {{2}} → Redemption of Debentures (test name)
- {{3}} → Accounts (subject)
- {{4}} → 35 (score)
- {{5}} → 40 (total marks)
- {{6}} → 32 (class average)

---

## Test Not Given Templates

### 11. `mssc_test_missed_parent` ❌ Not yet submitted

**Header:** Test Not Attempted

**Body:**
```
Dear {{1}},

We wish to inform you that {{2}} did not appear for the following test.

Test: _{{3}}_
Subject: {{4}}
Date: {{5}}

Kindly ensure {{6}} attempts this test at the earliest.
```

**Footer:** — Mitesh Sir's Study Circle

**Button:** Visit website → https://www.miteshbhatt.in

**Variable samples:**
- {{1}} → Anshuman Misraa (parent name)
- {{2}} → Ribhhu (student name)
- {{3}} → Redemption of Debentures (test title)
- {{4}} → Accounts (subject)
- {{5}} → 2026-04-24 (test date)
- {{6}} → Ribhhu (student name again)

---

### 12. `mssc_test_missed_student` ❌ Not yet submitted

**Header:** Test Not Attempted

**Body:**
```
Dear {{1}},

We wish to inform you that you did not appear for the following test.

Test: _{{2}}_
Subject: {{3}}
Date: {{4}}

Kindly attempt this test at the earliest.
```

**Footer:** — Mitesh Sir's Study Circle

**Button:** Visit website → https://www.miteshbhatt.in

**Variable samples:**
- {{1}} → Ribhhu (student name)
- {{2}} → Redemption of Debentures (test title)
- {{3}} → Accounts (subject)
- {{4}} → 2026-04-24 (test date)

**Sent from:** Manage Marks page → "Notify Not Given via WhatsApp" button (appears after saving marks, targets all students with no mark entered, sends to both student and parents)

---

## Login Credentials Template

### 9. `mssc_welcome_student` ❌ Not yet created

**Header:** Welcome to Mitesh Sir's Study Circle

**Body:**
```
Dear {{1}},

We are delighted to welcome you to Mitesh Sir's Study Circle! We look forward to being a part of your academic journey.

Here are your portal login details:

Username: {{2}}
Password: {{3}}

Use the link below to log in and get started.
```

**Footer:** — Mitesh Sir's Study Circle

**Button:** Visit website → https://www.miteshbhatt.in

**Variable samples:**
- {{1}} → Ribhhu (student name)
- {{2}} → ribhhu (username)
- {{3}} → ribhhu (password)

**Sent from:** Students tab → "Send Welcome" button per student row (student phone only, auto-fills username as password)

---

## Announcement Template

### 10. `mssc_announcement` ✅ Submitted

**Header:** Announcement

**Body:**
```
Dear {{1}},

Do note:

{{2}}

Thank you for your support.
Do reach out if you need any clarification.
```

**Footer:** — Mitesh Sir's Study Circle

**Button:** Visit website → https://www.miteshbhatt.in

**Variable samples:**
- {{1}} → Anshuman (recipient name)
- {{2}} → Classes will be suspended on Monday, 21 April 2026 due to a public holiday. Classes resume Tuesday.

**Notes:**
- {{2}} cannot contain newlines or tabs — Meta returns error #132018 if it does. The edge function strips them automatically; the UI shows a warning.
- Keep {{2}} under ~900 chars (total rendered body must be ≤1024 chars including fixed template text)
- Send to parents, students, or both depending on context
- Category: MARKETING (auto-assigned by Meta)
