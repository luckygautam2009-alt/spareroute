# Deployment & Operational Runbook

This guide covers deployment, environment configuration, database migrations, staging vs. production modes, and secret rotation procedures for both **SpareRoute Backend** and **Inquest Backend**.

---

## 1. Environment Variables Reference

### SpareRoute Backend (`backend/`)

| Variable | Required | Default | Description & Constraints |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | Yes | `development` | Environment mode (`development`, `staging`, `production`). In `production`, strict validation is enforced. |
| `PORT` | No | `5000` | Port for the HTTP server (`4000` in Docker Compose). |
| `DATABASE_URL` | Yes | — | PostgreSQL connection string (`postgresql://user:pass@host:port/dbname`). |
| `JWT_ACCESS_SECRET` | Yes | — | Signing key for access tokens. **Min 32 characters in production**, no placeholders. |
| `JWT_REFRESH_SECRET` | Yes | — | Signing key for refresh tokens. **Min 32 characters in production**, no placeholders. |
| `JWT_ACCESS_EXPIRY` | No | `15m` | Token expiry duration (e.g. `15m`, `1h`). |
| `JWT_REFRESH_EXPIRY` | No | `7d` | Refresh token expiry duration (e.g. `7d`, `30d`). |
| `BCRYPT_SALT_ROUNDS` | No | `12` | Salt rounds for password hashing. |
| `ALLOWED_ORIGINS` | No | `http://localhost:3000` | Comma-separated CORS allowed origins. In `production`, **cannot contain `*` or `localhost`**. |
| `TRUST_PROXY` | No | `0` | Number of proxy hops to trust (`app.set('trust proxy', n)`). Set to `1` when behind an ingress/ALB. |
| `KYC_PROVIDER_NAME` | No | `stub` | KYC provider (`stub`, `digio`, `sandbox`). In `production`, **cannot be `stub`**. Staging logs a warning. |
| `KYC_PROVIDER_API_KEY` | If real KYC | — | API key for external KYC service. |
| `KYC_PROVIDER_API_SECRET` | If real KYC | — | API secret for external KYC service. |
| `KYC_PROVIDER_BASE_URL` | If real KYC | — | Base endpoint URL for external KYC service. |
| `INTERNAL_API_KEY` | Yes | — | Shared secret for internal Inquest requests. **Min 32 chars in production**, must match Inquest. |
| `RATE_LIMIT_WINDOW_MS` | No | `900000` | Rate limiter window in ms (15 min). |
| `RATE_LIMIT_MAX_REQUESTS` | No | `100` | Maximum requests per IP per window. |
| `AUTH_RATE_LIMIT_MAX` | No | `5` | Maximum auth requests (login/register) per IP per window. |

---

### Inquest Backend (`inquest-backend/`)

| Variable | Required | Default | Description & Constraints |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | Yes | `development` | Environment mode (`development`, `staging`, `production`). In `production`, strict validation is enforced. |
| `PORT` | Yes | `5001` | Port for the HTTP server. |
| `DATABASE_URL` | Yes | — | PostgreSQL connection string for the `inquest_db` database. |
| `JWT_ACCESS_SECRET` | Yes | — | Shared with SpareRoute to verify buyer/admin JWTs. **Min 32 chars in production**. |
| `SPAREROUTE_API_URL` | Yes | — | Base HTTP URL to SpareRoute backend (e.g. `http://backend:4000`). Trailing slashes stripped. |
| `SPAREROUTE_INTERNAL_API_KEY` | Yes | — | Shared secret sent in `x-internal-api-key` header to SpareRoute. **Min 32 chars in production**. |
| `CORS_ORIGIN` | No | `http://localhost:5173` | Allowed frontend origins. In `production`, **cannot contain `*` or `localhost`**. |
| `BODY_LIMIT` | No | `1mb` | Max request body size for JSON/urlencoded payloads. |
| `TRUST_PROXY` | No | `0` | Number of proxy hops to trust for rate limiting and IP resolution. |
| `GEMINI_API_KEY` | Optional | `""` | Primary Google Gemini API key for complaint/verification AI analysis. |
| `GEMINI_API_KEY_BACKUP` | Optional | `""` | Secondary backup Google Gemini API key. |
| `RATE_LIMIT_COMPLAINTS_MAX` | No | `10` | Max complaints a single authenticated user can submit per hour. |
| `RATE_LIMIT_VERIFY_MAX` | No | `20` | Max verification requests a single authenticated user can submit per hour. |

---

## 2. Migration Order & Execution

Both services maintain automated transactional migration runners tracking applied scripts via a `schema_migrations` table.

### Recommended Migration Order
1. **SpareRoute Backend migrations run first:**
   ```bash
   cd backend
   npm run migrate
   ```
2. **Inquest Backend migrations run second:**
   ```bash
   cd inquest-backend
   npm run migrate
   ```

### Existing Databases & The `--baseline` Flag
If you are deploying Inquest against an existing database that already has tables created manually or via initial schema scripts, running raw migrations might fail on `CREATE TABLE` collisions.

To mark all existing migration files as applied without executing their SQL commands:
```bash
cd inquest-backend
node src/db/migrate.js --baseline
```
Subsequent runs of `npm run migrate` will only execute newly added migration scripts.

---

## 3. Running Environments: Staging vs. Production

### Production Guardrails (Fail Fast)
When `NODE_ENV=production`, both services validate configuration strictly at startup and exit immediately (`process.exit(1)`) if any requirement is violated:
- **KYC Provider**: SpareRoute refuses to boot if `KYC_PROVIDER_NAME=stub`. A certified provider (e.g., Digio) must be configured.
- **CORS Origins**: Origins containing `localhost`, `127.0.0.1`, or `*` are rejected. Only explicit HTTPS domains are allowed.
- **Secrets Strength**: `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `INTERNAL_API_KEY`, and `SPAREROUTE_INTERNAL_API_KEY` must each be at least **32 characters long** and cannot contain common placeholder words (`changeme`, `secret`, `example`, `placeholder`, `your_secret`).

### Staging Environment
When `NODE_ENV=staging`:
- The stub KYC provider is allowed, but an audible warning banner is logged on boot.
- Specific non-production domains may be used in CORS origins for testing.
- Secrets must still be provided to ensure full functional testing.

---

## 4. Local Deployment with Docker Compose

A local multi-container development environment is defined in `docker-compose.yml`:
1. Copy template files to create local `.env` files:
   ```bash
   cp backend/.env.example backend/.env
   cp inquest-backend/.env.example inquest-backend/.env
   ```
2. Adjust secrets and settings in `.env` files as needed.
3. Start the stack:
   ```bash
   docker-compose up --build
   ```
   This will:
   - Start PostgreSQL 16 on port `5432`.
   - Run `docker/init-db.sh` to initialize both `spareroute_db` and `inquest_db`.
   - Build and start SpareRoute Backend on port `4000`.
   - Build, run migrations, and start Inquest Backend on port `5001`.

---

## 5. Health & Readiness Monitoring

Both services expose probe endpoints for container orchestrators (Kubernetes, AWS ECS, Docker):
- **Liveness Probe**: `GET /health`
  - Responds `200 OK` if the process is up and accepting connections.
- **Readiness Probe**: `GET /ready`
  - Executes a `SELECT 1` query to verify PostgreSQL connectivity.
  - Returns `200 OK` `{ success: true, status: 'ready' }` if healthy.
  - Returns `503 Service Unavailable` `{ success: false, status: 'not ready', error: 'Database unavailable' }` if database connection drops.

### Graceful Shutdown
Both services handle `SIGTERM` and `SIGINT`:
1. Stop accepting new incoming HTTP connections (`server.close()`).
2. Allow active requests to drain (with a 30-second hard timeout).
3. Close PostgreSQL connection pool cleanly (`pool.end()`).
4. Exit process with code `0`.

---

## 6. Zero-Downtime Secret Rotation

### Rotating `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`
1. Access tokens have short lifespans (`15m`).
2. Update the `JWT_ACCESS_SECRET` in both `backend/.env` and `inquest-backend/.env`.
3. Perform a rolling restart of SpareRoute Backend, followed by Inquest Backend.
4. Users with older access tokens will receive `401 Unauthorized` and refresh their tokens using their refresh token.
5. If rotating `JWT_REFRESH_SECRET`, users will be prompted to re-login upon refresh token expiration.

### Rotating `INTERNAL_API_KEY` (SpareRoute <-> Inquest)
1. Set the new internal secret in SpareRoute to accept both legacy and new keys if zero-downtime transition is required, or deploy Inquest with the updated `SPAREROUTE_INTERNAL_API_KEY` concurrently with SpareRoute's `INTERNAL_API_KEY`.
2. Both services will validate communication immediately upon reload.

### Rotating `GEMINI_API_KEY`
1. Inquest supports both `GEMINI_API_KEY` and `GEMINI_API_KEY_BACKUP`.
2. Set the newly generated key as `GEMINI_API_KEY_BACKUP` first, test it, then swap it to primary.
3. Restart Inquest backend without downtime.
