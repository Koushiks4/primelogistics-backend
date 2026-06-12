CREATE TABLE partner_sync_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES orders(id),
  partner_name TEXT NOT NULL,
  partner_awb TEXT NOT NULL,
  old_status TEXT,
  new_status TEXT,
  source TEXT NOT NULL DEFAULT 'webhook',
  raw_response JSONB,
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sync_logs_order ON partner_sync_logs(order_id);
CREATE INDEX idx_sync_logs_created ON partner_sync_logs(created_at);
ALTER TABLE partner_sync_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_sync_logs" ON partner_sync_logs FOR ALL USING (true) WITH CHECK (true);
