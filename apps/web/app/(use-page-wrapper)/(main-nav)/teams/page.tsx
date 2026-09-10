import { getServerSession } from "@calcom/features/auth/lib/getServerSession";
import { UserPermissionRole } from "@calcom/prisma/enums";
import { buildLegacyRequest } from "@lib/buildLegacyCtx";
import { _generateMetadata, getTranslate } from "app/_utils";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactElement } from "react";
import TeamManagementView from "~/teams/TeamManagementView";

const Page = async (): Promise<ReactElement> => {
  const session = await getServerSession({ req: buildLegacyRequest(await headers(), await cookies()) });
  if (!session?.user?.id) redirect("/auth/login");

  const t = await getTranslate();
  return (
    <>
      <header className="border-subtle bg-default border-b px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <h1 className="text-emphasis text-2xl font-semibold">{t("teams")}</h1>
          <p className="text-subtle mt-1 text-sm">{t("nuen_teams_description")}</p>
        </div>
      </header>
      <TeamManagementView canCreateTeams={session.user.role === UserPermissionRole.ADMIN} />
    </>
  );
};

export const generateMetadata = async (): Promise<ReturnType<typeof _generateMetadata>> =>
  await _generateMetadata(
    (t) => t("teams"),
    (t) => t("nuen_teams_description"),
    undefined,
    undefined,
    "/teams"
  );

export default Page;
