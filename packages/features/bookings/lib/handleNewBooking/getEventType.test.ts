import { ErrorCode } from "@calcom/lib/errorCodes";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getEventType } from "./getEventType";
import type { getEventTypeResponse } from "./getEventTypesFromDB";
import { getEventTypesFromDB } from "./getEventTypesFromDB";

vi.mock("@calcom/features/bookings/lib/getBookingFields", () => ({
  getBookingFieldsWithSystemFields: vi.fn().mockReturnValue([]),
}));

vi.mock("@calcom/features/eventtypes/lib/defaultEvents", () => ({
  getDefaultEvent: vi.fn(),
}));

vi.mock("@calcom/lib/sentryWrapper", () => ({
  withReporting: (handler: typeof getEventType) => handler,
}));

vi.mock("./getEventTypesFromDB", () => ({
  getEventTypesFromDB: vi.fn(),
}));

const createEventType = (
  overrides: Partial<Pick<getEventTypeResponse, "hidden" | "team" | "teamId">>
): getEventTypeResponse =>
  ({
    hidden: false,
    team: null,
    teamId: null,
    ...overrides,
  }) as getEventTypeResponse;

describe("getEventType Team archive enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects booking creation for an archived Team event", async () => {
    vi.mocked(getEventTypesFromDB).mockResolvedValue(
      createEventType({ hidden: true, teamId: 12, team: null })
    );

    await expect(getEventType({ eventTypeId: 42 })).rejects.toMatchObject({
      code: ErrorCode.EventTypeNotFound,
    });
  });

  it("preserves booking creation for a hidden personal event", async () => {
    vi.mocked(getEventTypesFromDB).mockResolvedValue(
      createEventType({ hidden: true, teamId: null, team: null })
    );

    await expect(getEventType({ eventTypeId: 42 })).resolves.toMatchObject({
      hidden: true,
      teamId: null,
    });
  });
});
