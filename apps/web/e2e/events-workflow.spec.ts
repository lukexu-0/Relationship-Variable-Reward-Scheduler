import { expect, type Page, test } from "@playwright/test";

const PASSWORD = "StrongPassword123";
const TIMEZONE = "America/New_York";

test.describe("events workflow", () => {
  test("supports profile panel, event CRUD UX, calendar sync, and settings GUI", async ({ page }) => {
    attachDialogAutoAccept(page);
    await registerAndLogin(page, "dashboard-flow");

    const profilePanel = page.locator(".profile-create-panel");
    await expect(profilePanel).not.toHaveClass(/open/);

    await page.getByRole("button", { name: "New profile" }).click();
    await expect(profilePanel).toHaveClass(/open/);

    await page.getByLabel("Profile name").fill(`E2E Profile ${Date.now()}`);
    await page.getByLabel("Partner name (optional)").fill("Taylor");
    await page.getByRole("button", { name: "Create profile" }).click();
    await expect(page.locator(".set-list-item").first()).toBeVisible();
    await page.getByRole("button", { name: "Event Builder" }).click();
    await expect(page.locator("#configEnabled")).toBeVisible();

    // Disable selected config to prevent worker auto-generation races during this manual CRUD flow.
    await page.locator("#configEnabled").selectOption("false");
    await page.getByRole("button", { name: "Save event" }).first().click();
    await expect(page.locator("#configEnabled")).toHaveValue("false");

    await deleteAllUpcomingEvents(page);
    await expect(page.locator(".upcoming-choice")).toHaveCount(0);

    const selectedConfigName = await page.locator("#configName").inputValue();
    const dateTomorrow = dateOffset(1);
    const datePlus2 = dateOffset(2);

    // Create date-only event.
    await page.locator("#setEventDate").fill(dateTomorrow);
    await page.locator("#setEventUseTime").selectOption("no");
    await page.locator("#setEventNotes").fill("Date-only event");
    await page.getByRole("button", { name: "Add event" }).click();
    await expect(page.locator(".upcoming-choice")).toHaveCount(1);

    // Hover-delete upcoming event using trash affordance.
    const firstUpcoming = page.locator(".upcoming-choice").first();
    await firstUpcoming.hover();
    await firstUpcoming.getByRole("button", { name: "Delete upcoming event" }).click();
    await expect(page.locator(".upcoming-choice")).toHaveCount(0);

    // Create event with explicit time.
    await page.locator("#setEventDate").fill(datePlus2);
    await page.locator("#setEventUseTime").selectOption("yes");
    await page.locator("#setEventTime").fill("14:30");
    await page.locator("#setEventNotes").fill("Explicit time event");
    await page.getByRole("button", { name: "Add event" }).click();
    await expect(page.locator(".upcoming-choice")).toHaveCount(1);

    // Calendar click should sync selected event in inspector/editor.
    const eventDay = page.locator(".calendar-day").filter({ hasText: selectedConfigName }).first();
    await expect(eventDay).toBeVisible();
    await eventDay.click();
    await expect(page.locator(".event-editor strong").first()).toHaveText(selectedConfigName);

    // Settings GUI: allowed windows + recurring blackout weekdays + specific blackout ranges.
    await page.getByRole("button", { name: "Schedule Settings" }).click();
    await expect(page.locator("#weekday-enabled-0")).toBeVisible();
    await expect(page.locator("#weekday-enabled-0")).toHaveValue("true");
    await page.locator("#weekday-enabled-0").selectOption("false");
    await page.getByLabel("Tue").check();

    const blackoutEditor = page.locator(".blackout-editor");
    await blackoutEditor.getByRole("button", { name: "Add blackout" }).click();
    await blackoutEditor.getByLabel("Start").fill(`${datePlus2}T08:00`);
    await blackoutEditor.getByLabel("End (optional)").fill(`${datePlus2}T21:00`);
    await blackoutEditor.getByLabel("Note").fill("Do not schedule on this date");

    await page.getByRole("button", { name: "Save settings" }).click();
    await expect(page.locator("#weekday-enabled-0")).toHaveValue("false");
    await expect(page.getByLabel("Tue")).toBeChecked();
  });

  test("auto-generates a new upcoming event after completion", async ({ page }) => {
    test.slow();
    attachDialogAutoAccept(page);
    await registerAndLogin(page, "auto-generation");

    await page.getByRole("button", { name: "New profile" }).click();
    await page.getByLabel("Profile name").fill(`AutoGen Profile ${Date.now()}`);
    await page.getByRole("button", { name: "Create profile" }).click();
    await expect(page.locator(".set-list-item").first()).toBeVisible();
    await page.getByRole("button", { name: "Event Builder" }).click();
    await expect(page.locator("#setEventDate")).toBeVisible();

    // If a worker already generated one, use it; otherwise create one manually.
    if ((await page.locator(".upcoming-choice").count()) === 0) {
      await page.locator("#setEventDate").fill(dateOffset(1));
      await page.locator("#setEventUseTime").selectOption("yes");
      await page.locator("#setEventTime").fill("10:00");
      await page.getByRole("button", { name: "Add event" }).click();
      await expect(page.locator(".upcoming-choice")).toHaveCount(1);
    }

    await page.locator(".upcoming-choice").first().click();
    await page.getByRole("button", { name: "Complete" }).click();

    await expect.poll(async () => page.locator(".upcoming-choice").count(), {
      timeout: 60_000
    }).toBeGreaterThan(0);
  });
});

function attachDialogAutoAccept(page: Page) {
  page.on("dialog", (dialog) => dialog.accept());
}

async function registerAndLogin(page: Page, scenario: string) {
  await page.goto("/");
  await page.getByRole("button", { name: "Register" }).click();

  const email = `e2e-${scenario}-${Date.now()}@example.com`;
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByLabel("Timezone").fill(TIMEZONE);
  await page.getByRole("button", { name: "Create Account" }).click();

  await expect(page.getByRole("heading", { name: "Variable Reward Scheduler" })).toBeVisible();
}

async function deleteAllUpcomingEvents(page: Page) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const rows = page.locator(".upcoming-choice");
    if ((await rows.count()) === 0) {
      return;
    }

    const first = rows.first();
    await first.hover();
    await first.getByRole("button", { name: "Delete upcoming event" }).click();
    await page.waitForTimeout(200);
  }
}

function dateOffset(daysFromToday: number): string {
  const value = new Date();
  value.setDate(value.getDate() + daysFromToday);
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
