-- Supabase Schema for Mitesh Sir's Study Circle

-- Extensions
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;

-- 1. Profiles Table (Extends Auth Users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  name TEXT NOT NULL,
  username TEXT UNIQUE NOT NULL,
  role TEXT CHECK (role IN ('teacher', 'student')) DEFAULT 'student',
  grade TEXT,
  subjects TEXT,
  phone TEXT,
  email TEXT,
  father_name TEXT,
  father_phone TEXT,
  mother_name TEXT,
  mother_phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Announcements
CREATE TABLE IF NOT EXISTS announcements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  grade TEXT,
  message TEXT,
  posted_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Files (Materials)
CREATE TABLE IF NOT EXISTS files (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  grade TEXT,
  subject TEXT,
  file_url TEXT NOT NULL,
  upload_type TEXT NOT NULL DEFAULT 'student' CHECK (upload_type IN ('student', 'ai')),
  uploaded_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Tests
CREATE TABLE IF NOT EXISTS tests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  grade TEXT,
  subject TEXT,
  date DATE,
  max_marks INTEGER,
  scheduled_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Marks
CREATE TABLE IF NOT EXISTS marks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  test_id UUID REFERENCES tests(id) ON DELETE CASCADE,
  student_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  marks_obtained TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE files ENABLE ROW LEVEL SECURITY;
ALTER TABLE tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE marks ENABLE ROW LEVEL SECURITY;

-- Helper functions (SECURITY DEFINER bypasses RLS to prevent recursion)
CREATE OR REPLACE FUNCTION public.is_teacher()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'teacher'
  );
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_my_grade()
RETURNS text AS $$
  SELECT grade FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- profiles policies
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Teachers can manage all profiles" ON profiles;

CREATE POLICY "Grade-scoped profile visibility" ON profiles
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND (
      profiles.id = auth.uid()
      OR profiles.role = 'teacher'
      OR (public.get_my_role() = 'teacher' AND profiles.role = 'student' AND (public.get_my_grade() IS NULL OR public.get_my_grade() = 'All Grades'))
      OR (public.get_my_role() = 'teacher' AND profiles.role = 'student' AND public.get_my_grade() IS NOT NULL AND public.get_my_grade() <> 'All Grades' AND profiles.grade = public.get_my_grade())
    )
  );

DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
CREATE POLICY "Users can update their own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Teachers can insert profiles" ON profiles
  FOR INSERT WITH CHECK (public.is_teacher());

CREATE POLICY "Teachers can update profiles" ON profiles
  FOR UPDATE USING (public.is_teacher());

CREATE POLICY "Teachers can delete profiles" ON profiles
  FOR DELETE USING (public.is_teacher());

-- announcements policies
DROP POLICY IF EXISTS "Public announcements are viewable by everyone" ON announcements;

CREATE POLICY "Grade-scoped announcement visibility" ON announcements
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND (
      announcements.grade IS NULL
      OR (public.get_my_role() = 'teacher' AND (public.get_my_grade() IS NULL OR public.get_my_grade() = 'All Grades'))
      OR (public.get_my_role() = 'teacher' AND public.get_my_grade() IS NOT NULL AND public.get_my_grade() <> 'All Grades' AND announcements.grade = public.get_my_grade())
      OR (public.get_my_role() = 'student' AND announcements.grade = public.get_my_grade())
    )
  );

-- files policies
DROP POLICY IF EXISTS "Public files are viewable by everyone" ON files;

CREATE POLICY "Grade-scoped file visibility" ON files
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND (
      (files.grade IS NULL OR files.grade = '')
      OR (public.get_my_role() = 'teacher' AND (public.get_my_grade() IS NULL OR public.get_my_grade() = 'All Grades'))
      OR (public.get_my_role() = 'teacher' AND public.get_my_grade() IS NOT NULL AND public.get_my_grade() <> 'All Grades' AND files.grade = public.get_my_grade())
      OR (public.get_my_role() = 'student' AND files.grade = public.get_my_grade())
    )
  );

-- tests policies
DROP POLICY IF EXISTS "Public tests are viewable by everyone" ON tests;

CREATE POLICY "Grade-scoped test visibility" ON tests
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND (
      (public.get_my_role() = 'teacher' AND (public.get_my_grade() IS NULL OR public.get_my_grade() = 'All Grades'))
      OR (public.get_my_role() = 'teacher' AND public.get_my_grade() IS NOT NULL AND public.get_my_grade() <> 'All Grades' AND tests.grade = public.get_my_grade())
      OR (public.get_my_role() = 'student' AND tests.grade = public.get_my_grade())
    )
  );

-- marks policies (open for now — future hardening target)
DROP POLICY IF EXISTS "Public marks are viewable by everyone" ON marks;
CREATE POLICY "Public marks are viewable by everyone" ON marks FOR SELECT USING (true);

-- Teacher-only writes (using is_teacher() to avoid recursion)
DROP POLICY IF EXISTS "Teachers can insert announcements" ON announcements;
CREATE POLICY "Teachers can insert announcements" ON announcements FOR INSERT
WITH CHECK (public.is_teacher());

DROP POLICY IF EXISTS "Teachers can insert files" ON files;
CREATE POLICY "Teachers can insert files" ON files FOR INSERT
WITH CHECK (public.is_teacher());

DROP POLICY IF EXISTS "Teachers can insert tests" ON tests;
CREATE POLICY "Teachers can insert tests" ON tests FOR INSERT
WITH CHECK (public.is_teacher());

DROP POLICY IF EXISTS "Teachers can manage marks" ON marks;
CREATE POLICY "Teachers can manage marks" ON marks FOR ALL
USING (public.is_teacher());

-- 6. Automatic Profile Creation Trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, name, username, role, grade, subjects, phone)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'name', ''),
    COALESCE(new.raw_user_meta_data->>'username', new.email),
    COALESCE(new.raw_user_meta_data->>'role', 'student'),
    new.raw_user_meta_data->>'grade',
    new.raw_user_meta_data->>'subjects',
    new.raw_user_meta_data->>'phone'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger the function after every sign-up
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 7. Board Results (Independent from internal tests/marks)
CREATE TABLE IF NOT EXISTS board_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_name TEXT NOT NULL,
  subject TEXT NOT NULL,
  marks_obtained INTEGER NOT NULL,
  max_marks INTEGER NOT NULL DEFAULT 100,
  passing_year INTEGER NOT NULL,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE board_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public board results are viewable by everyone" ON board_results;
CREATE POLICY "Public board results are viewable by everyone" ON board_results FOR SELECT USING (true);

DROP POLICY IF EXISTS "Teachers can manage board results" ON board_results;
CREATE POLICY "Teachers can manage board results" ON board_results FOR ALL
USING (public.is_teacher());

-- 8. Testimonials
CREATE TABLE IF NOT EXISTS testimonials (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_name TEXT NOT NULL,
  testimonial_text TEXT NOT NULL,
  subject TEXT,
  year TEXT,
  media_url TEXT,
  media_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE testimonials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public testimonials are viewable by everyone" ON testimonials;
CREATE POLICY "Public testimonials are viewable by everyone" ON testimonials FOR SELECT USING (true);

DROP POLICY IF EXISTS "Teachers can manage testimonials" ON testimonials;
CREATE POLICY "Teachers can manage testimonials" ON testimonials FOR ALL
USING (public.is_teacher());

-- 9. Storage Buckets & Policies
-- Note: Replace inserts with Supabase dashboard UI creation if errors persist
INSERT INTO storage.buckets (id, name, public) 
VALUES ('materials', 'materials', true),
       ('testimonials', 'testimonials', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies for materials
DROP POLICY IF EXISTS "Public Access materials" ON storage.objects;
CREATE POLICY "Public Access materials" ON storage.objects FOR SELECT USING (bucket_id = 'materials');

DROP POLICY IF EXISTS "Teacher Upload materials" ON storage.objects;
CREATE POLICY "Teacher Upload materials" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'materials' AND public.is_teacher());

-- Storage Policies for testimonials
DROP POLICY IF EXISTS "Public Access testimonials" ON storage.objects;
CREATE POLICY "Public Access testimonials" ON storage.objects FOR SELECT USING (bucket_id = 'testimonials');

DROP POLICY IF EXISTS "Teacher Upload/Delete testimonials" ON storage.objects;
CREATE POLICY "Teacher Upload/Delete testimonials" ON storage.objects FOR ALL USING (bucket_id = 'testimonials' AND public.is_teacher());

-- 10. Batches
CREATE TABLE IF NOT EXISTS batches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  subject TEXT,
  grade TEXT,
  schedule TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public batches are viewable by everyone" ON batches;

CREATE POLICY "Grade-scoped batch visibility" ON batches
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND (
      (public.get_my_role() = 'teacher' AND (public.get_my_grade() IS NULL OR public.get_my_grade() = 'All Grades'))
      OR (public.get_my_role() = 'teacher' AND public.get_my_grade() IS NOT NULL AND public.get_my_grade() <> 'All Grades' AND batches.grade = public.get_my_grade())
      OR (public.get_my_role() = 'student' AND batches.grade = public.get_my_grade())
    )
  );

DROP POLICY IF EXISTS "Teachers can manage batches" ON batches;
CREATE POLICY "Teachers can manage batches" ON batches FOR ALL
USING (public.is_teacher());

-- 11. Batch Students (Junction Table)
CREATE TABLE IF NOT EXISTS batch_students (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_id UUID REFERENCES batches(id) ON DELETE CASCADE,
  student_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(batch_id, student_id)
);

ALTER TABLE batch_students ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public batch students are viewable by everyone" ON batch_students;

CREATE POLICY "Grade-scoped batch_students visibility" ON batch_students
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND (
      (public.get_my_role() = 'teacher' AND (public.get_my_grade() IS NULL OR public.get_my_grade() = 'All Grades'))
      OR (public.get_my_role() = 'teacher' AND public.get_my_grade() IS NOT NULL AND public.get_my_grade() <> 'All Grades'
          AND batch_students.batch_id IN (SELECT id FROM public.batches WHERE grade = public.get_my_grade()))
      OR (public.get_my_role() = 'student'
          AND batch_students.batch_id IN (SELECT id FROM public.batches WHERE grade = public.get_my_grade()))
    )
  );

DROP POLICY IF EXISTS "Teachers can manage batch students" ON batch_students;
CREATE POLICY "Teachers can manage batch students" ON batch_students FOR ALL
USING (public.is_teacher());

-- 12. Classes (Schedule)
CREATE TABLE IF NOT EXISTS classes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_id UUID REFERENCES batches(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  type TEXT CHECK (type IN ('regular', 'extra')) DEFAULT 'regular',
  day_of_week INTEGER,          -- 0=Sun..6=Sat (for regular classes)
  class_date DATE,              -- specific date (for extra classes)
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  class_group_id UUID
);

ALTER TABLE classes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public classes are viewable by everyone" ON classes;

CREATE POLICY "Grade-scoped class visibility" ON classes
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND (
      (public.get_my_role() = 'teacher' AND (public.get_my_grade() IS NULL OR public.get_my_grade() = 'All Grades'))
      OR (public.get_my_role() = 'teacher' AND public.get_my_grade() IS NOT NULL AND public.get_my_grade() <> 'All Grades'
          AND classes.batch_id IN (SELECT id FROM public.batches WHERE grade = public.get_my_grade()))
      OR (public.get_my_role() = 'student'
          AND classes.batch_id IN (SELECT id FROM public.batches WHERE grade = public.get_my_grade()))
    )
  );

DROP POLICY IF EXISTS "Teachers can manage classes" ON classes;
CREATE POLICY "Teachers can manage classes" ON classes FOR ALL
USING (public.is_teacher());

-- 13. Attendance
CREATE TABLE IF NOT EXISTS attendance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_id UUID REFERENCES batches(id) ON DELETE CASCADE,
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  student_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status TEXT CHECK (status IN ('present', 'absent', 'late')) DEFAULT 'present',
  marked_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(class_id, student_id, date)
);

ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public attendance is viewable by everyone" ON attendance;

CREATE POLICY "Grade-scoped attendance visibility" ON attendance
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND (
      (public.get_my_role() = 'teacher' AND (public.get_my_grade() IS NULL OR public.get_my_grade() = 'All Grades'))
      OR (public.get_my_role() = 'teacher' AND public.get_my_grade() IS NOT NULL AND public.get_my_grade() <> 'All Grades'
          AND attendance.batch_id IN (SELECT id FROM public.batches WHERE grade = public.get_my_grade()))
      OR (public.get_my_role() = 'student' AND attendance.student_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Teachers can manage attendance" ON attendance;
CREATE POLICY "Teachers can manage attendance" ON attendance FOR ALL
USING (public.is_teacher());

-- 14. Batch Transfers (Cross-Batch Attendance)
CREATE TABLE IF NOT EXISTS batch_transfers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  from_batch_id UUID REFERENCES batches(id) ON DELETE CASCADE,
  to_batch_id UUID REFERENCES batches(id) ON DELETE CASCADE,
  transfer_date DATE NOT NULL,
  end_date DATE,
  reason TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE batch_transfers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public batch transfers are viewable by everyone" ON batch_transfers;
CREATE POLICY "Public batch transfers are viewable by everyone" ON batch_transfers FOR SELECT USING (true);

DROP POLICY IF EXISTS "Teachers can manage batch transfers" ON batch_transfers;
CREATE POLICY "Teachers can manage batch transfers" ON batch_transfers FOR ALL
USING (public.is_teacher());

-- 15. RAG: match_chunks RPC (pgvector similarity search)
CREATE OR REPLACE FUNCTION match_chunks(
  query_embedding vector(512),
  match_subject   text,
  match_grade     text,
  match_count     int    default 5,
  match_file_id   uuid   default null,
  match_threshold float  default 0.0
)
RETURNS TABLE (content text, similarity float, file_id uuid)
LANGUAGE sql STABLE
AS $$
  SELECT mc.content, 1 - (mc.embedding <=> query_embedding) AS similarity, mc.file_id
  FROM material_chunks mc
  WHERE mc.embedding IS NOT NULL
    AND (1 - (mc.embedding <=> query_embedding)) >= match_threshold
    AND (
      (match_file_id IS NOT NULL AND mc.file_id = match_file_id)
      OR (match_file_id IS NULL AND mc.subject = match_subject AND mc.grade = match_grade)
    )
  ORDER BY mc.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- 16. Doubt Cache
CREATE TABLE IF NOT EXISTS doubt_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  question_hash TEXT NOT NULL,
  subject TEXT NOT NULL,
  grade TEXT NOT NULL,
  question_text TEXT NOT NULL,
  answer TEXT NOT NULL,
  sources JSONB DEFAULT '[]'::jsonb,
  suggestions JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(question_hash, subject, grade)
);

ALTER TABLE doubt_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on doubt_cache" ON doubt_cache;
CREATE POLICY "Service role full access on doubt_cache" ON doubt_cache
  FOR ALL USING (true);

-- 17. Student Rankings View
-- Ranks students by a Bayesian (confidence-weighted) score that blends each student's avg %
-- with the class mean. Formula: (tests_taken × avg_pct + C × class_avg) / (tests_taken + C)
-- where C = 3. Students with no tests taken get NULL final_score and appear last (unranked).
CREATE OR REPLACE VIEW student_rankings AS
WITH student_stats AS (
  SELECT
    p.id AS student_id,
    p.name,
    p.grade,
    ROUND(
      SUM(m.marks_obtained::numeric) / NULLIF(SUM(t.max_marks), 0) * 100,
      2
    ) AS avg_percentage,
    COUNT(m.id) AS tests_taken
  FROM profiles p
  LEFT JOIN marks m ON m.student_id = p.id
  LEFT JOIN tests t ON t.id = m.test_id
  WHERE p.role = 'student'
  GROUP BY p.id, p.name, p.grade
),
class_avg_cte AS (
  -- Class average computed per grade separately
  SELECT grade, ROUND(AVG(avg_percentage), 2) AS class_avg
  FROM student_stats
  WHERE tests_taken > 0
  GROUP BY grade
)
SELECT
  ss.student_id,
  ss.name,
  ss.grade,
  ss.avg_percentage,
  ss.tests_taken,
  ca.class_avg,
  CASE
    WHEN ss.tests_taken > 0 THEN
      ROUND((ss.tests_taken * ss.avg_percentage + 3 * ca.class_avg) / (ss.tests_taken + 3), 2)
    ELSE NULL
  END AS final_score,
  -- Rank is partitioned per grade — Grade 11 and Grade 12 each have their own #1
  RANK() OVER (
    PARTITION BY ss.grade
    ORDER BY
      CASE
        WHEN ss.tests_taken > 0 THEN
          (ss.tests_taken * ss.avg_percentage + 3 * ca.class_avg) / (ss.tests_taken + 3)
        ELSE NULL
      END DESC NULLS LAST
  ) AS rank
FROM student_stats ss
LEFT JOIN class_avg_cte ca ON ca.grade = ss.grade;

ALTER VIEW public.student_rankings SET (security_invoker = true);

-- 18. Rank History (weekly snapshots for movement tracking)
CREATE TABLE IF NOT EXISTS rank_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  rank INTEGER,
  avg_percentage NUMERIC,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, snapshot_date)
);

ALTER TABLE rank_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public rank history is viewable by everyone" ON rank_history;
CREATE POLICY "Public rank history is viewable by everyone" ON rank_history FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service role can manage rank history" ON rank_history;
CREATE POLICY "Service role can manage rank history" ON rank_history FOR ALL USING (true);

-- 19. Doubt Feedback
CREATE TABLE IF NOT EXISTS doubt_feedback (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  subject TEXT,
  grade TEXT,
  rating TEXT CHECK (rating IN ('up', 'down')) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE doubt_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own feedback" ON doubt_feedback;
CREATE POLICY "Users can insert own feedback" ON doubt_feedback
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Teachers can view all feedback" ON doubt_feedback;
CREATE POLICY "Teachers can view all feedback" ON doubt_feedback
  FOR SELECT USING (public.is_teacher());

-- 20. Material Chunks (RAG / pgvector)
CREATE TABLE IF NOT EXISTS material_chunks (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  file_id     UUID REFERENCES files(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content     TEXT NOT NULL,
  embedding   vector(512),
  subject     TEXT,
  grade       TEXT,
  teacher_id  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS material_chunks_embedding_idx
  ON material_chunks USING ivfflat (embedding vector_cosine_ops);

ALTER TABLE material_chunks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on material_chunks" ON material_chunks;
CREATE POLICY "Service role full access on material_chunks" ON material_chunks
  FOR ALL USING (true);

-- 21. WhatsApp Log (Outbound Message History)
CREATE TABLE IF NOT EXISTS whatsapp_log (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  message_type   TEXT DEFAULT 'report',
  preview        TEXT,
  sent_by        UUID REFERENCES profiles(id) ON DELETE SET NULL,
  sent_at        TIMESTAMPTZ DEFAULT NOW(),
  recipient_phone TEXT,
  recipient_name  TEXT,
  recipient_type  TEXT DEFAULT 'student'
);

ALTER TABLE whatsapp_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Teachers can view whatsapp log" ON whatsapp_log;
CREATE POLICY "Teachers can view whatsapp log" ON whatsapp_log
  FOR SELECT USING (public.is_teacher());

DROP POLICY IF EXISTS "Service role can insert whatsapp log" ON whatsapp_log;
CREATE POLICY "Service role can insert whatsapp log" ON whatsapp_log
  FOR INSERT WITH CHECK (true);

-- 22. Feature Flags (Admin-Controlled Feature Toggles)
CREATE TABLE IF NOT EXISTS feature_flags (
  key         TEXT PRIMARY KEY,
  enabled     BOOLEAN NOT NULL DEFAULT true,
  label       TEXT NOT NULL,
  description TEXT,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read feature flags" ON feature_flags;
CREATE POLICY "Public can read feature flags" ON feature_flags
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service role can manage feature flags" ON feature_flags;
CREATE POLICY "Service role can manage feature flags" ON feature_flags
  FOR ALL USING (true);

-- Seed default feature flags (idempotent)
INSERT INTO feature_flags (key, label, enabled) VALUES
  ('ai_tools_enabled',       'AI Tools',          true),
  ('announcements_enabled',  'Announcements',     true),
  ('attendance_enabled',     'Attendance',        true),
  ('batches_enabled',        'Batches',           true),
  ('leaderboard_enabled',    'Leaderboard',       true),
  ('materials_enabled',      'Materials',         true),
  ('messages_enabled',       'WhatsApp Messages', true),
  ('schedule_enabled',       'Schedule',          true),
  ('student_portal_enabled', 'Student Portal',    true),
  ('students_enabled',       'Students',          true),
  ('tests_enabled',          'Tests',             true)
ON CONFLICT (key) DO NOTHING;

-- 23. Question Bank (ISC Past Paper Questions)
CREATE TABLE IF NOT EXISTS question_bank (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  year          INTEGER,
  subject       TEXT NOT NULL,
  grade         TEXT NOT NULL,
  section       TEXT NOT NULL,
  marks         INTEGER NOT NULL,
  question_type TEXT NOT NULL,
  cog_level     TEXT NOT NULL DEFAULT 'balanced',
  topic_tags    TEXT[] DEFAULT '{}',
  question_text TEXT NOT NULL,
  answer_text   TEXT NOT NULL,
  embedding     vector(512),
  uploaded_by   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE question_bank ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read question bank" ON question_bank;
CREATE POLICY "Authenticated users can read question bank" ON question_bank
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can insert question bank" ON question_bank;
CREATE POLICY "Authenticated users can insert question bank" ON question_bank
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can delete question bank" ON question_bank;
CREATE POLICY "Authenticated users can delete question bank" ON question_bank
  FOR DELETE USING (auth.role() = 'authenticated');

-- 24. WhatsApp Incoming (Inbound Webhook Messages)
-- Note: Also created via migration 20260325000000_create_whatsapp_incoming.sql
CREATE TABLE IF NOT EXISTS whatsapp_incoming (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type   TEXT,
  from_number  TEXT,
  message_text TEXT,
  raw_payload  JSONB,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE whatsapp_incoming ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Teachers can view incoming messages" ON whatsapp_incoming;
CREATE POLICY "Teachers can view incoming messages" ON whatsapp_incoming
  FOR SELECT USING (public.is_teacher());

DROP POLICY IF EXISTS "Service role can insert incoming messages" ON whatsapp_incoming;
CREATE POLICY "Service role can insert incoming messages" ON whatsapp_incoming
  FOR INSERT WITH CHECK (true);

-- 25. profiles.teacher_notes (Private Teacher Notes per Student)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS teacher_notes TEXT;

-- 26. files.upload_type — expand constraint to include 'test' (AI-generated test papers)
ALTER TABLE files DROP CONSTRAINT IF EXISTS files_upload_type_check;
ALTER TABLE files ADD CONSTRAINT files_upload_type_check
  CHECK (upload_type IN ('student', 'ai', 'test'));

