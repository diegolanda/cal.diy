import type { Host } from "@calcom/features/eventtypes/lib/types";
import { describe, expect, it } from "vitest";
import { updateRoundRobinHosts } from "./EventTeamAssignmentTab";

const member = {
  id: 7,
  name: "Ada Lovelace",
  email: "ada@nuen.io",
  avatar: "",
  defaultScheduleId: 12,
};

describe("updateRoundRobinHosts", () => {
  it("adds a Team member with equal round-robin defaults", () => {
    expect(updateRoundRobinHosts({ hosts: [], member, selected: true })).toEqual([
      {
        userId: 7,
        isFixed: false,
        priority: 2,
        weight: 100,
        scheduleId: 12,
        groupId: null,
      },
    ]);
  });

  it("preserves saved host settings when the member is already selected", () => {
    const hosts: Host[] = [
      {
        userId: 7,
        isFixed: false,
        priority: 4,
        weight: 50,
        scheduleId: 20,
        groupId: null,
      },
    ];

    expect(updateRoundRobinHosts({ hosts, member, selected: true })).toBe(hosts);
  });

  it("removes only the deselected member", () => {
    const otherHost: Host = {
      userId: 8,
      isFixed: false,
      priority: 2,
      weight: 100,
      scheduleId: null,
      groupId: null,
    };

    expect(
      updateRoundRobinHosts({
        hosts: [
          {
            userId: 7,
            isFixed: false,
            priority: 2,
            weight: 100,
            scheduleId: 12,
            groupId: null,
          },
          otherHost,
        ],
        member,
        selected: false,
      })
    ).toEqual([otherHost]);
  });
});
