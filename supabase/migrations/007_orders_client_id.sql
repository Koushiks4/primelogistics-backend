ALTER TABLE orders ADD COLUMN client_id UUID REFERENCES clients(id);
CREATE INDEX idx_orders_client_id ON orders(client_id) WHERE deleted_at IS NULL;
