export interface ReminderEmailInput {
  recipient: string;
  profileName: string;
  templateName: string;
  scheduledAt: string;
  timezone: string;
}

export function buildReminderSubject(input: ReminderEmailInput): string {
  return `Reminder: ${input.templateName} for ${input.profileName}`;
}

export function buildReminderHtml(input: ReminderEmailInput): string {
  return `
    <html>
      <body>
        <h2>Upcoming relationship reward</h2>
        <p><strong>Profile:</strong> ${escapeHtml(input.profileName)}</p>
        <p><strong>Reward:</strong> ${escapeHtml(input.templateName)}</p>
        <p><strong>Scheduled time:</strong> ${escapeHtml(input.scheduledAt)} (${escapeHtml(input.timezone)})</p>
        <p>This is your configured reminder lead-time email.</p>
      </body>
    </html>
  `;
}

export function buildReminderText(input: ReminderEmailInput): string {
  return [
    "Upcoming relationship reward",
    `Profile: ${input.profileName}`,
    `Reward: ${input.templateName}`,
    `Scheduled time: ${input.scheduledAt} (${input.timezone})`,
    "This is your configured reminder lead-time email."
  ].join("\n");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
