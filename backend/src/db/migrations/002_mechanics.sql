CREATE TABLE mechanics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  service_fee_paise BIGINT NOT NULL DEFAULT 0 CHECK (service_fee_paise >= 0),
  avg_rating NUMERIC(3,2) NOT NULL DEFAULT 0,
  total_ratings INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_mechanics_seller ON mechanics(seller_id);

ALTER TABLE orders
  ADD COLUMN mechanic_id UUID REFERENCES mechanics(id),
  ADD COLUMN service_fee_paise BIGINT NOT NULL DEFAULT 0 CHECK (service_fee_paise >= 0),
  ADD COLUMN mechanic_rating INT CHECK (mechanic_rating BETWEEN 1 AND 5),
  ADD COLUMN mechanic_rating_comment TEXT;
