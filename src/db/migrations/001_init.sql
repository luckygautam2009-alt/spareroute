-- Run this with: psql "$DATABASE_URL" -f src/db/migrations/001_init.sql

CREATE EXTENSION IF NOT EXISTS pgcrypto; -- for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS citext;   -- for case-insensitive email column

CREATE TYPE user_role AS ENUM ('buyer', 'seller', 'delivery_partner', 'admin');
CREATE TYPE kyc_status AS ENUM ('not_started', 'pending', 'verified', 'failed');
CREATE TYPE order_status AS ENUM (
  'placed', 'accepted_by_seller', 'rejected_by_seller',
  'out_for_delivery', 'delivered', 'cancelled', 'returned'
);

-- ============ USERS (buyers, sellers, delivery partners, admins) ============
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email CITEXT UNIQUE, -- requires citext extension for case-insensitive email
  phone TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'buyer',

  -- Account security
  failed_login_attempts INT NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_role ON users(role);

-- ============ REFRESH TOKENS (hashed, so a DB leak alone can't be used to log in) ============
CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL, -- SHA-256 hash of the actual refresh token, never store raw
  expires_at TIMESTAMPTZ NOT NULL,
  revoked BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);

-- ============ SELLERS (extends users with business + KYC info) ============
CREATE TABLE sellers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  business_name TEXT NOT NULL,
  gstin TEXT, -- optional, validate format at app layer
  address TEXT,
  city TEXT,
  pincode TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,

  -- KYC: we NEVER store the raw Aadhaar number here. Only the
  -- verification provider's reference ID and status.
  kyc_status kyc_status NOT NULL DEFAULT 'not_started',
  kyc_provider TEXT,               -- e.g. 'digio'
  kyc_reference_id TEXT,           -- provider's verification/txn ID
  kyc_verified_at TIMESTAMPTZ,
  kyc_name_on_id TEXT,             -- name as returned by provider, for display/reconciliation only

  is_approved BOOLEAN NOT NULL DEFAULT FALSE, -- admin sign-off, separate from KYC
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sellers_city ON sellers(city);
CREATE INDEX idx_sellers_kyc_status ON sellers(kyc_status);

-- ============ VEHICLES + FITMENT (kept simple for MVP, expand later) ============
CREATE TABLE vehicle_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  generation TEXT,
  variant TEXT,
  engine TEXT,
  UNIQUE (make, model, generation, variant, engine)
);

-- ============ PRODUCTS (seller listings) ============
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  oem_part_number TEXT,
  compatible_part_numbers TEXT[], -- array of alternate/aftermarket numbers
  brand TEXT,
  category TEXT,
  price_paise BIGINT NOT NULL CHECK (price_paise >= 0), -- store money as integer paise, never float
  stock_quantity INT NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_products_seller ON products(seller_id);
CREATE INDEX idx_products_oem_number ON products(oem_part_number);
CREATE INDEX idx_products_category ON products(category);

CREATE TABLE product_fitments (
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  vehicle_model_id UUID NOT NULL REFERENCES vehicle_models(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, vehicle_model_id)
);

-- ============ ORDERS ============
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID NOT NULL REFERENCES users(id),
  seller_id UUID NOT NULL REFERENCES sellers(id),
  status order_status NOT NULL DEFAULT 'placed',
  total_amount_paise BIGINT NOT NULL CHECK (total_amount_paise >= 0),
  delivery_address TEXT NOT NULL,
  delivery_latitude DOUBLE PRECISION,
  delivery_longitude DOUBLE PRECISION,
  delivery_partner_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_orders_buyer ON orders(buyer_id);
CREATE INDEX idx_orders_seller ON orders(seller_id);
CREATE INDEX idx_orders_status ON orders(status);

CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  quantity INT NOT NULL CHECK (quantity > 0),
  unit_price_paise BIGINT NOT NULL CHECK (unit_price_paise >= 0)
);

-- ============ AUDIT LOG (who did what, for disputes + security review) ============
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES users(id),
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_actor ON audit_logs(actor_user_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
