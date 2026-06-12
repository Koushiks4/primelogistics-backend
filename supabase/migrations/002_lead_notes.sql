CREATE TABLE lead_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_lead_notes_lead ON lead_notes(lead_id);
ALTER TABLE lead_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_lead_notes" ON lead_notes FOR ALL USING (true) WITH CHECK (true);
