
USE customer_analytics;


-- 1. Total number of records
SELECT COUNT(*) AS total_rows
FROM online_retail;


-- 2. Missing Customer IDs
SELECT COUNT(*) AS missing_customer_id
FROM online_retail
WHERE Customer_ID IS NULL;


-- 3. Missing descriptions
SELECT COUNT(*) AS missing_description
FROM online_retail
WHERE Description IS NULL;


-- 4. Duplicate rows
SELECT
    Invoice,
    StockCode,
    Description,
    Quantity,
    InvoiceDate,
    Price,
    Customer_ID,
    Country,
    COUNT(*) AS duplicate_count
FROM online_retail
GROUP BY
    Invoice,
    StockCode,
    Description,
    Quantity,
    InvoiceDate,
    Price,
    Customer_ID,
    Country
HAVING COUNT(*) > 1;


-- 5. Negative quantities
SELECT COUNT(*) AS negative_quantity_rows
FROM online_retail
WHERE Quantity < 0;


-- 6. Non-positive prices
SELECT COUNT(*) AS non_positive_price_rows
FROM online_retail
WHERE Price <= 0;


-- 7. Cancelled invoices
SELECT COUNT(*) AS cancelled_invoices
FROM online_retail
WHERE Invoice LIKE 'C%';


-- 8. Date range
SELECT
    MIN(InvoiceDate) AS earliest_transaction,
    MAX(InvoiceDate) AS latest_transaction
FROM online_retail;


-- 9. Number of unique customers
SELECT COUNT(DISTINCT Customer_ID) AS unique_customers
FROM online_retail;


-- 10. Number of unique invoices
SELECT COUNT(DISTINCT Invoice) AS unique_invoices
FROM online_retail;