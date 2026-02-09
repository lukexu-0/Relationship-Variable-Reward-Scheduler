from __future__ import annotations

from fastapi import FastAPI

from .logic import build_missed_options, recommend_next_time, recompute_sentiment_score
from .models import (
    MissedOptionsRequest,
    MissedOptionsResponse,
    RecommendNextRequest,
    RecommendNextResponse,
    RecomputeStateRequest,
    RecomputeStateResponse,
)

app = FastAPI(title="Relationship Reward Scheduler", version="0.1.0")


@app.get("/healthz")
def healthz() -> dict[str, bool]:
    return {"ok": True}


@app.post("/v1/scheduler/recommend-next", response_model=RecommendNextResponse)
def recommend_next(request: RecommendNextRequest) -> RecommendNextResponse:
    scheduled_at, rationale = recommend_next_time(request)
    return RecommendNextResponse(scheduledAt=scheduled_at, rationale=rationale)


@app.post("/v1/scheduler/missed-options", response_model=MissedOptionsResponse)
def missed_options(request: MissedOptionsRequest) -> MissedOptionsResponse:
    options = build_missed_options(request)
    return MissedOptionsResponse(options=options)


@app.post("/v1/scheduler/recompute-state", response_model=RecomputeStateResponse)
def recompute_state(request: RecomputeStateRequest) -> RecomputeStateResponse:
    score = recompute_sentiment_score(request)
    return RecomputeStateResponse(ok=True, profileId=request.profileId, sentimentScore=score)
