import { SchedulingType } from "@calcom/prisma/enums";
import { describe, expect, it } from "vitest";
import { getInitialEventTypeHidden } from "./create.handler";

describe("getInitialEventTypeHidden", () => {
  it("creates a round-robin Team event as hidden", () => {
    expect(
      getInitialEventTypeHidden({
        hidden: false,
        teamId: 10,
        schedulingType: SchedulingType.ROUND_ROBIN,
      })
    ).toBe(true);
  });

  it("preserves the requested visibility for a collective Team event", () => {
    expect(
      getInitialEventTypeHidden({
        hidden: false,
        teamId: 10,
        schedulingType: SchedulingType.COLLECTIVE,
      })
    ).toBe(false);
  });

  it("preserves the requested visibility for a personal event", () => {
    expect(
      getInitialEventTypeHidden({
        hidden: false,
        teamId: null,
        schedulingType: null,
      })
    ).toBe(false);
  });
});
