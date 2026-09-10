import { buildLegacyCtx } from "@lib/buildLegacyCtx";
import { getTeamServerSideProps } from "@server/lib/[user]/[type]/getServerSideProps";
import type { PageProps } from "app/_types";
import withEmbedSsrAppDir from "app/WithEmbedSSR";
import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import type { PageProps as LegacyPageProps } from "~/users/views/users-type-public-view";
import { renderPublicEventPage } from "../../../../_components/PublicEventPage";

const getData: (context: ReturnType<typeof buildLegacyCtx>) => Promise<LegacyPageProps> =
  withEmbedSsrAppDir<LegacyPageProps>(getTeamServerSideProps);

const ServerPage = async ({ params, searchParams }: PageProps): Promise<JSX.Element> => {
  const context = buildLegacyCtx(await headers(), await cookies(), await params, await searchParams);
  const props = await getData(context);
  return renderPublicEventPage(props);
};

export const generateMetadata = async (): Promise<Metadata> => ({
  robots: {
    follow: false,
    index: false,
  },
});

export default ServerPage;
