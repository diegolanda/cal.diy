import { describe, expect, it } from "vitest";
import {
  getEventTypeVisibilityActionKey,
  getEventTypeVisibilityDescriptionKey,
  getEventTypeVisibilityStatusKey,
  isArchivedTeamEventType,
} from "./eventTypeVisibility";

describe("Team event visibility", () => {
  it("treats only hidden Team events as archived", () => {
    expect(isArchivedTeamEventType({ hidden: true, teamId: 12 })).toBe(true);
    expect(isArchivedTeamEventType({ hidden: false, teamId: 12 })).toBe(false);
    expect(isArchivedTeamEventType({ hidden: true, teamId: null })).toBe(false);
  });

  it("uses archive and restore actions for Team events", () => {
    expect(getEventTypeVisibilityActionKey({ hidden: false, teamId: 12 })).toBe("archive_team_event");
    expect(getEventTypeVisibilityDescriptionKey({ hidden: false, teamId: 12 })).toBe(
      "archive_team_event_description"
    );
    expect(getEventTypeVisibilityActionKey({ hidden: true, teamId: 12 })).toBe("restore_team_event");
    expect(getEventTypeVisibilityDescriptionKey({ hidden: true, teamId: 12 })).toBe(
      "restore_team_event_description"
    );
    expect(getEventTypeVisibilityStatusKey({ hidden: true, teamId: 12 })).toBe("archived");
  });

  it("preserves profile visibility actions for personal events", () => {
    expect(getEventTypeVisibilityActionKey({ hidden: false, teamId: null })).toBe("hide_from_profile");
    expect(getEventTypeVisibilityDescriptionKey({ hidden: false, teamId: null })).toBe("hide_from_profile");
    expect(getEventTypeVisibilityActionKey({ hidden: true, teamId: null })).toBe("show_eventtype_on_profile");
    expect(getEventTypeVisibilityDescriptionKey({ hidden: true, teamId: null })).toBe(
      "show_eventtype_on_profile"
    );
    expect(getEventTypeVisibilityStatusKey({ hidden: true, teamId: null })).toBe("hidden");
  });
});
