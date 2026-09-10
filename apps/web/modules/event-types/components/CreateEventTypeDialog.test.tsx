import { SchedulingType } from "@calcom/prisma/enums";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CreateEventTypeDialog } from "./CreateEventTypeDialog";

type MockState = {
  mutate: ReturnType<typeof vi.fn>;
  replace: ReturnType<typeof vi.fn>;
  query: {
    teamId?: number;
    eventPage?: string;
  };
  onSuccess?: (eventType: { id: number; teamId: number | null; title: string }) => void;
};

const mocks: MockState = vi.hoisted(() => ({
  mutate: vi.fn(),
  replace: vi.fn(),
  query: {
    teamId: undefined,
    eventPage: undefined,
  },
  onSuccess: undefined,
}));

vi.mock("@calcom/features/components/controlled-dialog", () => ({
  Dialog: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@calcom/features/eventtypes/components/CreateEventTypeForm", () => ({
  default: ({
    handleSubmit,
    pageSlug,
  }: {
    handleSubmit: (values: { title: string; slug: string; length: number }) => void;
    pageSlug?: string;
  }) => (
    <div>
      <span data-testid="page-slug">{pageSlug}</span>
      <button
        type="button"
        onClick={() => handleSubmit({ title: "Intro call", slug: "intro-call", length: 30 })}>
        Submit event
      </button>
    </div>
  ),
}));

vi.mock("@calcom/lib/hooks/useLocale", () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

vi.mock("@calcom/lib/hooks/useTypedQuery", () => ({
  useTypedQuery: () => ({ data: mocks.query }),
}));

vi.mock("@calcom/ui/components/dialog", () => ({
  DialogClose: () => null,
  DialogContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  DialogFooter: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@calcom/ui/components/toast", () => ({
  showToast: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }),
}));

vi.mock("@calcom/web/modules/event-types/hooks/useCreateEventType", () => ({
  useCreateEventType: (
    onSuccess: (eventType: { id: number; teamId: number | null; title: string }) => void
  ) => {
    mocks.onSuccess = onSuccess;
    return {
      form: {},
      createMutation: { isPending: false, mutate: mocks.mutate },
      isManagedEventType: false,
    };
  },
}));

const personalProfile = {
  teamId: null,
  label: "Diego",
  image: "",
  membershipRole: null,
  slug: "diego",
  permissions: { canCreateEventType: true },
};

const teamProfile = {
  teamId: 42,
  label: "Recruitment",
  image: "",
  membershipRole: null,
  slug: "recruitment",
  permissions: { canCreateEventType: true },
};

describe("CreateEventTypeDialog", () => {
  afterEach(() => {
    vi.clearAllMocks();
    mocks.query.teamId = undefined;
    mocks.query.eventPage = undefined;
    mocks.onSuccess = undefined;
  });

  it("creates Team events as round robin events under the Team route", () => {
    mocks.query.teamId = teamProfile.teamId;
    mocks.query.eventPage = teamProfile.slug;

    render(<CreateEventTypeDialog profileOptions={[personalProfile, teamProfile]} />);

    expect(screen.getByTestId("page-slug")).toHaveTextContent("team/recruitment");
    fireEvent.click(screen.getByRole("button", { name: "Submit event" }));

    expect(mocks.mutate).toHaveBeenCalledWith({
      title: "Intro call",
      slug: "intro-call",
      length: 30,
      teamId: 42,
      schedulingType: SchedulingType.ROUND_ROBIN,
    });

    mocks.onSuccess?.({ id: 7, teamId: 42, title: "Intro call" });
    expect(mocks.replace).toHaveBeenCalledWith("/event-types/7?tabName=team");
  });

  it("does not render a Team form without create permission", () => {
    mocks.query.teamId = teamProfile.teamId;

    render(
      <CreateEventTypeDialog
        profileOptions={[personalProfile, { ...teamProfile, permissions: { canCreateEventType: false } }]}
      />
    );

    expect(screen.queryByRole("button", { name: "Submit event" })).not.toBeInTheDocument();
    expect(screen.getByText("error_event_type_unauthorized_create")).toBeInTheDocument();
  });

  it("keeps personal event creation unchanged", () => {
    mocks.query.eventPage = personalProfile.slug;

    render(<CreateEventTypeDialog profileOptions={[personalProfile, teamProfile]} />);

    expect(screen.getByTestId("page-slug")).toHaveTextContent("diego");
    fireEvent.click(screen.getByRole("button", { name: "Submit event" }));

    expect(mocks.mutate).toHaveBeenCalledWith({
      title: "Intro call",
      slug: "intro-call",
      length: 30,
    });
  });
});
