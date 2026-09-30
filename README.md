# SpareRoute

Monorepo for SpareRoute and Inquest microservices.

## Project Structure

- `backend/`: SpareRoute core API backend (Node.js/Express, authentication, seller KYC, orders, mechanics).
- `inquest-backend/`: Inquest claims and investigation backend service.
- `inquest-frontend/`: Inquest React / Vite frontend application.
- `e2e.js`: End-to-end integration and smoke testing script.

## Setup & Running

Each service contains its own configuration and dependencies:
1. **SpareRoute Backend**: `cd backend && npm install && npm run dev`
2. **Inquest Backend**: `cd inquest-backend && npm install && npm run dev`
3. **Inquest Frontend**: `cd inquest-frontend && npm install && npm run dev`
4. **E2E Tests**: Run `node e2e.js` while services are active.
