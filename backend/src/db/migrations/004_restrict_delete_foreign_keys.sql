-- Migration 004: Change ON DELETE CASCADE to ON DELETE RESTRICT on foreign keys:
-- payments.order_id, refunds.order_id, refunds.payment_id, order_status_history.order_id, return_requests.order_id

DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN (
    SELECT
      tc.table_name,
      kcu.column_name,
      tc.constraint_name,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name,
      rc.delete_rule
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.referential_constraints AS rc
      ON tc.constraint_name = rc.constraint_name
    JOIN information_schema.constraint_column_usage AS ccu
      ON rc.unique_constraint_name = ccu.constraint_name
      AND rc.unique_constraint_schema = ccu.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND (
        (tc.table_name = 'payments' AND kcu.column_name = 'order_id') OR
        (tc.table_name = 'refunds' AND kcu.column_name = 'order_id') OR
        (tc.table_name = 'refunds' AND kcu.column_name = 'payment_id') OR
        (tc.table_name = 'order_status_history' AND kcu.column_name = 'order_id') OR
        (tc.table_name = 'return_requests' AND kcu.column_name = 'order_id')
      )
  ) LOOP
    IF rec.delete_rule != 'RESTRICT' THEN
      EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', rec.table_name, rec.constraint_name);
      EXECUTE format(
        'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES %I(%I) ON DELETE RESTRICT',
        rec.table_name,
        rec.constraint_name,
        rec.column_name,
        rec.foreign_table_name,
        rec.foreign_column_name
      );
    END IF;
  END LOOP;
END $$;
