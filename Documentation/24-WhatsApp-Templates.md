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

---

## Old Templates (to delete once new ones are working)

- `mssc_attendance_absent` — replaced by `*_parent` and `*_student` variants
- `mssc_attendance_late` — replaced
- `mssc_attendance_present` — replaced

---

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

## Planned Templates (not yet created)

| Template name | Type | Variables |
|---------------|------|-----------|
| Announcement | UTILITY | batch_name, title, message |
