-- Migration 005: Order Numbers (SR-XXXXXXXX) sequence and column
CREATE SEQUENCE IF NOT EXISTS order_number_seq;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS order_number TEXT;

-- Backfill existing orders in created_at order if any have NULL order_number
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM orders WHERE order_number IS NULL ORDER BY created_at ASC, id ASC LOOP
    UPDATE orders
    SET order_number = 'SR-' || lpad(nextval('order_number_seq')::text, 8, '0')
    WHERE id = r.id;
  END LOOP;
END $$;

-- Set DEFAULT and NOT NULL
ALTER TABLE orders
  ALTER COLUMN order_number SET DEFAULT 'SR-' || lpad(nextval('order_number_seq')::text, 8, '0');

ALTER TABLE orders
  ALTER COLUMN order_number SET NOT NULL;

-- Unique constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_order_number_key'
  ) THEN
    ALTER TABLE orders ADD CONSTRAINT orders_order_number_key UNIQUE (order_number);
  END IF;
END $$;

-- Move the sequence past the highest value
DO $$
DECLARE
  max_val bigint;
BEGIN
  SELECT COALESCE(MAX(SUBSTRING(order_number FROM 'SR-([0-9]+)')::bigint), 0)
    INTO max_val
    FROM orders;

  IF max_val >= 1 THEN
    PERFORM setval('order_number_seq', max_val, true);
  END IF;
END $$;
