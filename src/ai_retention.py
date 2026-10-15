import json
import os
from typing import Any, Literal

from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, ValidationError


load_dotenv()
router = APIRouter(tags=["AI Retention Insights"])

class SegmentMetric(BaseModel):
    segment: str = Field(min_length=1, max_length=100)
    customer_count: int = Field(ge=0, le=10_000_000)
    average_recency: float = Field(default=0, ge=0, le=100_000)
    average_frequency: float = Field(default=0, ge=0, le=10_000_000)
    average_monetary: float = Field(default=0, ge=0, le=1_000_000_000_000)

class OverviewMetrics(BaseModel):
    total_customers: int = Field(ge=0, le=10_000_000)
    active_customers: int = Field(default=0, ge=0, le=10_000_000)
    at_risk_customers: int = Field(default=0, ge=0, le=10_000_000)
    inactive_customers: int = Field(default=0, ge=0, le=10_000_000)
    total_revenue: float = Field(default=0, ge=0, le=1_000_000_000_000_000)
    total_orders: int = Field(default=0, ge=0, le=1_000_000_000)
    average_order_value: float = Field(default=0, ge=0, le=1_000_000_000_000)

class RetentionInsightsRequest(BaseModel):
    overview: OverviewMetrics
    segments: list[SegmentMetric] = Field(min_length=1, max_length=10)

class RetentionPriority(BaseModel):
    priority: Literal["HIGH", "MEDIUM", "LOW"]
    title: str = Field(min_length=1, max_length=120)
    target_segment: str = Field(min_length=1, max_length=100)
    rationale: str = Field(min_length=1, max_length=500)
    actions: list[str] = Field(min_length=2, max_length=3)
    success_metric: str = Field(min_length=1, max_length=200)

class RetentionInsightsResponse(BaseModel):
    executive_summary: str = Field(min_length=1, max_length=1000)
    key_observations: list[str] = Field(min_length=3, max_length=3)
    priorities: list[RetentionPriority] = Field(min_length=3, max_length=3)
    caveats: str = Field(min_length=1, max_length=500)


@router.get("/ai/health")
def ai_health() -> dict[str, Any]:
    return {"configured": bool(os.getenv("GEMINI_API_KEY")), "model": os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite")}

@router.post("/ai/retention-insights")
def generate_retention_insights(payload: RetentionInsightsRequest) -> dict[str, Any]:
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        raise HTTPException(status_code=503, detail="Gemini API key is not configured. Add GEMINI_API_KEY to the backend .env file.")

    try:
        from google import genai
        from google.genai import types
    except ImportError as exc:
        raise HTTPException(status_code=500, detail="Gemini SDK is missing. Install google-genai from requirements.txt.") from exc

    metrics = payload.model_dump()
    prompt = f"""You are a careful customer-retention analyst. Use only the supplied aggregated metrics. Do not claim causation, guaranteed outcomes, or statistically validated churn probabilities. Treat these as descriptive customer segments, not proven churn predictions. Monetary units come from the source dataset and may be in GBP; do not convert currency. Return JSON only with this exact structure:
{{
  "executive_summary": "2-4 concise sentences",
  "key_observations": ["3 factual observations based on the metrics"],
  "priorities": [
    {{"priority":"HIGH|MEDIUM|LOW","title":"short action title","target_segment":"one supplied segment name","rationale":"why this is worth testing, grounded in metrics","actions":["2-3 specific campaign steps"],"success_metric":"one measurable KPI"}}
  ],
  "caveats": "one short limitation statement"
}}
Create 3 priorities. Use exact supplied segment names for target_segment. Prefer testing retention actions for at-risk/inactive or high-value segments when the supplied data supports it. If the input lacks an explicit status-by-segment breakdown, say so and avoid pretending that it exists. Do not invent percentages, causes, customer behavior, or values. Keep recommendations practical for a small e-commerce team. Avoid personal data.

Aggregated metrics:
{json.dumps(metrics, ensure_ascii=False)}
"""
    model = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite").strip()
    try:
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model=model,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.3,
                max_output_tokens=1800,
            ),
        )
        raw = (response.text or "").strip()

        if not raw:
            raise ValueError("Empty AI response")

        result = json.loads(raw)

        validated = RetentionInsightsResponse.model_validate(result)

        allowed_segments = {item.segment for item in payload.segments}

        for priority in validated.priorities:
            if priority.target_segment not in allowed_segments:
                raise ValueError("AI returned an unknown segment")

        return validated.model_dump()

    except HTTPException:
        raise

    except Exception as exc:
        error_text = str(exc).upper()
        error_type = type(exc).__name__

        # Log only the exception type, not potentially sensitive details.
        print(f"Gemini request failed: {error_type}")

        if "429" in error_text or "RESOURCE_EXHAUSTED" in error_text:
            raise HTTPException(
                status_code=429,
                detail="Gemini free-tier rate limit reached. Wait and retry."
            ) from exc

        if isinstance(exc, (json.JSONDecodeError, ValidationError, ValueError)):
            raise HTTPException(
                status_code=502,
                detail="Gemini returned an invalid response. Please retry."
            ) from exc

        raise HTTPException(
            status_code=502,
            detail="Gemini request failed. Please retry later."
        ) from exc
