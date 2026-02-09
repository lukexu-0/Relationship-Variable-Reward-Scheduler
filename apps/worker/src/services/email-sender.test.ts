import { beforeEach, describe, expect, it, vi } from "vitest";

const { sendMock, commandInputs } = vi.hoisted(() => ({
  sendMock: vi.fn(),
  commandInputs: [] as unknown[]
}));

vi.mock("@aws-sdk/client-sesv2", () => ({
  SESv2Client: class {
    send = sendMock;
  },
  SendEmailCommand: class {
    constructor(input: unknown) {
      commandInputs.push(input);
    }
  }
}));

import { sendReminderEmail } from "./email-sender.js";

describe("email-sender", () => {
  beforeEach(() => {
    sendMock.mockReset();
    commandInputs.length = 0;
  });

  it("builds and sends SES reminder email payload", async () => {
    sendMock.mockResolvedValue({ MessageId: "ses-message-1" });

    const messageId = await sendReminderEmail({
      recipient: "user@example.com",
      profileName: "Main",
      templateName: "flowers",
      scheduledAt: "2026-02-10T20:00:00.000Z",
      timezone: "UTC"
    });

    expect(messageId).toBe("ses-message-1");
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(commandInputs).toHaveLength(1);
  });
});
