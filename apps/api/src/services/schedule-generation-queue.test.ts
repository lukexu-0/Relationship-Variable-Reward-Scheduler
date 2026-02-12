import { beforeEach, describe, expect, it, vi } from "vitest";

const { addMock, closeMock, quitMock, queueCtorMock, redisCtorMock } = vi.hoisted(() => {
  const addMock = vi.fn(async () => undefined);
  const closeMock = vi.fn(async () => undefined);
  const quitMock = vi.fn(async () => undefined);
  const queueCtorMock = vi.fn(function QueueMock(this: { add: typeof addMock; close: typeof closeMock }) {
    this.add = addMock;
    this.close = closeMock;
  });
  const redisCtorMock = vi.fn(function RedisMock(this: { quit: typeof quitMock }) {
    this.quit = quitMock;
  });
  return { addMock, closeMock, quitMock, queueCtorMock, redisCtorMock };
});

vi.mock("bullmq", () => ({
  Queue: queueCtorMock
}));

vi.mock("ioredis", () => ({
  Redis: redisCtorMock
}));

import {
  closeScheduleGenerationQueue,
  enqueueProfileScheduleGeneration
} from "./schedule-generation-queue.js";

describe("schedule-generation-queue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("enqueues a profile refresh job with deterministic job id", async () => {
    await enqueueProfileScheduleGeneration("profile-1");

    expect(queueCtorMock).toHaveBeenCalledTimes(1);
    expect(addMock).toHaveBeenCalledWith(
      "profile-refresh",
      { profileId: "profile-1" },
      expect.objectContaining({ jobId: "profile-refresh:profile-1" })
    );
  });

  it("closes queue and redis connection", async () => {
    await enqueueProfileScheduleGeneration("profile-1");
    await closeScheduleGenerationQueue();

    expect(closeMock).toHaveBeenCalledTimes(1);
    expect(quitMock).toHaveBeenCalledTimes(1);
  });
});
