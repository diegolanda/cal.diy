import { buildLegacyCtx, decodeParams } from "@lib/buildLegacyCtx";
import { getServerSideProps } from "@server/lib/[user]/[type]/getServerSideProps";
import type { PageProps } from "app/_types";
import { withAppDirSsr } from "app/WithAppDirSsr";
import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import type { PageProps as LegacyPageProps } from "~/users/views/users-type-public-view";
import { generatePublicEventMetadata, renderPublicEventPage } from "../../_components/PublicEventPage";

const getData: (ctx: ReturnType<typeof buildLegacyCtx>) => Promise<LegacyPageProps> =
  withAppDirSsr<LegacyPageProps>(getServerSideProps);

const ServerPage = async ({ params, searchParams }: PageProps): Promise<JSX.Element> => {
  const legacyCtx = buildLegacyCtx(await headers(), await cookies(), await params, await searchParams);
  const props = await getData(legacyCtx);
  return renderPublicEventPage(props);
};

export const generateMetadata = async ({ params, searchParams }: PageProps): Promise<Metadata> => {
  const legacyCtx = buildLegacyCtx(await headers(), await cookies(), await params, await searchParams);
  const props = await getData(legacyCtx);

  const decodedParams = decodeParams(await params);
  return generatePublicEventMetadata({
    props,
    canonicalPath: `/${decodedParams.user}/${decodedParams.type}`,
  });
};

export default ServerPage;
