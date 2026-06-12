CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  gstin TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_clients" ON clients FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE invoices ADD COLUMN client_id UUID REFERENCES clients(id);
