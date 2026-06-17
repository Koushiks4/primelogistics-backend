-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enum types
CREATE TYPE user_role AS ENUM ('admin', 'staff');
CREATE TYPE shipment_type AS ENUM ('domestic', 'international');
CREATE TYPE order_status AS ENUM (
  'booked', 'picked_up', 'in_transit', 'out_for_delivery',
  'delivered', 'on_hold', 'returned', 'cancelled'
);
CREATE TYPE lead_source AS ENUM ('manual', 'contact_us', 'shipment_enquiry', 'franchise_request');
CREATE TYPE lead_status AS ENUM ('new', 'contacted', 'qualified', 'converted', 'lost');
CREATE TYPE invoice_status AS ENUM ('draft', 'sent', 'paid', 'overdue', 'cancelled');
CREATE TYPE notification_type AS ENUM ('email', 'whatsapp');
CREATE TYPE notification_status AS ENUM ('pending', 'sent', 'failed');

-- Profiles (linked to Supabase auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'staff',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- NOTE: No auto-profile trigger. Profiles are created explicitly by the
-- admin invite endpoint (POST /api/admin/users) to prevent unauthorized
-- access via crafted Supabase signups.

-- AWB counter
CREATE TABLE awb_counter (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  prefix TEXT NOT NULL DEFAULT 'PLS',
  current_number INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO awb_counter (id, prefix, current_number) VALUES (1, 'PLS', 0);

-- Invoice counter
CREATE TABLE invoice_counter (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  prefix TEXT NOT NULL DEFAULT 'INV',
  current_number INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO invoice_counter (id, prefix, current_number) VALUES (1, 'INV', 0);

-- Function to generate next AWB number
CREATE OR REPLACE FUNCTION generate_awb_number()
RETURNS TEXT AS $$
DECLARE
  v_prefix TEXT;
  v_number INTEGER;
  v_year TEXT;
BEGIN
  UPDATE awb_counter
  SET current_number = current_number + 1, updated_at = now()
  WHERE id = 1
  RETURNING prefix, current_number INTO v_prefix, v_number;

  v_year := EXTRACT(YEAR FROM now())::TEXT;
  RETURN v_prefix || '-' || v_year || '-' || LPAD(v_number::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

-- Function to generate next invoice number
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TEXT AS $$
DECLARE
  v_prefix TEXT;
  v_number INTEGER;
  v_year TEXT;
BEGIN
  UPDATE invoice_counter
  SET current_number = current_number + 1, updated_at = now()
  WHERE id = 1
  RETURNING prefix, current_number INTO v_prefix, v_number;

  v_year := EXTRACT(YEAR FROM now())::TEXT;
  RETURN v_prefix || '-' || v_year || '-' || LPAD(v_number::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

-- Orders
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  awb_number TEXT UNIQUE NOT NULL,
  partner_name TEXT,
  partner_awb_number TEXT,
  shipment_type shipment_type NOT NULL,
  status order_status NOT NULL DEFAULT 'booked',
  sender_name TEXT,
  sender_phone TEXT,
  sender_email TEXT,
  sender_address TEXT,
  receiver_name TEXT,
  receiver_phone TEXT,
  receiver_email TEXT,
  receiver_address TEXT,
  origin_city TEXT,
  destination_city TEXT,
  weight DECIMAL,
  dimensions JSONB,
  description TEXT,
  special_instructions TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_orders_awb_number ON orders(awb_number);
CREATE INDEX idx_orders_partner_awb ON orders(partner_awb_number) WHERE partner_awb_number IS NOT NULL;
CREATE INDEX idx_orders_status ON orders(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_orders_shipment_type ON orders(shipment_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_orders_created_at ON orders(created_at) WHERE deleted_at IS NULL;

-- Order status history
CREATE TABLE order_status_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status order_status NOT NULL,
  location TEXT,
  remarks TEXT,
  updated_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_status_history_order ON order_status_history(order_id);

-- Leads
CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source lead_source NOT NULL,
  status lead_status NOT NULL DEFAULT 'new',
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  message TEXT,
  origin_city TEXT,
  destination_city TEXT,
  shipment_type shipment_type,
  approximate_weight TEXT,
  city TEXT,
  investment_budget TEXT,
  business_experience TEXT,
  notes TEXT,
  assigned_to UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_leads_source ON leads(source);
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_created_at ON leads(created_at);

-- Invoices
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_number TEXT UNIQUE NOT NULL,
  client_name TEXT NOT NULL,
  client_email TEXT,
  client_phone TEXT,
  client_address TEXT,
  client_gstin TEXT,
  invoice_date DATE NOT NULL,
  due_date DATE,
  subtotal DECIMAL NOT NULL,
  tax_amount DECIMAL NOT NULL DEFAULT 0,
  discount_amount DECIMAL NOT NULL DEFAULT 0,
  total_amount DECIMAL NOT NULL,
  status invoice_status NOT NULL DEFAULT 'draft',
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_date ON invoices(invoice_date);

-- Invoice items
CREATE TABLE invoice_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity DECIMAL NOT NULL DEFAULT 1,
  unit_price DECIMAL NOT NULL,
  amount DECIMAL NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_invoice_items_invoice ON invoice_items(invoice_id);

-- Notification logs
CREATE TABLE notification_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type notification_type NOT NULL,
  recipient TEXT NOT NULL,
  subject TEXT,
  content TEXT,
  status notification_status NOT NULL DEFAULT 'pending',
  related_type TEXT,
  related_id UUID,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notification_logs_related ON notification_logs(related_type, related_id);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
