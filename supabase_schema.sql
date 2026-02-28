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

-- Basic Policies (Safe Re-run)
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
CREATE POLICY "Public profiles are viewable by everyone" ON profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
CREATE POLICY "Users can update their own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Teachers can manage all profiles" ON profiles;
CREATE POLICY "Teachers can manage all profiles" ON profiles FOR ALL 
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'teacher'));

DROP POLICY IF EXISTS "Public announcements are viewable by everyone" ON announcements;
CREATE POLICY "Public announcements are viewable by everyone" ON announcements FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public files are viewable by everyone" ON files;
CREATE POLICY "Public files are viewable by everyone" ON files FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public tests are viewable by everyone" ON tests;
CREATE POLICY "Public tests are viewable by everyone" ON tests FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public marks are viewable by everyone" ON marks;
CREATE POLICY "Public marks are viewable by everyone" ON marks FOR SELECT USING (true);

-- Teacher-only writes
DROP POLICY IF EXISTS "Teachers can insert announcements" ON announcements;
CREATE POLICY "Teachers can insert announcements" ON announcements FOR INSERT 
WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'teacher'));

DROP POLICY IF EXISTS "Teachers can insert files" ON files;
CREATE POLICY "Teachers can insert files" ON files FOR INSERT 
WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'teacher'));

DROP POLICY IF EXISTS "Teachers can insert tests" ON tests;
CREATE POLICY "Teachers can insert tests" ON tests FOR INSERT 
WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'teacher'));

DROP POLICY IF EXISTS "Teachers can manage marks" ON marks;
CREATE POLICY "Teachers can manage marks" ON marks FOR ALL 
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'teacher'));

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
