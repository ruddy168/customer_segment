import numpy as np
import pandas as pd

from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import silhouette_score, davies_bouldin_score


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
    rfm_segmented = rfm.copy()

    # Log-transform RFM metrics
    rfm_log = rfm_segmented[
        ["Recency", "Frequency", "Monetary"]
    ].copy()
    rfm_log = np.log1p(rfm_log)

    # Standardize features
    scaler = StandardScaler()
    rfm_scaled = scaler.fit_transform(rfm_log)

    # Train K-Means
    kmeans = KMeans(
        n_clusters=n_clusters,
        random_state=random_state,
        n_init=10
    )
    rfm_segmented["Cluster"] = kmeans.fit_predict(rfm_scaled)

    # Evaluate clustering quality
    labels = rfm_segmented["Cluster"]

    silhouette = silhouette_score(rfm_scaled, labels)
    davies_bouldin = davies_bouldin_score(rfm_scaled, labels)

    print(f"Silhouette Score: {silhouette:.4f}")
    print(f"Davies-Bouldin Score: {davies_bouldin:.4f}")

    return rfm_segmented
