-- ============================================================
-- Customer Intelligence & Retention Analytics

USE customer_analytics;

DROP TABLE IF EXISTS clean_transactions;

CREATE TABLE clean_transactions AS
SELECT DISTINCT
    Invoice,
    StockCode,
    Description,
    Quantity,
    InvoiceDate,
    Price,
    Customer_ID,
    Country
FROM online_retail
WHERE Customer_ID IS NOT NULL
  AND Price > 0
  AND Invoice NOT LIKE 'C%'
  AND Quantity > 0;