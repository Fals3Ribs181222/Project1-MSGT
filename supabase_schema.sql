-- Supabase Schema for Mitesh Sir's Group Tuitions

-- 1. Profiles Table (Extends Auth Users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  name TEXT NOT NULL,
  username TEXT UNIQUE NOT NULL,
  role TEXT CHECK (role IN ('teacher', 'student')) DEFAULT 'student',
  grade TEXT,
  subjects TEXT,
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

-- Helper function to check teacher role (SECURITY DEFINER bypasses RLS to prevent recursion)
CREATE OR REPLACE FUNCTION public.is_teacher()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'teacher'
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Basic Policies (Safe Re-run)
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
CREATE POLICY "Public profiles are viewable by everyone" ON profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
CREATE POLICY "Users can update their own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Teachers can manage all profiles" ON profiles;
CREATE POLICY "Teachers can manage all profiles" ON profiles FOR ALL 
USING (public.is_teacher());

DROP POLICY IF EXISTS "Public announcements are viewable by everyone" ON announcements;
CREATE POLICY "Public announcements are viewable by everyone" ON announcements FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public files are viewable by everyone" ON files;
CREATE POLICY "Public files are viewable by everyone" ON files FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public tests are viewable by everyone" ON tests;
CREATE POLICY "Public tests are viewable by everyone" ON tests FOR SELECT USING (true);

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
  INSERT INTO public.profiles (id, name, username, role, grade, subjects)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'name', ''),
    COALESCE(new.raw_user_meta_data->>'username', new.email),
    COALESCE(new.raw_user_meta_data->>'role', 'student'),
    new.raw_user_meta_data->>'grade',
    new.raw_user_meta_data->>'subjects'
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
CREATE POLICY "Public batches are viewable by everyone" ON batches FOR SELECT USING (true);

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
CREATE POLICY "Public batch students are viewable by everyone" ON batch_students FOR SELECT USING (true);

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
CREATE POLICY "Public classes are viewable by everyone" ON classes FOR SELECT USING (true);

DROP POLICY IF EXISTS "Teachers can manage classes" ON classes;
CREATE POLICY "Teachers can manage classes" ON classes FOR ALL
USING (public.is_teacher());
