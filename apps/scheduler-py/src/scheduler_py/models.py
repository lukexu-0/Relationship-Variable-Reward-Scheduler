from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

SentimentLevel = Literal["VERY_POOR", "POOR", "NEUTRAL", "WELL", "VERY_WELL"]
EventStatus = Literal["SCHEDULED", "COMPLETED", "MISSED", "RESCHEDULED", "CANCELED"]


class DateWindow(BaseModel):
    weekday: int = Field(ge=0, le=6)
    startLocalTime: str
    endLocalTime: str


class BlackoutDate(BaseModel):
    startAt: datetime
    endAt: datetime | None = None
    allDay: bool = False
    note: str | None = None


class SchedulerSettings(BaseModel):
    timezone: str
    minGapHours: int = Field(ge=1, le=720)
    allowedWindows: list[DateWindow] = Field(default_factory=list)
    blackoutDates: list[BlackoutDate] = Field(default_factory=list)


class SchedulerTemplate(BaseModel):
    id: str
    name: str
    baseIntervalDays: float = Field(gt=0)
    jitterPct: float = Field(ge=0, le=0.9)


class EventHistoryItem(BaseModel):
    scheduledAt: datetime
    status: EventStatus
    completedAt: datetime | None = None
    missedAt: datetime | None = None
    sentimentLevel: SentimentLevel | None = None


class RecommendNextRequest(BaseModel):
    seed: str
    now: datetime
    template: SchedulerTemplate
    settings: SchedulerSettings
    eventHistory: list[EventHistoryItem] = Field(default_factory=list)


class RecommendNextResponse(BaseModel):
    scheduledAt: datetime
    rationale: str


class MissedOptionsRequest(BaseModel):
    seed: str
    now: datetime
    eventId: str
    currentScheduledAt: datetime
    template: SchedulerTemplate
    settings: SchedulerSettings
    eventHistory: list[EventHistoryItem] = Field(default_factory=list)


class MissedOption(BaseModel):
    optionId: str
    profileId: str
    eventId: str
    type: Literal["ASAP", "DELAYED"]
    proposedAt: datetime
    rationale: str
    recommended: bool


class MissedOptionsResponse(BaseModel):
    options: list[MissedOption]


class SchedulerSignal(BaseModel):
    templateId: str
    sentimentLevel: SentimentLevel | None = None
    status: EventStatus
    completedAt: datetime | None = None


class RecomputeStateRequest(BaseModel):
    profileId: str
    now: datetime
    templateSignals: list[SchedulerSignal]


class RecomputeStateResponse(BaseModel):
    ok: bool
    profileId: str
    sentimentScore: float
