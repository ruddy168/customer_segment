from fastapi.middleware.cors import CORSMiddleware
from decimal import Decimal

from fastapi import FastAPI, HTTPException, Query
from sqlalchemy import text

from src.database import engine


app = FastAPI(
    title="Customer Intelligence & Retention API",
    description=(
        "Customer profiles, RFM segmentation, "
        "retention analytics, and revenue insights."
    ),
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

from src.ai_retention import router as ai_retention_router

app.include_router(ai_retention_router)

def serialize_row(row):
    """Convert database rows into JSON-friendly dictionaries."""
    result = dict(row)

    for key, value in result.items():
        if isinstance(value, Decimal):
            result[key] = float(value)

    return result


def fetch_customers_by_status(status: str, limit: int):
    query = text("""
        SELECT
            customer_id,
            recency,
            frequency,
            monetary,
            cluster,
            activity_status,
            segment
        FROM customer_segments
        WHERE activity_status = :status
        ORDER BY recency DESC
        LIMIT :limit
    """)

    with engine.connect() as connection:
        rows = connection.execute(
            query,
            {"status": status, "limit": limit},
        ).mappings().all()

    return [serialize_row(row) for row in rows]



@app.get("/")
def root():
    return {
        "message": "Customer Intelligence & Retention API is running",
        "docs": "/docs",
    }


@app.get("/health")
def health_check():
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))

        return {
            "status": "healthy",
            "database": "connected",
        }

    except Exception:
        raise HTTPException(
            status_code=503,
            detail={
                "status": "unhealthy",
                "database": "disconnected",
            },
        )


@app.get("/customers")
def list_customers(
    segment: str | None = None,
    activity_status: str | None = None,
    search: int | None = Query(default=None, ge=1),
    limit: int = Query(default=25, ge=1, le=10000),
    offset: int = Query(default=0, ge=0),
):
    """List, search, filter, and paginate customers."""

    valid_statuses = {"Active", "At Risk", "Inactive"}

    if (
        activity_status is not None
        and activity_status not in valid_statuses
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                "activity_status must be Active, "
                "At Risk, or Inactive"
            ),
        )

    conditions = []
    params = {}

    if segment is not None:
        conditions.append("segment = :segment")
        params["segment"] = segment

    if activity_status is not None:
        conditions.append("activity_status = :activity_status")
        params["activity_status"] = activity_status

    if search is not None:
        conditions.append("customer_id = :search")
        params["search"] = search

    where_clause = ""
    if conditions:
        where_clause = "WHERE " + " AND ".join(conditions)

    with engine.connect() as connection:
        total_query = text(f"""
            SELECT COUNT(*)
            FROM customer_segments
            {where_clause}
        """)

        total = connection.execute(
            total_query, params
        ).scalar_one()

        query = text(f"""
            SELECT
                customer_id,
                recency,
                frequency,
                monetary,
                cluster,
                activity_status,
                segment
            FROM customer_segments
            {where_clause}
            ORDER BY recency ASC, customer_id ASC
            LIMIT :limit OFFSET :offset
        """)

        rows = connection.execute(
            query,
            {**params, "limit": limit, "offset": offset},
        ).mappings().all()

    customers = [serialize_row(row) for row in rows]

    return {
        "total": total,
        "returned": len(customers),
        "limit": limit,
        "offset": offset,
        "customers": customers,
    }


@app.get("/customers/at-risk")
def get_at_risk_customers(
    limit: int = Query(default=50, ge=1, le=500),
):
    customers = fetch_customers_by_status("At Risk", limit)

    return {
        "count": len(customers),
        "customers": customers,
    }


@app.get("/customers/inactive")
def get_inactive_customers(
    limit: int = Query(default=50, ge=1, le=500),
):
    customers = fetch_customers_by_status("Inactive", limit)

    return {
        "count": len(customers),
        "customers": customers,
    }


@app.get("/customers/{customer_id}")
def get_customer_profile(customer_id: int):
    query = text("""
        SELECT
            customer_id,
            recency,
            frequency,
            monetary,
            cluster,
            activity_status,
            segment
        FROM customer_segments
        WHERE customer_id = :customer_id
    """)

    with engine.connect() as connection:
        row = connection.execute(
            query,
            {"customer_id": customer_id},
        ).mappings().first()

    if row is None:
        raise HTTPException(
            status_code=404,
            detail=f"Customer {customer_id} not found",
        )

    return {"customer": serialize_row(row)}


@app.get("/analytics/segments")
def get_segment_analytics():
    query = text("""
        SELECT
            segment,
            COUNT(*) AS customer_count,
            ROUND(AVG(recency)::numeric, 2) AS avg_recency,
            ROUND(AVG(frequency)::numeric, 2) AS avg_frequency,
            ROUND(AVG(monetary)::numeric, 2) AS avg_monetary
        FROM customer_segments
        GROUP BY segment
        ORDER BY customer_count DESC
    """)

    with engine.connect() as connection:
        rows = connection.execute(query).mappings().all()

    segments = [serialize_row(row) for row in rows]

    return {
        "total_segments": len(segments),
        "segments": segments,
    }

@app.get("/analytics/overview")
def get_analytics_overview():
    query = text("""
        SELECT
            (SELECT COUNT(*)
             FROM customer_segments) AS total_customers,

            (SELECT COUNT(*)
             FROM customer_segments
             WHERE activity_status = 'Active')
                AS active_customers,

            (SELECT COUNT(*)
             FROM customer_segments
             WHERE activity_status = 'At Risk')
                AS at_risk_customers,

            (SELECT COUNT(*)
             FROM customer_segments
             WHERE activity_status = 'Inactive')
                AS inactive_customers,

            (SELECT COUNT(*)
             FROM clean_transactions)
                AS transaction_lines,

            (SELECT COUNT(DISTINCT invoice)
             FROM clean_transactions)
                AS total_orders,

            (SELECT COALESCE(SUM(revenue), 0)
             FROM clean_transactions)
                AS total_revenue,

            (SELECT COALESCE(AVG(order_total), 0)
             FROM (
                 SELECT invoice, SUM(revenue) AS order_total
                 FROM clean_transactions
                 GROUP BY invoice
             ) AS order_totals)
                AS average_order_value
    """)

    with engine.connect() as connection:
        row = connection.execute(query).mappings().one()

    return serialize_row(row)
