import { buildLegacyCtx } from "@lib/buildLegacyCtx";
import { getServerSideProps } from "@server/lib/[user]/[type]/getServerSideProps";
import type { PageProps as ServerPageProps } from "app/_types";
import withEmbedSsrAppDir from "app/WithEmbedSSR";
import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import type { PageProps as ClientPageProps } from "~/users/views/users-type-public-view";
import { renderPublicEventPage } from "../../../_components/PublicEventPage";

const getData: (context: ReturnType<typeof buildLegacyCtx>) => Promise<ClientPageProps> =
  withEmbedSsrAppDir<ClientPageProps>(getServerSideProps);

const ServerPage = async ({ params, searchParams }: ServerPageProps): Promise<JSX.Element> => {
  const context = buildLegacyCtx(await headers(), await cookies(), await params, await searchParams);
  const props = await getData(context);
  return renderPublicEventPage(props);
};

export const generateMetadata = async (): Promise<Metadata> => {
  return {
    robots: {
      follow: false,
      index: false,
    },
  };
};

export default ServerPage;
