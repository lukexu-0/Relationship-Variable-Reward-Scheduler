from __future__ import annotations

from fastapi.testclient import TestClient

from scheduler_py.app import app

client = TestClient(app)


def test_healthz() -> None:
    response = client.get("/healthz")
    assert response.status_code == 200
    assert response.json() == {"ok": True}


def test_recommend_next_is_deterministic_for_same_input() -> None:
    payload = {
        "seed": "stable-seed",
        "now": "2025-02-01T12:00:00Z",
        "template": {
            "id": "template-1",
            "name": "flowers",
            "baseIntervalDays": 7,
            "jitterPct": 0.2,
        },
        "settings": {
            "timezone": "UTC",
            "minGapHours": 24,
            "allowedWindows": [{"weekday": 1, "startLocalTime": "18:00", "endLocalTime": "21:00"}],
            "blackoutDates": [],
        },
        "eventHistory": [],
    }

    first = client.post("/v1/scheduler/recommend-next", json=payload)
    second = client.post("/v1/scheduler/recommend-next", json=payload)

    assert first.status_code == 200
    assert second.status_code == 200
    assert first.json() == second.json()


def test_missed_options_endpoint_returns_asap_and_delayed() -> None:
    payload = {
        "seed": "stable-seed",
        "now": "2025-02-01T12:00:00Z",
        "eventId": "event-1",
        "currentScheduledAt": "2025-01-31T12:00:00Z",
        "template": {
            "id": "template-1",
            "name": "flowers",
            "baseIntervalDays": 7,
            "jitterPct": 0.2,
        },
        "settings": {
            "timezone": "UTC",
            "minGapHours": 24,
            "allowedWindows": [],
            "blackoutDates": [],
        },
        "eventHistory": [],
    }

    response = client.post("/v1/scheduler/missed-options", json=payload)
    assert response.status_code == 200

    body = response.json()
    assert len(body["options"]) == 2
    assert sorted(option["type"] for option in body["options"]) == ["ASAP", "DELAYED"]
    assert sum(1 for option in body["options"] if option["recommended"]) == 1


def test_recompute_state_average_sentiment() -> None:
    payload = {
        "profileId": "profile-1",
        "now": "2025-02-01T12:00:00Z",
        "templateSignals": [
            {"templateId": "t1", "status": "COMPLETED", "sentimentLevel": "VERY_WELL"},
            {"templateId": "t1", "status": "COMPLETED", "sentimentLevel": "POOR"},
        ],
    }

    response = client.post("/v1/scheduler/recompute-state", json=payload)
    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is True
    assert body["profileId"] == "profile-1"
    assert body["sentimentScore"] == 0.5
