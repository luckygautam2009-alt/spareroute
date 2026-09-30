# RootCause AI — INQUEST Backend

AI Complaint Investigation & Intelligent Handoff System
Team: Code-Crusaders | Noda Institute of Engineering and Technology

## What it does

Every customer complaint is investigated before a human sees it, not just
classified. The system gathers evidence (orders, payments, tickets, policies),
finds the root cause, and decides: auto-resolve, ask the customer, or escalate
to a human with full context, based on evidence and confidence, never on
sentiment alone.

## Architecture

Complaint -> Intent/Sentiment/Urgency (Gemini) -> Investigation (evidence gathering)
-> Root Cause (Gemini, explainable) -> Decision (evidence-based) -> Smart Handoff
-> Evidence Graph (visual timeline data)

## Tech Stack

- Node.js + Express
- Google Gemini API
- express-validator, helmet, cors, express-rate-limit
- JSON mock data (customers, orders, payments, tickets, policies)

## Setup

npm install
cp .env.example .env
npm run dev

Server runs on http://localhost:5001 by default.

## API Endpoints

GET /api/health - health check
GET /api/customers/:customerId/context - full evidence context for a customer
POST /api/complaints - submit a complaint for investigation

## Demo Test Scenarios

1. Duplicate payment - CUST001, order #456 -> AUTO_RESOLVE
2. Delivery delay - CUST002, order #789 -> CUSTOMER_CONFIRM
3. Security concern - CUST002, suspicious activity -> HUMAN_ESCALATION

## Security

- Helmet secure headers, CORS restricted to configured origin
- Rate limiting, input validation, payload size caps
- Centralized error handling, no stack traces leaked in production
- Gemini API key never exposed to client
- Gemini calls have retry and model-fallback chain

## Environment Variables

See .env.example. Required: GEMINI_API_KEY. Never commit .env.
