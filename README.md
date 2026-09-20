# Vehicle Spare-Parts Marketplace — Backend (v0.1)

Tested and boot-verified. Node.js + Express + PostgreSQL (raw `pg`, no ORM binary dependency issues).

## What's implemented

- **Auth**: register/login/refresh/logout, bcrypt password hashing (12 rounds), JWT access (15m) + refresh (7d) tokens, refresh tokens stored **hashed** in DB (rotated on every use), account lockout after 5 failed logins (15 min), generic error messages (no user enumeration).
- **RBAC**: `buyer`, `seller`, `delivery_partner`, `admin` roles. Public signup can **never** create an admin (blocked at the validation schema level).
- **Seller KYC (Aadhaar)**: pluggable provider interface. We **never store the raw Aadhaar number** — only a provider reference ID and status (`not_started/pending/verified/failed`). Ships with a stub provider for local dev; swap in a real licensed provider (Digio/Karza/Signzy/etc.) later without touching any other code.
- **Products**: sellers can only list products after `kyc_status = 'verified'` **and** admin `is_approved = TRUE` — enforced server-side, not just in the UI.
- **Orders**: stock deduction happens inside a DB transaction with `SELECT ... FOR UPDATE` row locking, so two simultaneous buyers can't oversell the last unit.
- **Security middleware**: helmet, CORS allow-list, rate limiting (tighter on auth endpoints), HTTP parameter pollution protection, JSON body size limit, centralized error handler that hides internal details in production but still logs them.
- **Audit-friendly**: `audit_logs` table scaffolded (wire it into controllers as you add sensitive actions).

## Setup

### 1. Install PostgreSQL locally (or use a hosted one — Railway/Supabase/RDS)

```bash
# Ubuntu/Debian example
sudo apt install postgresql
sudo -u postgres createdb spareparts_db
```

### 2. Configure environment

```bash
cp .env.example .env
```

Generate real secrets — **never use the example values**:

```bash
openssl rand -hex 64   # run twice, once for JWT_ACCESS_SECRET, once for JWT_REFRESH_SECRET
```

Fill in your real `DATABASE_URL` in `.env`.

### 3. Install dependencies

```bash
npm install
```

### 4. Run the migration

```bash
npm run migrate
```

### 5. Start the server

```bash
npm run dev     # local development with auto-restart
npm start       # production
```

Health check: `GET http://localhost:5000/health`

## API quick reference

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/api/auth/register` | none | `role`: buyer / seller / delivery_partner only |
| POST | `/api/auth/login` | none | |
| POST | `/api/auth/refresh` | none (needs refresh token) | rotates the refresh token |
| POST | `/api/auth/logout` | required | |
| POST | `/api/kyc/initiate` | seller | starts Aadhaar verification |
| POST | `/api/kyc/confirm` | seller | confirms OTP |
| GET | `/api/kyc/status` | seller | |
| GET | `/api/products/search` | none | buyer-facing search, verified sellers only |
| POST | `/api/products` | seller (verified+approved) | |
| PATCH | `/api/products/:id/stock` | seller (owner only) | |
| POST | `/api/orders` | buyer | transactional, race-condition-safe |
| GET | `/api/orders/my` | buyer | |
| PATCH | `/api/orders/:id/status` | seller (owner only) | |

## Before you go live — do these next

1. **Get a real KYC provider account** (Digio, Karza, Signzy, IDfy, Setu). Implement `DigioKycProvider` (or whichever) against `src/services/kyc/kycProviderInterface.js`, then set `KYC_PROVIDER_NAME=digio` in `.env`. Do not launch with the stub provider — it verifies anything.
2. **Add an admin approval endpoint** for sellers (`is_approved`) — currently there's a DB column but no route yet; add one gated to `requireRole('admin')` once you have an admin account bootstrapped (insert the first admin directly via SQL, never through public `/register`).
3. **Add HTTPS/TLS** at your reverse proxy or hosting provider (Nginx, Render, Railway all handle this) — this backend assumes TLS termination happens in front of it.
4. **Add automated tests** before this grows further — nothing here has unit/integration tests yet.
5. **Delivery-partner assignment logic** is not built yet — `delivery_partner_id` exists on `orders` but there's no matching/assignment flow. That's your next milestone once orders are flowing.
6. **Payments** are not integrated. Decide COD vs. Razorpay/Cashfree before scaling past manual/WhatsApp-assisted orders.

## Security notes (read this before changing the code)

- **Never** build a SQL query with string concatenation or template literals containing user input. Always use `$1, $2...` placeholders via `db.query(text, params)`.
- **Never** store a raw Aadhaar number, raw refresh token, or plaintext password anywhere — hash/reference-ID only.
- **Never** allow `role: 'admin'` through a public-facing schema.
- Any new route touching money, stock, or KYC status should be wrapped in a DB transaction if it does more than one write, and ownership (`WHERE seller_id = $x` / `WHERE buyer_id = $x`) must be enforced in the SQL, not just checked in application code.
