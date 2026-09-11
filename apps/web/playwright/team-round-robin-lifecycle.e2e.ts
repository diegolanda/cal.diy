import { prisma } from "@calcom/prisma";
import { BookingStatus, SchedulingType } from "@calcom/prisma/enums";
import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { test } from "./lib/fixtures";
import { bookTimeSlot, confirmReschedule, submitAndWaitForResponse } from "./lib/testUtils";

test.afterEach(({ users }) => users.deleteAll());

async function selectAvailableTimeSlotNextMonth(page: Page, dayIndex: number): Promise<void> {
  const incrementMonth = page.getByTestId("incrementMonth");
  await incrementMonth.waitFor();
  await page.locator('[data-testid="day"][data-disabled="false"]').first().waitFor();

  const scheduleResponse = page.waitForResponse(
    (response) =>
      (response.url().includes("getSchedule") || response.url().includes("/api/v2/slots/available")) &&
      response.ok()
  );
  await incrementMonth.click();
  await scheduleResponse;

  const day = page.locator('[data-testid="day"][data-disabled="false"]').nth(dayIndex);
  await day.waitFor();
  await day.click();
  const time = page.locator('[data-testid="time"]').first();
  await time.waitFor();
  await time.click();
}

test("public Team round-robin booking lifecycle", async ({ page, users }, testInfo) => {
  test.setTimeout(testInfo.timeout * 3);

  const owner = await users.create(null, {
    hasTeam: true,
    schedulingType: SchedulingType.ROUND_ROBIN,
    teamSlug: `nuen-recruiting-${Date.now()}`,
    teamEventTitle: "Recruiter screening",
    teamEventSlug: "recruiter-screening",
    teammates: [{ name: "Recruiter One" }, { name: "Recruiter Two" }],
  });
  const { team } = await owner.getFirstTeamMembership();
  const eventType = await owner.getFirstTeamEvent(team.id, SchedulingType.ROUND_ROBIN);
  const attendeeEmail = users.trackEmail({ username: "candidate", domain: "example.com" });
  const eligibleHosts = await prisma.host.findMany({
    where: { eventTypeId: eventType.id },
    select: { userId: true },
  });
  const eligibleHostIds = eligibleHosts.map(({ userId }) => userId);

  await page.goto(`/team/${team.slug}/${eventType.slug}`);
  await expect(page.getByTestId("event-title")).toHaveText("Recruiter screening");
  await selectAvailableTimeSlotNextMonth(page, 0);
  await bookTimeSlot(page, { name: "Nuen Candidate", email: attendeeEmail });
  await expect(page.getByTestId("success-page")).toBeVisible();

  const originalUid = new URL(page.url()).pathname.split("/").at(-1);
  expect(originalUid).toBeTruthy();
  const originalBooking = await prisma.booking.findUniqueOrThrow({
    where: { uid: originalUid },
    select: { eventTypeId: true, startTime: true, status: true, uid: true, userId: true },
  });
  expect(originalBooking.eventTypeId).toBe(eventType.id);
  expect(originalBooking.status).toBe(BookingStatus.ACCEPTED);
  expect(eligibleHostIds).toContain(originalBooking.userId);

  await page.goto(`/reschedule/${originalBooking.uid}`);
  await expect(page).toHaveURL(
    new RegExp(`/team/${team.slug}/${eventType.slug}\\?rescheduleUid=${originalBooking.uid}`)
  );
  await selectAvailableTimeSlotNextMonth(page, 1);
  await confirmReschedule(page);
  await expect(page.getByTestId("success-page")).toBeVisible();

  const rescheduledBooking = await prisma.booking.findFirstOrThrow({
    where: { fromReschedule: originalBooking.uid },
    select: { eventTypeId: true, startTime: true, status: true, uid: true, userId: true },
  });
  const cancelledOriginal = await prisma.booking.findUniqueOrThrow({
    where: { uid: originalBooking.uid },
    select: { status: true },
  });
  expect(cancelledOriginal.status).toBe(BookingStatus.CANCELLED);
  expect(rescheduledBooking.eventTypeId).toBe(eventType.id);
  expect(rescheduledBooking.startTime).not.toEqual(originalBooking.startTime);
  expect(rescheduledBooking.status).toBe(BookingStatus.ACCEPTED);
  expect(eligibleHostIds).toContain(rescheduledBooking.userId);

  await page.getByTestId("cancel").click();
  await page.getByTestId("cancel_reason").fill("Candidate withdrew");
  await submitAndWaitForResponse(page, "/api/cancel", {
    action: () => page.getByTestId("confirm_cancel").click(),
  });
  await expect(page.getByTestId("cancelled-headline")).toBeVisible();

  const cancelledRescheduledBooking = await prisma.booking.findUniqueOrThrow({
    where: { uid: rescheduledBooking.uid },
    select: { cancellationReason: true, status: true },
  });
  expect(cancelledRescheduledBooking.status).toBe(BookingStatus.CANCELLED);
  expect(cancelledRescheduledBooking.cancellationReason).toBe("Candidate withdrew");
});
