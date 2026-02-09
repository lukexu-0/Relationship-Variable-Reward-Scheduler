import { SendEmailCommand, SESv2Client } from "@aws-sdk/client-sesv2";
import {
  buildReminderHtml,
  buildReminderSubject,
  buildReminderText,
  type ReminderEmailInput
} from "@reward/shared-email";

import { config } from "../config.js";

const sesClient = new SESv2Client({ region: config.AWS_REGION });

export async function sendReminderEmail(payload: ReminderEmailInput): Promise<string | undefined> {
  const command = new SendEmailCommand({
    FromEmailAddress: config.SES_FROM_EMAIL,
    Destination: {
      ToAddresses: [payload.recipient]
    },
    Content: {
      Simple: {
        Subject: {
          Data: buildReminderSubject(payload)
        },
        Body: {
          Html: { Data: buildReminderHtml(payload) },
          Text: { Data: buildReminderText(payload) }
        }
      }
    }
  });

  const response = await sesClient.send(command);
  return response.MessageId;
}
