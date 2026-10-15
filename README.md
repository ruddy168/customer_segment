# Customer Intelligence & Retention Platform

A full-stack analytics platform that segments customers, identifies at-risk customers, and generates AI-powered retention recommendations.

**Tech Stack:** Python, FastAPI, PostgreSQL, SQLAlchemy, React, Vite, Docker, Pandas, scikit-learn, Google Gemini API

## Features

- **Data Pipeline:** Cleaned and transformed retail transaction data; engineered Recency, Frequency, and Monetary (RFM) features.
- **Customer Segmentation:** Grouped customers into five behavioral segments using RFM-based analysis.
- **Analytics Dashboard:** Visualized customer activity, revenue, orders, and segment-level metrics.
- **REST API:** Exposed customer, segment, and analytics endpoints using FastAPI.
- **AI Retention Insights:** Generated actionable retention recommendations with response validation and error handling.
- **Containerization:** Docker Compose setup for the frontend, backend, and PostgreSQL database.

## Results

- 4312 customers analyzed
- 400,916 transaction lines processed
- 19,213 orders represented
- 5 customer segments identified
- 25 backend tests passing

## Run Locally

**Prerequisites:** Docker Desktop and Git.

```bash
git clone https://github.com/ruddy168/customer_segment.git
cd customer_segment
```

Configure your local `.env` file using `.env.example`, then start the application:

```bash
docker compose up -d --build
```

Open the dashboard at [http://localhost:8080](http://localhost:8080).

## Project Links

- **Repository:** [github.com/ruddy168/customer_segment](https://github.com/ruddy168/customer_segment)
- **API Documentation:** [http://localhost:8000/docs](http://localhost:8000/docs) when running locally
