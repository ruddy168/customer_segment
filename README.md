# Customer Intelligence & Retention Platform

An end-to-end customer analytics application that transforms retail transaction data into RFM-based customer segments, exposes metrics through a FastAPI backend, and presents results in a React dashboard. An optional Gemini integration generates structured retention recommendations from aggregated metrics.

## Features

- Transaction data cleaning and validation.
- Recency, Frequency, and Monetary (RFM) feature engineering.
- Customer segmentation using K-Means.
- PostgreSQL storage and SQLAlchemy database access.
- FastAPI endpoints for dashboard metrics and customer analysis.
- React dashboard with charts and API integration.
- Optional Gemini-powered retention insights with response validation.
- Automated tests for application behavior.

## Technology stack

**Backend:** Python, FastAPI, SQLAlchemy, psycopg, Pydantic
**Data and ML:** Pandas, NumPy, scikit-learn
**Database:** PostgreSQL
**Frontend:** React, Vite, JavaScript, Axios, Recharts
**AI integration:** Google Gemini API (`google-genai`)
**Testing:** pytest, HTTPX

## Architecture

```text
Retail transaction CSVs
        |
        v
Data cleaning and RFM feature engineering
        |
        v
Customer segmentation
        |
        v
PostgreSQL <----> FastAPI backend
                       |
                       +----> Gemini retention insights (optional)
                       |
                       v
                 React dashboard
```

## Repository layout

```text
.
├── data/
│   ├── clean_transactions.csv
│   └── customer_rfm_segments.csv
├── frontend/
│   ├── src/
│   ├── package.json
│   └── vite.config.js
├── src/
│   ├── main.py
│   ├── database.py
│   ├── load_postgres.py
│   └── ai_retention.py
├── tests/
├── requirements.txt
├── .env.example
└── README.md
```

Some local files, notebooks, or generated artifacts may not be included in every checkout.

## Prerequisites

- Python 3.11 or a compatible Python version for the installed dependencies.
- Node.js and npm.
- PostgreSQL.
- A Gemini API key only if AI-generated retention insights are needed.

## Setup

### 1. Configure the backend

Create and activate a virtual environment from the repository root:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
```

Create your local environment file from the example:

```powershell
Copy-Item .env.example .env
```

Edit `.env` locally with your PostgreSQL credentials. Add `GEMINI_API_KEY` if you want to use AI-generated insights. Never commit `.env` or share its contents.

### 2. Prepare PostgreSQL

Create a PostgreSQL database named `customer_intelligence`, or change `DB_NAME` in your local `.env` to match your database.

Ensure the configured PostgreSQL user has permission to connect and create or modify the application's tables.

If you need to load the provided CSVs, inspect `src/load_postgres.py` first: the current loader may replace existing tables. Back up any valuable database tables before running it. Do not run the loader against a database containing data you need to preserve.

### 3. Start the backend

From the repository root, with the virtual environment active:

```powershell
uvicorn src.main:app --reload
```

The API should be available at `http://127.0.0.1:8000`. Interactive API documentation is available at `http://127.0.0.1:8000/docs`.

The AI integration provides `/ai/health` and `/ai/retention-insights` endpoints when its router is included by the backend. Check `/docs` for the registered routes.

### 4. Start the frontend

Open a second terminal at the repository root:

```powershell
cd frontend
npm install
npm run dev
```

Open the local URL printed by Vite, normally `http://localhost:5173`. The Vite development proxy forwards `/api` requests to the backend at `http://127.0.0.1:8000` by default.

To change the proxy target, set `VITE_API_PROXY_TARGET` in the environment before starting Vite.

### 5. Run tests and build checks

From the repository root, with the Python virtual environment active:

```powershell
python -m pytest -v
```

Then build the frontend:

```powershell
cd frontend
npm run build
```

A successful frontend build creates production assets in `frontend/dist/`. A bundle-size warning is not the same as a failed build.

## AI retention insights

The AI endpoint accepts aggregated overview and segment metrics and requests structured retention recommendations from Gemini. The response is validated against Pydantic models, including allowed priority levels and supplied segment names.

Recommendations are hypotheses to test, not proof of causation or statistically validated churn predictions. The model should not invent missing segment-level status data. The AI feature requires a valid API key and may be subject to provider quotas or rate limits.

## Data and interpretation

The analysis is based on retail transaction records. RFM metrics summarize customer purchasing history; K-Means assigns customers to data-driven groups. These segments are useful for exploration and campaign planning but do not independently establish why customers behave a certain way or guarantee future retention.

Currency units depend on the source dataset. Do not interpret monetary figures as another currency without an explicit conversion.

## Security

- Keep `.env` out of version control.
- Use `.env.example` only for non-secret configuration templates.
- Do not log API keys, database passwords, or customer-level sensitive data.
- Restrict database credentials to the permissions the application needs.
- Treat AI-generated recommendations as untrusted output and validate them before displaying or acting on them.

## Current scope

This repository combines data processing, customer segmentation, an API, a web dashboard, and an optional AI insight endpoint. Deployment automation and container orchestration should be documented separately once they have been implemented and verified.

<!-- FINAL_QUALITY_PASS_DOCS -->
## Local Docker Setup

Prerequisites: Docker Desktop with Docker Compose, Git, and a browser. Copy `.env.example` to `.env` and fill in the required values locally; never commit `.env` or real API keys.

```powershell
Copy-Item .env.example .env
# Edit .env locally, then:
docker compose -f compose.yaml up -d --build
docker compose -f compose.yaml ps
docker compose -f compose.yaml logs -f backend
```

Open the React dashboard at <http://localhost:8080> and the FastAPI docs at <http://localhost:8000/docs>. The PostgreSQL service is exposed on host port `5433` in this development setup. The app's backend connects to the Compose database service internally. To stop containers without deleting database data, run `docker compose -f compose.yaml down`. **Do not use `down -v` unless you intentionally want to delete the persistent database volume.**

## Verified Analytics API Routes

- `GET /analytics/overview` â€” customer, transaction, order, and revenue summary.
- `GET /analytics/segments` â€” customer counts and average RFM measures by segment.
- `GET /docs` â€” interactive FastAPI documentation.

When using the browser-facing Nginx proxy, API routes are prefixed with `/api`, for example `/api/analytics/overview`.

## Architecture

- **Frontend:** React + Vite, served by Nginx; Nginx forwards `/api/` requests to FastAPI.
- **Backend:** Python + FastAPI, with SQLAlchemy for PostgreSQL queries.
- **Database:** PostgreSQL running as a Compose service with a persistent named volume.
- **Analytics:** transaction/customer data, RFM-style customer measures, five customer segments, dashboard metrics, and AI-assisted retention insights.

## Data Snapshot

The current local database validation returned 4,312 customers, 400,916 transaction lines, 19,213 orders, approximately â‚¹87.98 lakh in total revenue, and five customer segments. These are results for the current imported dataset, not live business data; regenerate them if the dataset changes.

## Tests and Production Build

Run backend tests from the repository root with `python -m pytest -v`. Build the frontend with `Push-Location frontend; npm run build; Pop-Location`. Validate Compose configuration with `docker compose -f compose.yaml config --quiet`.

## Screenshots

Add current, non-sensitive screenshots of the dashboard and AI insights to a `docs/screenshots/` directory and link them here when available. Do not include credentials, customer-level personal data, or API keys in screenshots.
