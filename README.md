# Customer Intelligence & Retention Analytics

An end-to-end customer analytics project using transaction-level e-commerce data to analyze customer behavior, value, segmentation, and retention opportunities.

## Objectives

- Clean and analyze transaction-level data
- Calculate customer-level RFM metrics
- Segment customers using K-Means clustering
- Identify active, at-risk, and inactive customers
- Analyze customer and revenue concentration
- Identify high-value retention opportunities
- Build an interactive Power BI dashboard

## Key Results

After data cleaning:

- **400,916** valid transactions
- **4,312** customers
- **19,213** invoices
- **£8.80M** historical revenue

RFM analysis identified **5 customer segments**:


| Segment              | Customers | Avg. Monetary |
| -------------------- | --------- | ------------- |
| Mid-Value / Lapsing  | 1,068     | £1,719.50     |
| High-Value Loyal     | 404       | £12,002.77    |
| Recent Low-Value     | 957       | £405.42       |
| Active / Developing  | 774       | £1,827.54     |
| Inactive / Low-Value | 1,109     | £279.70       |


The **High-Value Loyal** segment represents **9.37% of customers** and contributes approximately **55.11% of historical revenue**.

Using a recency-based activity framework:

- **Active:** 1,569 customers
- **At Risk:** 1,308 customers
- **Inactive:** 1,435 customers

## Power BI Dashboard

The interactive Power BI dashboard is available in the `powerbi/` directory.

## Tech Stack

- **Python:** Pandas, NumPy, Matplotlib, Seaborn
- **Machine Learning:** Scikit-learn, K-Means
- **Database:** MySQL, SQL
- **Visualization:** Power BI
- **Development:** Jupyter Notebook, Git, GitHub

## Project Structure

```text
Customer-Intelligence-Retention/
├── data/
├── notebooks/
├── outputs/
├── powerbi/
├── sql/
├── src/
├── .gitignore
├── README.md
└── requirements.txt
```

## Dataset

Online Retail II — UCI Machine Learning Repository
[https://archive.ics.uci.edu/dataset/502/online%2Bretail%2Bii](https://archive.ics.uci.edu/dataset/502/online%2Bretail%2Bii)