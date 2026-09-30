CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE tickets (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  order_id TEXT,
  category TEXT,
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  date TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_on TIMESTAMPTZ,
  resolution TEXT,
  notes TEXT,
  analysis JSONB,
  investigation JSONB,
  root_cause JSONB,
  decision JSONB
);

CREATE INDEX idx_tickets_customer ON tickets(customer_id);

CREATE TABLE policies (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  condition TEXT NOT NULL,
  eligible_within_days INTEGER,
  description TEXT NOT NULL
);

CREATE TABLE refunds (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  status TEXT NOT NULL,
  initiated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  reason TEXT,
  gateway_ref TEXT
);

CREATE INDEX idx_refunds_customer ON refunds(customer_id);

CREATE TABLE security_events (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  ip TEXT,
  location TEXT,
  device TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  flagged BOOLEAN NOT NULL DEFAULT FALSE,
  alert TEXT
);

INSERT INTO policies (id, title, condition, eligible_within_days, description) VALUES
('POLICY1', 'Failed Payment / Amount Deducted', 'gateway_success_local_failed', NULL, 'If the payment gateway confirms a successful debit but the order was not created locally, the customer is eligible for a reconciliation refund.'),
('POLICY2', 'Refund Pending', 'refund_pending', NULL, 'An initiated refund that is still in pending status is being processed and awaiting bank settlement.'),
('POLICY3', 'Return & Exchange', 'delivered_no_return_requested', 10, 'Products can be returned within 10 days of delivery if unused and undamaged.'),
('POLICY4', 'Return Received — Refund Eligibility', 'return_received_at_warehouse', NULL, 'If a returned item has been received at the warehouse, the customer is fully eligible for a refund.'),
('POLICY5', 'Order Cancellation', 'order_cancelled', NULL, 'Customers may request confirmation of cancellation status and reason for any order marked cancelled in the system.'),
('POLICY6', 'Damaged Product Claim', 'damaged_product', 7, 'Physical damage claims require photo verification from the customer before a replacement or refund is issued.'),
('POLICY7', 'Duplicate Payment Refund', 'duplicate_payment', 7, 'Customers are eligible for a full refund if a duplicate payment is detected within 7 days of transaction.'),
('POLICY8', 'Wrong Product Delivered', 'wrong_item_received', 7, 'If a customer receives an item different from what was ordered, warehouse dispatch logs must be compared before a refund or replacement is issued.'),
('POLICY9', 'Account Security Review', 'suspicious_activity', NULL, 'Any suspected unauthorized account access must be escalated to the security team for manual review before any account or payment action is taken.'),
('POLICY10', 'Delivered Not Received', 'delivered_not_received', NULL, 'If tracking shows delivery but the customer disputes receipt, courier proof-of-delivery must be obtained before resolution.'),
('POLICY11', 'Delayed Delivery / In-Transit', 'delivery_delay', NULL, 'If an order remains in_transit beyond its expected delivery window, the customer is eligible for a shipping credit or expedited redelivery.');
