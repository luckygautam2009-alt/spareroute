-- Migration 003: Payments, Order Status History, Return Requests, and Refunds

DO $$ BEGIN
  CREATE TYPE payment_method AS ENUM ('cod', 'online');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM ('pending', 'succeeded', 'cancelled', 'refunded', 'partially_refunded');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE return_status AS ENUM ('requested', 'approved', 'rejected', 'received', 'refunded');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE refund_status AS ENUM ('pending', 'processed', 'failed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Alter orders table
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS cancel_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_orders_cancelled_by ON orders(cancelled_by);

-- Payments table
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES users(id),
  amount_paise BIGINT NOT NULL CHECK (amount_paise >= 0),
  method payment_method NOT NULL DEFAULT 'cod',
  status payment_status NOT NULL DEFAULT 'pending',
  collected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_buyer ON payments(buyer_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

-- Order status history table
CREATE TABLE IF NOT EXISTS order_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  from_status order_status,
  to_status order_status NOT NULL,
  changed_by UUID REFERENCES users(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_status_history_order ON order_status_history(order_id);
CREATE INDEX IF NOT EXISTS idx_order_status_history_changed_at ON order_status_history(changed_at);

-- Return requests table
CREATE TABLE IF NOT EXISTS return_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES users(id),
  reason TEXT NOT NULL CHECK (char_length(reason) >= 3 AND char_length(reason) <= 500),
  status return_status NOT NULL DEFAULT 'requested',
  seller_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_return_requests_order ON return_requests(order_id);
CREATE INDEX IF NOT EXISTS idx_return_requests_buyer ON return_requests(buyer_id);
CREATE INDEX IF NOT EXISTS idx_return_requests_status ON return_requests(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_return_requests_active_order ON return_requests(order_id)
  WHERE status IN ('requested', 'approved', 'received');

-- Refunds table
CREATE TABLE IF NOT EXISTS refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  return_request_id UUID REFERENCES return_requests(id) ON DELETE SET NULL,
  amount_paise BIGINT NOT NULL CHECK (amount_paise > 0),
  status refund_status NOT NULL DEFAULT 'pending',
  reason TEXT,
  idempotency_key TEXT UNIQUE NOT NULL,
  created_by UUID NOT NULL REFERENCES users(id),
  processed_by UUID REFERENCES users(id),
  processed_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_refunds_order ON refunds(order_id);
CREATE INDEX IF NOT EXISTS idx_refunds_payment ON refunds(payment_id);
CREATE INDEX IF NOT EXISTS idx_refunds_return_request ON refunds(return_request_id);
CREATE INDEX IF NOT EXISTS idx_refunds_status ON refunds(status);

-- Backfill delivered_at on orders for existing delivered / returned orders
UPDATE orders
SET delivered_at = updated_at
WHERE status IN ('delivered', 'returned') AND delivered_at IS NULL;

-- Backfill order_status_history for existing orders
INSERT INTO order_status_history (order_id, from_status, to_status, changed_by, changed_at)
SELECT o.id, NULL, o.status, NULL, o.updated_at
FROM orders o
WHERE NOT EXISTS (
  SELECT 1 FROM order_status_history h WHERE h.order_id = o.id
);

-- Backfill payments for existing orders
INSERT INTO payments (order_id, buyer_id, amount_paise, method, status, collected_at, created_at, updated_at)
SELECT
  o.id,
  o.buyer_id,
  (o.total_amount_paise + o.service_fee_paise) AS amount_paise,
  'cod'::payment_method,
  (CASE
    WHEN o.status IN ('delivered', 'returned') THEN 'succeeded'::payment_status
    WHEN o.status IN ('cancelled', 'rejected_by_seller') THEN 'cancelled'::payment_status
    ELSE 'pending'::payment_status
  END) AS status,
  (CASE
    WHEN o.status IN ('delivered', 'returned') THEN o.updated_at
    ELSE NULL
  END) AS collected_at,
  o.created_at,
  o.updated_at
FROM orders o
WHERE NOT EXISTS (
  SELECT 1 FROM payments p WHERE p.order_id = o.id
);
