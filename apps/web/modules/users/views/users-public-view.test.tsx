import { useRouterQuery } from "@calcom/lib/hooks/useRouterQuery";
import { render, screen } from "@testing-library/react";
import { describe, it, vi } from "vitest";
import UserPage from "./users-public-view";

vi.mock("@calcom/lib/constants", async () => {
  return await vi.importActual("@calcom/lib/constants");
});

vi.mock("@calcom/lib/hooks/useRouterQuery", () => ({
  useRouterQuery: vi.fn(),
}));

vi.mock("@calcom/embed-core/embed-iframe", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@calcom/embed-core/embed-iframe")>()),
  useIsEmbed: (isEmbed?: boolean) => Boolean(isEmbed),
}));

vi.mock("@calcom/lib/hooks/useLocale", () => ({
  useLocale: () => ({
    t: (key: string) =>
      ({
        nuen_booking_promo_description:
          "Start with one engineer at 10–20 hours a week. You see the rate, 75% of it goes to the engineer, and you scale only when the fit is real.",
        nuen_booking_promo_headline_accent: "engineers without the agency markup.",
        nuen_booking_promo_headline_lead: "Hire senior LATAM",
      })[key] ?? key,
  }),
}));

function mockedUserPageComponentProps(props: Partial<React.ComponentProps<typeof UserPage>>) {
  return {
    themeBasis: "dark",
    safeBio: "My Bio",
    profile: {
      name: "John Doe",
      image: "john-profile-url",
      theme: "dark",
      brandColor: "red",
      darkBrandColor: "black",
      organization: {
        requestedSlug: "slug",
        slug: "slug",
        id: 1,
        brandColor: null,
        darkBrandColor: null,
        theme: null,
      },
      allowSEOIndexing: true,
      username: "john",
    },
    users: [
      {
        name: "John Doe",
        username: "john",
        avatarUrl: "john-user-url",
        bio: "",
        verified: false,
        profile: {
          upId: "1",
          id: 1,
          username: "john",
          organizationId: null,
          organization: null,
        },
      },
    ],
    markdownStrippedBio: "My Bio",
    entity: {
      considerUnpublished: false,
      ...(props.entity ?? null),
    },
    eventTypes: [],
    isBrandingHidden: props.isBrandingHidden ?? false,
    isOrgSEOIndexable: false,
    isEmbed: props.isEmbed ?? false,
    isPlatformProfile: props.isPlatformProfile ?? false,
  } satisfies React.ComponentProps<typeof UserPage>;
}

describe("UserPage Component", () => {
  it("should render with no throw", async () => {
    const mockData = {
      props: mockedUserPageComponentProps({
        entity: {
          considerUnpublished: false,
          orgSlug: "org1",
        },
      }),
    };

    vi.mocked(useRouterQuery).mockReturnValue({
      uid: "uid",
    });

    expect(() => render(<UserPage {...mockData.props} />)).not.toThrow();
  });

  it("shows the Nuen campaign on direct public profile pages", () => {
    const props = mockedUserPageComponentProps({ isEmbed: false });

    render(<UserPage {...props} />);

    expect(screen.getByTestId("nuen-booking-promo")).toBeInTheDocument();
    expect(screen.getByTestId("nuen-booking-promo").parentElement).toHaveClass("nuen-booking-background");
    expect(screen.getByTestId("nuen-booking-promo-headline")).toHaveTextContent(
      "Hire senior LATAM engineers without the agency markup."
    );
    expect(
      screen.queryByText(
        "Start with one engineer at 10–20 hours a week. You see the rate, 75% of it goes to the engineer, and you scale only when the fit is real."
      )
    ).not.toBeInTheDocument();
  });

  it("does not show the Nuen campaign on embedded profile pages", () => {
    const props = mockedUserPageComponentProps({ isEmbed: true });

    render(<UserPage {...props} />);

    expect(screen.queryByTestId("nuen-booking-promo")).not.toBeInTheDocument();
  });

  it("does not show the Nuen campaign when branding is hidden", () => {
    const props = mockedUserPageComponentProps({ isBrandingHidden: true });

    render(<UserPage {...props} />);

    expect(screen.queryByTestId("nuen-booking-promo")).not.toBeInTheDocument();
  });

  it("does not show the Nuen campaign on platform profiles", () => {
    const props = mockedUserPageComponentProps({ isPlatformProfile: true });

    render(<UserPage {...props} />);

    expect(screen.queryByTestId("nuen-booking-promo")).not.toBeInTheDocument();
  });
});
