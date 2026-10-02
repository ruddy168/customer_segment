USE customer_analytics;



-- 1. OVERALL BUSINESS KPIs

SELECT
    COUNT(*) AS total_transactions,
    COUNT(DISTINCT Invoice) AS total_invoices,
    COUNT(DISTINCT Customer_ID) AS total_customers,
    COUNT(DISTINCT StockCode) AS total_products,
    COUNT(DISTINCT Country) AS total_countries,
    ROUND(SUM(Quantity * Price), 2) AS total_revenue
FROM clean_transactions;


-- 2. MONTHLY REVENUE TREND

SELECT
    DATE_FORMAT(InvoiceDate, '%Y-%m') AS month,
    COUNT(DISTINCT Invoice) AS invoices,
    COUNT(DISTINCT Customer_ID) AS customers,
    SUM(Quantity) AS units_sold,
    ROUND(SUM(Quantity * Price), 2) AS revenue
FROM clean_transactions
GROUP BY DATE_FORMAT(InvoiceDate, '%Y-%m')
ORDER BY month;


-- 3. MONTHLY CUSTOMER ACTIVITY

SELECT
    DATE_FORMAT(InvoiceDate, '%Y-%m') AS month,
    COUNT(DISTINCT Customer_ID) AS active_customers,
    COUNT(DISTINCT Invoice) AS invoices,
    ROUND(
        SUM(Quantity * Price) / COUNT(DISTINCT Customer_ID),
        2
    ) AS revenue_per_customer
FROM clean_transactions
GROUP BY DATE_FORMAT(InvoiceDate, '%Y-%m')
ORDER BY month;


-- 4. COUNTRY PERFORMANCE

SELECT
    Country,
    COUNT(DISTINCT Customer_ID) AS customers,
    COUNT(DISTINCT Invoice) AS invoices,
    SUM(Quantity) AS units_sold,
    ROUND(SUM(Quantity * Price), 2) AS revenue
FROM clean_transactions
GROUP BY Country
ORDER BY revenue DESC;


-- 5. TOP 10 COUNTRIES BY REVENUE

SELECT
    Country,
    COUNT(DISTINCT Customer_ID) AS customers,
    ROUND(SUM(Quantity * Price), 2) AS revenue
FROM clean_transactions
GROUP BY Country
ORDER BY revenue DESC
LIMIT 10;


-- 6. PRODUCT PERFORMANCE

SELECT
    StockCode,
    MAX(Description) AS Description,
    SUM(Quantity) AS units_sold,
    COUNT(DISTINCT Invoice) AS invoices,
    COUNT(DISTINCT Customer_ID) AS customers,
    ROUND(SUM(Quantity * Price), 2) AS revenue
FROM clean_transactions
GROUP BY StockCode
ORDER BY revenue DESC;


-- 7. TOP 10 PRODUCTS BY REVENUE

SELECT
    StockCode,
    MAX(Description) AS Description,
    SUM(Quantity) AS units_sold,
    COUNT(DISTINCT Customer_ID) AS customers,
    ROUND(SUM(Quantity * Price), 2) AS revenue
FROM clean_transactions
GROUP BY StockCode
ORDER BY revenue DESC
LIMIT 10;


-- 8. TOP 10 PRODUCTS BY UNITS SOLD

SELECT
    StockCode,
    MAX(Description) AS Description,
    SUM(Quantity) AS units_sold,
    COUNT(DISTINCT Customer_ID) AS customers,
    ROUND(SUM(Quantity * Price), 2) AS revenue
FROM clean_transactions
GROUP BY StockCode
ORDER BY units_sold DESC
LIMIT 10;


-- 9. TOP 10 CUSTOMERS BY REVENUE

SELECT
    Customer_ID,
    COUNT(DISTINCT Invoice) AS invoices,
    SUM(Quantity) AS units_purchased,
    ROUND(SUM(Quantity * Price), 2) AS revenue
FROM clean_transactions
GROUP BY Customer_ID
ORDER BY revenue DESC
LIMIT 10;


-- 10. CUSTOMER VALUE DISTRIBUTION

SELECT
    Customer_ID,
    COUNT(DISTINCT Invoice) AS invoice_count,
    SUM(Quantity) AS units_purchased,
    ROUND(SUM(Quantity * Price), 2) AS total_revenue
FROM clean_transactions
GROUP BY Customer_ID
ORDER BY total_revenue DESC;


-- 11. AVERAGE ORDER VALUE

SELECT
    ROUND(
        SUM(Quantity * Price) / COUNT(DISTINCT Invoice),
        2
    ) AS average_order_value
FROM clean_transactions;


-- 12. AVERAGE REVENUE PER CUSTOMER

SELECT
    ROUND(
        SUM(Quantity * Price) / COUNT(DISTINCT Customer_ID),
        2
    ) AS average_customer_revenue
FROM clean_transactions;


-- 13. AVERAGE INVOICES PER CUSTOMER

SELECT
    ROUND(
        COUNT(DISTINCT Invoice) / COUNT(DISTINCT Customer_ID),
        2
    ) AS average_invoices_per_customer
FROM clean_transactions;


-- 14. CUSTOMER PURCHASE FREQUENCY DISTRIBUTION

SELECT
    invoice_count,
    COUNT(*) AS customers
FROM (
    SELECT
        Customer_ID,
        COUNT(DISTINCT Invoice) AS invoice_count
    FROM clean_transactions
    GROUP BY Customer_ID
) AS customer_frequency
GROUP BY invoice_count
ORDER BY invoice_count;


-- 15. ONE-TIME VS REPEAT CUSTOMERS

SELECT
    CASE
        WHEN invoice_count = 1 THEN 'One-Time Customer'
        ELSE 'Repeat Customer'
    END AS customer_type,
    COUNT(*) AS customers,
    ROUND(
        COUNT(*) * 100.0 /
        (SELECT COUNT(DISTINCT Customer_ID)
         FROM clean_transactions),
        2
    ) AS customer_percentage
FROM (
    SELECT
        Customer_ID,
        COUNT(DISTINCT Invoice) AS invoice_count
    FROM clean_transactions
    GROUP BY Customer_ID
) AS customer_frequency
GROUP BY
    CASE
        WHEN invoice_count = 1 THEN 'One-Time Customer'
        ELSE 'Repeat Customer'
    END
ORDER BY customers DESC;

-- 16. CUSTOMER RECENCY

SELECT
    Customer_ID,
    MAX(InvoiceDate) AS last_purchase_date,
    DATEDIFF(
        (
            SELECT DATE_ADD(MAX(InvoiceDate), INTERVAL 1 DAY)
            FROM clean_transactions
        ),
        MAX(InvoiceDate)
    ) AS recency_days
FROM clean_transactions
GROUP BY Customer_ID
ORDER BY recency_days;


-- 17. RECENCY-BASED CUSTOMER ACTIVITY STATUS

SELECT
    CASE
        WHEN recency_days <= 30 THEN 'Active'
        WHEN recency_days <= 90 THEN 'At Risk'
        ELSE 'Inactive'
    END AS activity_status,
    COUNT(*) AS customers,
    ROUND(
        COUNT(*) * 100.0 /
        (SELECT COUNT(DISTINCT Customer_ID)
         FROM clean_transactions),
        2
    ) AS customer_percentage
FROM (
    SELECT
        Customer_ID,
        DATEDIFF(
            (
                SELECT DATE_ADD(MAX(InvoiceDate), INTERVAL 1 DAY)
                FROM clean_transactions
            ),
            MAX(InvoiceDate)
        ) AS recency_days
    FROM clean_transactions
    GROUP BY Customer_ID
) AS customer_recency
GROUP BY
    CASE
        WHEN recency_days <= 30 THEN 'Active'
        WHEN recency_days <= 90 THEN 'At Risk'
        ELSE 'Inactive'
    END
ORDER BY
    CASE
        WHEN activity_status = 'Active' THEN 1
        WHEN activity_status = 'At Risk' THEN 2
        ELSE 3
    END;


-- 18. REVENUE BY RECENCY-BASED ACTIVITY STATUS

SELECT
    activity_status,
    COUNT(*) AS customers,
    ROUND(SUM(total_revenue), 2) AS historical_revenue,
    ROUND(AVG(total_revenue), 2) AS average_customer_revenue
FROM (
    SELECT
        Customer_ID,
        SUM(Quantity * Price) AS total_revenue,
        CASE
            WHEN DATEDIFF(
                (
                    SELECT DATE_ADD(MAX(InvoiceDate), INTERVAL 1 DAY)
                    FROM clean_transactions
                ),
                MAX(InvoiceDate)
            ) <= 30
                THEN 'Active'

            WHEN DATEDIFF(
                (
                    SELECT DATE_ADD(MAX(InvoiceDate), INTERVAL 1 DAY)
                    FROM clean_transactions
                ),
                MAX(InvoiceDate)
            ) <= 90
                THEN 'At Risk'

            ELSE 'Inactive'
        END AS activity_status
    FROM clean_transactions
    GROUP BY Customer_ID
) AS customer_activity
GROUP BY activity_status
ORDER BY
    CASE
        WHEN activity_status = 'Active' THEN 1
        WHEN activity_status = 'At Risk' THEN 2
        ELSE 3
    END;


-- 19. CUSTOMER RFM BASE TABLE

SELECT
    Customer_ID,

    DATEDIFF(
        (
            SELECT DATE_ADD(MAX(InvoiceDate), INTERVAL 1 DAY)
            FROM clean_transactions
        ),
        MAX(InvoiceDate)
    ) AS Recency,

    COUNT(DISTINCT Invoice) AS Frequency,

    ROUND(
        SUM(Quantity * Price),
        2
    ) AS Monetary

FROM clean_transactions
GROUP BY Customer_ID
ORDER BY Monetary DESC;


-- 20. HIGH-VALUE CUSTOMER IDENTIFICATION
-- Customers with historical revenue above £5,000.
-- This is a project-specific analytical threshold.

SELECT
    Customer_ID,
    COUNT(DISTINCT Invoice) AS frequency,
    ROUND(SUM(Quantity * Price), 2) AS monetary,
    DATEDIFF(
        (
            SELECT DATE_ADD(MAX(InvoiceDate), INTERVAL 1 DAY)
            FROM clean_transactions
        ),
        MAX(InvoiceDate)
    ) AS recency_days
FROM clean_transactions
GROUP BY Customer_ID
HAVING SUM(Quantity * Price) > 5000
ORDER BY monetary DESC;


-- 21. HIGH-VALUE CUSTOMERS WHO ARE AT RISK
-- High-value threshold: £5,000
-- At-risk threshold: 31-90 days since last purchase

SELECT
    Customer_ID,
    COUNT(DISTINCT Invoice) AS frequency,
    ROUND(SUM(Quantity * Price), 2) AS historical_revenue,
    DATEDIFF(
        (
            SELECT DATE_ADD(MAX(InvoiceDate), INTERVAL 1 DAY)
            FROM clean_transactions
        ),
        MAX(InvoiceDate)
    ) AS recency_days
FROM clean_transactions
GROUP BY Customer_ID
HAVING
    SUM(Quantity * Price) > 5000
    AND DATEDIFF(
        (
            SELECT DATE_ADD(MAX(InvoiceDate), INTERVAL 1 DAY)
            FROM clean_transactions
        ),
        MAX(InvoiceDate)
    ) BETWEEN 31 AND 90
ORDER BY historical_revenue DESC;


-- 22. HIGH-VALUE AT-RISK SUMMARY

SELECT
    COUNT(*) AS high_value_at_risk_customers,
    ROUND(SUM(historical_revenue), 2) AS historical_revenue,
    ROUND(AVG(historical_revenue), 2) AS average_historical_revenue,
    ROUND(AVG(recency_days), 2) AS average_recency_days
FROM (
    SELECT
        Customer_ID,

        SUM(Quantity * Price) AS historical_revenue,

        DATEDIFF(
            (
                SELECT DATE_ADD(MAX(InvoiceDate), INTERVAL 1 DAY)
                FROM clean_transactions
            ),
            MAX(InvoiceDate)
        ) AS recency_days

    FROM clean_transactions
    GROUP BY Customer_ID

    HAVING
        SUM(Quantity * Price) > 5000
        AND DATEDIFF(
            (
                SELECT DATE_ADD(MAX(InvoiceDate), INTERVAL 1 DAY)
                FROM clean_transactions
            ),
            MAX(InvoiceDate)
        ) BETWEEN 31 AND 90
) AS high_value_at_risk;


-- 23. REVENUE CONTRIBUTION BY CUSTOMER

SELECT
    Customer_ID,
    ROUND(SUM(Quantity * Price), 2) AS revenue,

    ROUND(
        SUM(Quantity * Price) * 100.0 /
        (SELECT SUM(Quantity * Price)
         FROM clean_transactions),
        2
    ) AS revenue_percentage

FROM clean_transactions
GROUP BY Customer_ID
ORDER BY revenue DESC;


-- 24. TOP 10% CUSTOMERS BY HISTORICAL REVENUE
-- Uses customer revenue ranking rather than an arbitrary
-- monetary threshold.

WITH customer_revenue AS (
    SELECT
        Customer_ID,
        SUM(Quantity * Price) AS revenue
    FROM clean_transactions
    GROUP BY Customer_ID
),

ranked_customers AS (
    SELECT
        Customer_ID,
        revenue,
        NTILE(10) OVER (ORDER BY revenue DESC) AS revenue_decile
    FROM customer_revenue
)

SELECT
    revenue_decile,
    COUNT(*) AS customers,
    ROUND(SUM(revenue), 2) AS revenue,
    ROUND(
        SUM(revenue) * 100.0 /
        (SELECT SUM(revenue) FROM customer_revenue),
        2
    ) AS revenue_percentage
FROM ranked_customers
GROUP BY revenue_decile
ORDER BY revenue_decile;


-- 25. FINAL CUSTOMER-LEVEL BUSINESS TABLE
-- This produces one row per customer containing the main
-- metrics needed for downstream analysis.

SELECT
    Customer_ID,

    MIN(InvoiceDate) AS first_purchase_date,

    MAX(InvoiceDate) AS last_purchase_date,

    DATEDIFF(
        (
            SELECT DATE_ADD(MAX(InvoiceDate), INTERVAL 1 DAY)
            FROM clean_transactions
        ),
        MAX(InvoiceDate)
    ) AS recency_days,

    COUNT(DISTINCT Invoice) AS frequency,

    SUM(Quantity) AS total_units,

    ROUND(SUM(Quantity * Price), 2) AS monetary,

    ROUND(
        SUM(Quantity * Price) /
        COUNT(DISTINCT Invoice),
        2
    ) AS average_order_value,

    CASE
        WHEN DATEDIFF(
            (
                SELECT DATE_ADD(MAX(InvoiceDate), INTERVAL 1 DAY)
                FROM clean_transactions
            ),
            MAX(InvoiceDate)
        ) <= 30
            THEN 'Active'

        WHEN DATEDIFF(
            (
                SELECT DATE_ADD(MAX(InvoiceDate), INTERVAL 1 DAY)
                FROM clean_transactions
            ),
            MAX(InvoiceDate)
        ) <= 90
            THEN 'At Risk'

        ELSE 'Inactive'
    END AS activity_status

FROM clean_transactions
GROUP BY Customer_ID
ORDER BY monetary DESC;