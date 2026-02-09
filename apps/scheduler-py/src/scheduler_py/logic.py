from __future__ import annotations

import hashlib
import random
from datetime import UTC, datetime, time, timedelta
from zoneinfo import ZoneInfo

import numpy as np

from .models import (
    EventHistoryItem,
    MissedOption,
    MissedOptionsRequest,
    RecommendNextRequest,
    RecomputeStateRequest,
)

SENTIMENT_WEIGHTS = {
    "VERY_POOR": -2.0,
    "POOR": -1.0,
    "NEUTRAL": 0.0,
    "WELL": 1.0,
    "VERY_WELL": 2.0,
}


def recommend_next_time(req: RecommendNextRequest) -> tuple[datetime, str]:
    rng = random.Random(req.seed)
    base_interval = req.template.baseIntervalDays
    adaptive_interval = compute_adaptive_interval_days(base_interval, req.eventHistory)
    jitter_range = adaptive_interval * req.template.jitterPct
    jitter = rng.uniform(-jitter_range, jitter_range)

    now_utc = ensure_utc(req.now)
    candidate = now_utc + timedelta(days=max(adaptive_interval + jitter, 0.25))
    candidate = enforce_min_gap(candidate, req.settings.minGapHours, req.eventHistory)
    candidate = next_valid_slot(candidate, req.settings.timezone, req.settings.allowedWindows, req.settings.blackoutDates)

    rationale = (
        f"base_interval={base_interval:.2f}d, adaptive_interval={adaptive_interval:.2f}d, "
        f"jitter={jitter:.2f}d"
    )
    return candidate, rationale


def build_missed_options(req: MissedOptionsRequest) -> list[MissedOption]:
    now_utc = ensure_utc(req.now)
    asap_candidate = enforce_min_gap(now_utc, req.settings.minGapHours, req.eventHistory)
    asap_slot = next_valid_slot(
        asap_candidate,
        req.settings.timezone,
        req.settings.allowedWindows,
        req.settings.blackoutDates,
    )

    interval_days = compute_adaptive_interval_days(req.template.baseIntervalDays, req.eventHistory)
    delayed_target = now_utc + timedelta(days=max(interval_days, 0.25))
    delayed_target = enforce_min_gap(delayed_target, req.settings.minGapHours, req.eventHistory)
    delayed_slot = next_valid_slot(
        delayed_target,
        req.settings.timezone,
        req.settings.allowedWindows,
        req.settings.blackoutDates,
    )

    urgency = compute_urgency(req.eventHistory, req.template.baseIntervalDays, now_utc)
    recommend_asap = urgency >= 0.5

    asap_option = MissedOption(
        optionId=build_option_id(req.eventId, "ASAP", asap_slot),
        profileId="",
        eventId=req.eventId,
        type="ASAP",
        proposedAt=asap_slot,
        rationale="Best for recovering momentum quickly after a missed event.",
        recommended=recommend_asap,
    )

    delayed_option = MissedOption(
        optionId=build_option_id(req.eventId, "DELAYED", delayed_slot),
        profileId="",
        eventId=req.eventId,
        type="DELAYED",
        proposedAt=delayed_slot,
        rationale="Best for maintaining spacing and avoiding event crowding.",
        recommended=not recommend_asap,
    )

    return [asap_option, delayed_option]


def recompute_sentiment_score(req: RecomputeStateRequest) -> float:
    weights: list[float] = []
    for signal in req.templateSignals:
        if signal.sentimentLevel:
            weights.append(SENTIMENT_WEIGHTS[signal.sentimentLevel])

    if not weights:
        return 0.0

    return float(sum(weights) / len(weights))


def compute_adaptive_interval_days(base_interval_days: float, history: list[EventHistoryItem]) -> float:
    sentiments: list[float] = [
        SENTIMENT_WEIGHTS[item.sentimentLevel]
        for item in history
        if item.status == "COMPLETED" and item.sentimentLevel is not None
    ]

    if not sentiments:
        return base_interval_days

    recent = sentiments[:12]
    weights = linear_weights(1.5, 0.7, len(recent))
    weighted = weighted_average(recent, weights)

    if weighted > 1.0:
        multiplier = 1.12
    elif weighted > 0.2:
        multiplier = 1.05
    elif weighted < -1.0:
        multiplier = 0.78
    elif weighted < -0.2:
        multiplier = 0.9
    else:
        multiplier = 1.0

    return float(clip(base_interval_days * multiplier, 1.0, 120.0))


def enforce_min_gap(
    candidate: datetime,
    min_gap_hours: int,
    history: list[EventHistoryItem],
) -> datetime:
    latest_anchor = None
    for item in history:
        timestamp = item.completedAt or item.scheduledAt
        if latest_anchor is None or timestamp > latest_anchor:
            latest_anchor = timestamp

    if latest_anchor is None:
        return candidate

    gap_floor = ensure_utc(latest_anchor) + timedelta(hours=min_gap_hours)
    return candidate if candidate >= gap_floor else gap_floor


def next_valid_slot(
    candidate_utc: datetime,
    timezone_name: str,
    windows: list,
    blackouts: list,
) -> datetime:
    tz = ZoneInfo(timezone_name)
    local_candidate = ensure_utc(candidate_utc).astimezone(tz)

    if not windows:
        return step_out_of_blackout(local_candidate, blackouts).astimezone(UTC)

    grouped = {}
    for window in windows:
        grouped.setdefault(window.weekday, []).append(window)

    for day_offset in range(0, 370):
        probe_date = (local_candidate + timedelta(days=day_offset)).date()
        day_windows = sorted(
            grouped.get(probe_date.weekday(), []),
            key=lambda item: item.startLocalTime,
        )

        if not day_windows:
            continue

        for window in day_windows:
            start_local = datetime.combine(probe_date, parse_clock(window.startLocalTime), tz)
            end_local = datetime.combine(probe_date, parse_clock(window.endLocalTime), tz)

            candidate_for_window = max(local_candidate, start_local)
            if candidate_for_window > end_local:
                continue

            candidate_for_window = step_out_of_blackout(candidate_for_window, blackouts)
            if candidate_for_window <= end_local and candidate_for_window.date() == probe_date:
                return candidate_for_window.astimezone(UTC)

    return local_candidate.astimezone(UTC)


def step_out_of_blackout(local_dt: datetime, blackouts: list) -> datetime:
    cursor = local_dt
    for _ in range(0, 100):
        hit = find_blackout_hit(cursor, blackouts)
        if hit is None:
            return cursor
        cursor = hit + timedelta(minutes=30)

    return cursor


def find_blackout_hit(local_dt: datetime, blackouts: list) -> datetime | None:
    for blackout in blackouts:
        start = blackout.startAt.astimezone(local_dt.tzinfo)
        end = (blackout.endAt or blackout.startAt).astimezone(local_dt.tzinfo)

        if blackout.allDay:
            start_day = start.date()
            end_day = end.date()
            if start_day <= local_dt.date() <= end_day:
                return datetime.combine(local_dt.date(), time(23, 59), local_dt.tzinfo)
        else:
            if start <= local_dt <= end:
                return end

    return None


def compute_urgency(
    history: list[EventHistoryItem],
    base_interval_days: float,
    now_utc: datetime,
) -> float:
    completions = [item.completedAt for item in history if item.completedAt is not None]
    if not completions:
        return 1.0

    latest = max(completions)
    elapsed_days = (now_utc - ensure_utc(latest)).total_seconds() / 86400

    ratio = elapsed_days / max(base_interval_days, 1)
    return float(clip(ratio, 0.0, 2.0) / 2.0)


def build_option_id(event_id: str, kind: str, proposed_at: datetime) -> str:
    digest = hashlib.sha1(f"{event_id}:{kind}:{proposed_at.isoformat()}".encode("utf-8")).hexdigest()
    return digest[:20]


def parse_clock(value: str) -> time:
    hour, minute = value.split(":", maxsplit=1)
    return time(hour=int(hour), minute=int(minute))


def ensure_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def clip(value: float, minimum: float, maximum: float) -> float:
    return max(minimum, min(value, maximum))


def linear_weights(start: float, end: float, count: int) -> list[float]:
    if count <= 1:
        return [start]
    step = (end - start) / (count - 1)
    return [start + step * index for index in range(count)]


def weighted_average(values: list[float], weights: list[float]) -> float:
    if not values:
        return 0.0
    return float(np.average(np.asarray(values, dtype=float), weights=np.asarray(weights, dtype=float)))
