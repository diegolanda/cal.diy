"use client";

import { useLocale } from "@calcom/lib/hooks/useLocale";
import { MembershipRole } from "@calcom/prisma/enums";
import type { RouterOutputs } from "@calcom/trpc/react";
import { trpc } from "@calcom/trpc/react";
import { Button } from "@calcom/ui/components/button";
import { TextField } from "@calcom/ui/components/form/inputs/TextField";
import { showToast } from "@calcom/ui/components/toast";
import type { ReactElement } from "react";
import { useState } from "react";

type TeamMembership = RouterOutputs["viewer"]["teams"]["list"][number];

const canManage = (role: TeamMembership["role"]): boolean =>
  role === MembershipRole.OWNER || role === MembershipRole.ADMIN;

const parseMembershipRole = (value: string): MembershipRole => {
  if (value === MembershipRole.OWNER) return MembershipRole.OWNER;
  if (value === MembershipRole.ADMIN) return MembershipRole.ADMIN;
  return MembershipRole.MEMBER;
};

function TeamCard({ membership }: { membership: TeamMembership }): ReactElement {
  const { t } = useLocale();
  const utils = trpc.useUtils();
  const [name, setName] = useState(membership.team.name);
  const [slug, setSlug] = useState(membership.team.slug ?? "");
  const [bio, setBio] = useState(membership.team.bio ?? "");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<typeof MembershipRole.MEMBER | typeof MembershipRole.ADMIN>(
    MembershipRole.MEMBER
  );
  const isManager = canManage(membership.role);

  const refreshTeams = async (): Promise<void> => {
    await utils.viewer.teams.list.invalidate();
  };
  const updateTeam = trpc.viewer.teams.update.useMutation({
    onSuccess: async () => {
      showToast(t("team_updated_successfully"), "success");
      await refreshTeams();
    },
    onError: (error) => showToast(error.message, "error"),
  });
  const addMember = trpc.viewer.teams.addMember.useMutation({
    onSuccess: async () => {
      setEmail("");
      showToast(t("team_member_added_successfully"), "success");
      await refreshTeams();
    },
    onError: (error) => showToast(error.message, "error"),
  });
  const removeMember = trpc.viewer.teams.removeMember.useMutation({
    onSuccess: async () => {
      showToast(t("team_member_removed_successfully"), "success");
      await refreshTeams();
    },
    onError: (error) => showToast(error.message, "error"),
  });
  const updateMemberRole = trpc.viewer.teams.updateMemberRole.useMutation({
    onSuccess: async () => {
      showToast(t("team_member_role_updated_successfully"), "success");
      await refreshTeams();
    },
    onError: (error) => showToast(error.message, "error"),
  });

  return (
    <section className="border-subtle bg-default rounded-2xl border p-5 shadow-sm">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <h2 className="text-emphasis text-lg font-semibold">{membership.team.name}</h2>
          {membership.team.slug && <p className="text-subtle text-sm">/team/{membership.team.slug}</p>}
        </div>
        <span className="bg-muted text-subtle rounded-full px-3 py-1 text-xs font-medium">
          {t(membership.role.toLowerCase())}
        </span>
      </div>

      {isManager && (
        <form
          className="mt-5 grid gap-3 md:grid-cols-3"
          onSubmit={(event) => {
            event.preventDefault();
            updateTeam.mutate({ teamId: membership.team.id, name, slug, bio: bio || null });
          }}>
          <TextField label={t("team_name")} value={name} onChange={(event) => setName(event.target.value)} />
          <TextField label={t("team_slug")} value={slug} onChange={(event) => setSlug(event.target.value)} />
          <TextField label={t("team_bio")} value={bio} onChange={(event) => setBio(event.target.value)} />
          <div className="md:col-span-3">
            <Button type="submit" loading={updateTeam.isPending} disabled={!name.trim() || !slug.trim()}>
              {t("save")}
            </Button>
          </div>
        </form>
      )}

      <div className="mt-6">
        <h3 className="text-emphasis text-sm font-semibold">{t("team_members")}</h3>
        <ul className="divide-subtle mt-2 divide-y">
          {membership.team.members.map((member) => (
            <li className="flex items-center justify-between gap-4 py-3" key={member.id}>
              <div className="min-w-0">
                <p className="text-default truncate text-sm font-medium">
                  {member.user.name ?? member.user.email}
                </p>
                <p className="text-subtle truncate text-xs">{member.user.email}</p>
              </div>
              <div className="flex items-center gap-2">
                {isManager ? (
                  <select
                    aria-label={t("role")}
                    className="border-default bg-default h-8 rounded-md border px-2 text-xs"
                    disabled={updateMemberRole.isPending}
                    value={member.role}
                    onChange={(event) =>
                      updateMemberRole.mutate({
                        teamId: membership.team.id,
                        membershipId: member.id,
                        role: parseMembershipRole(event.target.value),
                      })
                    }>
                    <option value={MembershipRole.MEMBER}>{t("member")}</option>
                    <option value={MembershipRole.ADMIN}>{t("admin")}</option>
                    {membership.role === MembershipRole.OWNER && (
                      <option value={MembershipRole.OWNER}>{t("owner")}</option>
                    )}
                  </select>
                ) : (
                  <span className="text-subtle text-xs">{t(member.role.toLowerCase())}</span>
                )}
                {isManager && (
                  <Button
                    type="button"
                    color="destructive"
                    size="sm"
                    loading={removeMember.isPending && removeMember.variables?.membershipId === member.id}
                    onClick={() =>
                      removeMember.mutate({ teamId: membership.team.id, membershipId: member.id })
                    }>
                    {t("remove")}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>

      {isManager && (
        <form
          className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            addMember.mutate({ teamId: membership.team.id, email, role });
          }}>
          <TextField
            containerClassName="flex-1"
            label={t("email_address")}
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <label className="text-default flex flex-col gap-1 text-sm font-medium">
            {t("role")}
            <select
              className="border-default bg-default h-9 rounded-md border px-3 text-sm"
              value={role}
              onChange={(event) =>
                setRole(
                  event.target.value === MembershipRole.ADMIN ? MembershipRole.ADMIN : MembershipRole.MEMBER
                )
              }>
              <option value={MembershipRole.MEMBER}>{t("member")}</option>
              <option value={MembershipRole.ADMIN}>{t("admin")}</option>
            </select>
          </label>
          <Button type="submit" loading={addMember.isPending} disabled={!email.trim()}>
            {t("add_team_member")}
          </Button>
        </form>
      )}
    </section>
  );
}

export default function TeamManagementView({ canCreateTeams }: { canCreateTeams: boolean }): ReactElement {
  const { t } = useLocale();
  const utils = trpc.useUtils();
  const { data: memberships, isPending } = trpc.viewer.teams.list.useQuery();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");

  const createTeam = trpc.viewer.teams.create.useMutation({
    onSuccess: async () => {
      setName("");
      setSlug("");
      showToast(t("team_created_successfully"), "success");
      await utils.viewer.teams.list.invalidate();
    },
    onError: (error) => showToast(error.message, "error"),
  });

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 px-4 py-6 sm:px-6">
      {canCreateTeams && (
        <form
          className="border-subtle bg-default grid gap-3 rounded-2xl border p-5 shadow-sm sm:grid-cols-[1fr_1fr_auto] sm:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            createTeam.mutate({ name, slug, bio: null });
          }}>
          <TextField label={t("team_name")} value={name} onChange={(event) => setName(event.target.value)} />
          <TextField label={t("team_slug")} value={slug} onChange={(event) => setSlug(event.target.value)} />
          <Button type="submit" loading={createTeam.isPending} disabled={!name.trim() || !slug.trim()}>
            {t("create_team")}
          </Button>
        </form>
      )}

      {isPending && <p className="text-subtle text-sm">{t("loading")}</p>}
      {!isPending && memberships?.length === 0 && (
        <div className="border-subtle bg-default rounded-2xl border p-8 text-center">
          <h2 className="text-emphasis font-semibold">{t("no_teams")}</h2>
          <p className="text-subtle mt-1 text-sm">{t("no_teams_description")}</p>
        </div>
      )}
      {memberships?.map((membership) => (
        <TeamCard key={membership.id} membership={membership} />
      ))}
    </div>
  );
}
