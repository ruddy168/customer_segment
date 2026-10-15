
from pathlib import Path

import pandas as pd
from sqlalchemy import text

from src.database import engine


# 1. Locate project files
PROJECT_ROOT = Path(__file__).resolve().parent.parent

TRANSACTIONS_FILE = PROJECT_ROOT / "data" / "clean_transactions.csv"
SEGMENTS_FILE = PROJECT_ROOT / "data" / "customer_rfm_segments.csv"


# 2. Check that both CSV files exist
if not TRANSACTIONS_FILE.exists():
    raise FileNotFoundError(f"Transactions file not found: {TRANSACTIONS_FILE}")

if not SEGMENTS_FILE.exists():
    raise FileNotFoundError(f"Customer segments file not found: {SEGMENTS_FILE}")


# 3. Load CSV files
transactions = pd.read_csv(TRANSACTIONS_FILE, parse_dates=["InvoiceDate"])
segments = pd.read_csv(SEGMENTS_FILE)

print("CSV files loaded successfully.")
print(f"Transactions: {len(transactions):,} rows")
print(f"Customer segments: {len(segments):,} rows")


# 4. Rename columns
transactions = transactions.rename(
    columns={
        "Invoice": "invoice",
        "StockCode": "stock_code",
        "Description": "description",
        "Quantity": "quantity",
        "InvoiceDate": "invoice_date",
        "Price": "price",
        "Customer ID": "customer_id",
        "Country": "country",
    }
)

segments = segments.rename(
    columns={
        "Customer ID": "customer_id",
        "Recency": "recency",
        "Frequency": "frequency",
        "Monetary": "monetary",
        "Cluster": "cluster",
        "Activity_Status": "activity_status",
        "Segment": "segment",
    }
)


# 5. Validate required columns
required_transaction_columns = {
    "invoice", "stock_code", "quantity", "invoice_date",
    "price", "customer_id", "country",
}

required_segment_columns = {
    "customer_id", "recency", "frequency", "monetary",
    "cluster", "activity_status", "segment",
}

if not required_transaction_columns.issubset(transactions.columns):
    raise ValueError("The transactions CSV is missing required columns.")

if not required_segment_columns.issubset(segments.columns):
    raise ValueError("The customer segments CSV is missing required columns.")

if transactions["customer_id"].isna().any():
    raise ValueError("Transactions contain missing customer IDs.")

if transactions["invoice_date"].isna().any():
    raise ValueError("Transactions contain invalid invoice dates.")

if transactions["quantity"].le(0).any():
    raise ValueError("Transactions contain non-positive quantities.")

if transactions["price"].le(0).any():
    raise ValueError("Transactions contain non-positive prices.")

if segments["customer_id"].isna().any():
    raise ValueError("Customer segments contain missing customer IDs.")

if segments["customer_id"].duplicated().any():
    raise ValueError("Customer segments contain duplicate customer IDs.")

if segments[["recency", "frequency", "monetary", "cluster"]].isna().any().any():
    raise ValueError("Customer segments contain missing RFM or cluster values.")


# 6. Calculate transaction revenue
transactions["revenue"] = transactions["quantity"] * transactions["price"]

print("Data validation passed.")
print("Revenue column calculated.")


# 7. Import datasets into the configured PostgreSQL database
with engine.begin() as connection:
    transactions.to_sql(
        name="clean_transactions",
        con=connection,
        if_exists="replace",
        index=False,
        chunksize=1000,
        method=None,
    )

    segments.to_sql(
        name="customer_segments",
        con=connection,
        if_exists="replace",
        index=False,
        chunksize=1000,
        method=None,
    )

    connection.execute(
        text("""
            CREATE INDEX IF NOT EXISTS idx_clean_transactions_customer
            ON clean_transactions (customer_id)
        """)
    )

    connection.execute(
        text("""
            CREATE INDEX IF NOT EXISTS idx_customer_segments_customer
            ON customer_segments (customer_id)
        """)
    )

print("Both datasets imported successfully.")


# 8. Verify imported data
with engine.connect() as connection:
    transaction_count = connection.execute(
        text("SELECT COUNT(*) FROM clean_transactions")
    ).scalar_one()

    customer_count = connection.execute(
        text("SELECT COUNT(*) FROM customer_segments")
    ).scalar_one()

    unique_customers = connection.execute(
        text("SELECT COUNT(DISTINCT customer_id) FROM clean_transactions")
    ).scalar_one()

    revenue_total = connection.execute(
        text("SELECT ROUND(SUM(revenue)::numeric, 2) FROM clean_transactions")
    ).scalar_one()

print("\n--- PostgreSQL Import Summary ---")
print(f"Transactions imported: {transaction_count:,}")
print(f"Customer segments imported: {customer_count:,}")
print(f"Unique transaction customers: {unique_customers:,}")
print(f"Total revenue: {revenue_total}")
print("\nPostgreSQL data import and verification completed!")