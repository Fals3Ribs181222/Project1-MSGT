create table if not exists whatsapp_incoming (
  id uuid primary key default gen_random_uuid(),
  event_type text,          -- 'message' or 'status'
  from_number text,
  message_text text,
  raw_payload jsonb,
  created_at timestamptz default now()
);
