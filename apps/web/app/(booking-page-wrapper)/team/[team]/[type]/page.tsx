import { buildLegacyCtx, decodeParams } from "@lib/buildLegacyCtx";
import { getTeamServerSideProps } from "@server/lib/[user]/[type]/getServerSideProps";
import type { PageProps } from "app/_types";
import { withAppDirSsr } from "app/WithAppDirSsr";
import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import type { PageProps as LegacyPageProps } from "~/users/views/users-type-public-view";
import { generatePublicEventMetadata, renderPublicEventPage } from "../../../_components/PublicEventPage";

const getData: (ctx: ReturnType<typeof buildLegacyCtx>) => Promise<LegacyPageProps> =
  withAppDirSsr<LegacyPageProps>(getTeamServerSideProps);

const ServerPage = async ({ params, searchParams }: PageProps): Promise<JSX.Element> => {
  const context = buildLegacyCtx(await headers(), await cookies(), await params, await searchParams);
  const props = await getData(context);
  return renderPublicEventPage(props);
};

export const generateMetadata = async ({ params, searchParams }: PageProps): Promise<Metadata> => {
  const context = buildLegacyCtx(await headers(), await cookies(), await params, await searchParams);
  const props = await getData(context);
  const decodedParams = decodeParams(await params);

  return generatePublicEventMetadata({
    props,
    canonicalPath: `/team/${decodedParams.team}/${decodedParams.type}`,
  });
};

export default ServerPage;
