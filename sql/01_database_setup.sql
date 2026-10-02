-- Create database
CREATE DATABASE IF NOT EXISTS customer_analytics;

-- Select database
USE customer_analytics;

-- Drop table if it already exists
DROP TABLE IF EXISTS online_retail;

-- Create transaction-level table
CREATE TABLE online_retail (
    Invoice VARCHAR(20),
    StockCode VARCHAR(20),
    Description VARCHAR(255),
    Quantity INT,
    InvoiceDate DATETIME,
    Price DECIMAL(12,4),
    Customer_ID INT,
    Country VARCHAR(100)
);