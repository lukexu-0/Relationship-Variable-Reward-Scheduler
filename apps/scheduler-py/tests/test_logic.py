from datetime import UTC, datetime

from scheduler_py.logic import build_missed_options, compute_adaptive_interval_days, recommend_next_time
from scheduler_py.models import (
    EventHistoryItem,
    MissedOptionsRequest,
    RecommendNextRequest,
    SchedulerSettings,
    SchedulerTemplate,
)


def test_compute_adaptive_interval_days_increases_on_positive_sentiment() -> None:
    history = [
        EventHistoryItem(
            scheduledAt=datetime(2025, 1, 10, 12, 0, tzinfo=UTC),
            completedAt=datetime(2025, 1, 10, 12, 30, tzinfo=UTC),
            status="COMPLETED",
            sentimentLevel="VERY_WELL",
        )
        for _ in range(6)
    ]

    value = compute_adaptive_interval_days(10.0, history)
    assert value > 10.0


def test_recommend_next_respects_windows() -> None:
    req = RecommendNextRequest(
        seed="seed-1",
        now=datetime(2025, 2, 1, 12, 0, tzinfo=UTC),
        template=SchedulerTemplate(id="t1", name="flowers", baseIntervalDays=3, jitterPct=0.2),
        settings=SchedulerSettings(
            timezone="UTC",
            minGapHours=12,
            allowedWindows=[{"weekday": 0, "startLocalTime": "18:00", "endLocalTime": "20:00"}],
            blackoutDates=[],
        ),
        eventHistory=[],
    )

    scheduled_at, _ = recommend_next_time(req)
    assert scheduled_at.weekday() == 0
    assert 18 <= scheduled_at.hour <= 20


def test_missed_options_returns_two_choices() -> None:
    req = MissedOptionsRequest(
        seed="seed-2",
        now=datetime(2025, 2, 1, 12, 0, tzinfo=UTC),
        eventId="event-1",
        currentScheduledAt=datetime(2025, 1, 31, 20, 0, tzinfo=UTC),
        template=SchedulerTemplate(id="t1", name="date", baseIntervalDays=7, jitterPct=0.2),
        settings=SchedulerSettings(
            timezone="UTC",
            minGapHours=24,
            allowedWindows=[{"weekday": 5, "startLocalTime": "12:00", "endLocalTime": "20:00"}],
            blackoutDates=[],
        ),
        eventHistory=[],
    )

    options = build_missed_options(req)
    assert len(options) == 2
    assert sorted([option.type for option in options]) == ["ASAP", "DELAYED"]


def test_missed_options_enforce_min_gap() -> None:
    req = MissedOptionsRequest(
        seed="seed-3",
        now=datetime(2025, 2, 1, 12, 0, tzinfo=UTC),
        eventId="event-2",
        currentScheduledAt=datetime(2025, 1, 31, 20, 0, tzinfo=UTC),
        template=SchedulerTemplate(id="t1", name="date", baseIntervalDays=7, jitterPct=0.2),
        settings=SchedulerSettings(
            timezone="UTC",
            minGapHours=48,
            allowedWindows=[],
            blackoutDates=[],
        ),
        eventHistory=[
            EventHistoryItem(
                scheduledAt=datetime(2025, 1, 31, 20, 0, tzinfo=UTC),
                completedAt=datetime(2025, 2, 1, 2, 0, tzinfo=UTC),
                status="COMPLETED",
                sentimentLevel="WELL",
            )
        ],
    )

    options = build_missed_options(req)
    earliest = min(option.proposedAt for option in options)
    assert earliest >= datetime(2025, 2, 3, 2, 0, tzinfo=UTC)
