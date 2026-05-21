-- Student self-registration requests (pending teacher approval)
CREATE TABLE IF NOT EXISTS registration_requests (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name          text NOT NULL,
    phone         text,
    email         text,
    father_name   text,
    father_phone  text,
    mother_name   text,
    mother_phone  text,
    grade         text NOT NULL,
    subjects      text,
    school        text,
    status        text NOT NULL DEFAULT 'pending',  -- pending | approved | rejected
    submitted_at  timestamptz DEFAULT now(),
    reviewed_at   timestamptz,
    reviewed_by   uuid REFERENCES profiles(id) ON DELETE SET NULL
);

ALTER TABLE registration_requests ENABLE ROW LEVEL SECURITY;

-- Anyone (including unauthenticated visitors) can submit
CREATE POLICY "public_insert_registration"
ON registration_requests FOR INSERT
WITH CHECK (true);

-- Only teachers and admins can read
CREATE POLICY "teacher_select_registration"
ON registration_requests FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
          AND profiles.role IN ('teacher', 'admin')
    )
);

-- Only teachers and admins can update (approve / reject)
CREATE POLICY "teacher_update_registration"
ON registration_requests FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
          AND profiles.role IN ('teacher', 'admin')
    )
);
