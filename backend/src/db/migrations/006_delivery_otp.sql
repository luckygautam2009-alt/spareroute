-- Migration 006: Delivery OTP table and delivered_via column on orders

CREATE TABLE IF NOT EXISTS order_delivery_otps (
  order_id UUID PRIMARY KEY REFERENCES orders(id) ON DELETE RESTRICT,
  otp_ciphertext TEXT,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  failed_attempts INT NOT NULL DEFAULT 0,
  locked_at TIMESTAMPTZ,
  regenerated_count INT NOT NULL DEFAULT 0,
  verified_at TIMESTAMPTZ
);

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS delivered_via TEXT CHECK (delivered_via IN ('otp', 'admin_override'));
