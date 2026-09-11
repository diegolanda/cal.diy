import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TeamManagementView from "./TeamManagementView";

const mocks = vi.hoisted(() => ({
  createTeam: vi.fn(),
  invalidateTeams: vi.fn(),
}));

vi.mock("@calcom/lib/hooks/useLocale", () => ({
  useLocale: () => ({
    i18n: { exists: () => false },
    isLocaleReady: true,
    t: (key: string) =>
      ({
        create_team: "Create team",
        no_teams: "No teams",
        no_teams_description: "Create a team to get started",
        team_name: "Team name",
        team_slug: "Team slug",
        your_team_name: "Your team name",
      })[key] ?? key,
  }),
}));

vi.mock("@calcom/trpc/react", () => ({
  trpc: {
    useUtils: () => ({ viewer: { teams: { list: { invalidate: mocks.invalidateTeams } } } }),
    viewer: {
      teams: {
        create: {
          useMutation: () => ({ isPending: false, mutate: mocks.createTeam }),
        },
        list: {
          useQuery: () => ({ data: [], isPending: false }),
        },
      },
    },
  },
}));

describe("TeamManagementView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows labeled Team creation fields with placeholders", () => {
    render(<TeamManagementView canCreateTeams />);

    expect(screen.getByRole("textbox", { name: "Team name" })).toHaveAttribute(
      "placeholder",
      "Your team name"
    );
    expect(screen.getByRole("textbox", { name: "Team slug" })).toHaveAttribute("placeholder", "Team slug");
  });

  it("submits a new Team through the Teams mutation", () => {
    render(<TeamManagementView canCreateTeams />);

    fireEvent.change(screen.getByRole("textbox", { name: "Team name" }), {
      target: { value: "Recruitment" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Team slug" }), {
      target: { value: "recruitment" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create team" }));

    expect(mocks.createTeam).toHaveBeenCalledWith({
      bio: null,
      name: "Recruitment",
      slug: "recruitment",
    });
  });
});
