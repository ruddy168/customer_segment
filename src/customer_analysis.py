import numpy as np
import pandas as pd

from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler


def calculate_rfm(df, analysis_date=None):
    """
    Calculate customer-level Recency, Frequency, and Monetary metrics.

    Parameters
    ----------
    df : pandas.DataFrame
        Clean transaction-level dataset.
        Required columns:
        Customer ID, Invoice, InvoiceDate, Revenue

    analysis_date : pandas.Timestamp, optional
        Date used as the reference point for recency.
        If not provided, one day after the latest transaction is used.

    Returns
    -------
    pandas.DataFrame
        Customer-level RFM table.
    """

    if analysis_date is None:
        analysis_date = df["InvoiceDate"].max() + pd.Timedelta(days=1)

    rfm = df.groupby("Customer ID").agg(
        Recency=(
            "InvoiceDate",
            lambda x: (analysis_date - x.max()).days
        ),
        Frequency=(
            "Invoice",
            "nunique"
        ),
        Monetary=(
            "Revenue",
            "sum"
        )
    ).reset_index()

    return rfm


def classify_activity(recency):
    """
    Classify a customer based on recency.

    Parameters
    ----------
    recency : int or float
        Number of days since the customer's last purchase.

    Returns
    -------
    str
        Activity status: Active, At Risk, or Inactive.
    """

    if recency <= 30:
        return "Active"
    elif recency <= 90:
        return "At Risk"
    else:
        return "Inactive"

def create_customer_segments(rfm, n_clusters=5, random_state=42):
    """
    Segment customers using K-Means clustering on RFM metrics.

    Parameters
    ----------
    rfm : pandas.DataFrame
        Customer-level RFM dataset containing:
        Recency, Frequency, and Monetary.

    n_clusters : int, default=5
        Number of customer segments.

    random_state : int, default=42
        Random seed for reproducibility.

    Returns
    -------
    pandas.DataFrame
        RFM dataset with a Cluster column.
    """

    rfm_segmented = rfm.copy()

    # Log-transform RFM metrics to reduce skewness
    rfm_log = rfm_segmented[
        ["Recency", "Frequency", "Monetary"]
    ].copy()

    rfm_log = np.log1p(rfm_log)

    # Standardize the transformed metrics
    scaler = StandardScaler()

    rfm_scaled = scaler.fit_transform(rfm_log)

    # Apply K-Means clustering
    kmeans = KMeans(
        n_clusters=n_clusters,
        random_state=random_state,
        n_init=10
    )

    rfm_segmented["Cluster"] = kmeans.fit_predict(rfm_scaled)

    return rfm_segmented