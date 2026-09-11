"use client";

import type { EventTypeSetupProps, FormValues, Host } from "@calcom/features/eventtypes/lib/types";
import { useLocale } from "@calcom/lib/hooks/useLocale";
import { Avatar } from "@calcom/ui/components/avatar";
import { Controller, useFormContext } from "react-hook-form";

type TeamMember = Pick<
  EventTypeSetupProps["teamMembers"][number],
  "avatar" | "defaultScheduleId" | "email" | "id" | "name"
>;

type Props = {
  team: Pick<NonNullable<EventTypeSetupProps["team"]>, "id"> | null;
  teamMembers: TeamMember[];
};

type EventTeamAssignmentTabCustomClassNames = Record<string, unknown>;

const updateRoundRobinHosts = ({
  hosts,
  member,
  selected,
}: {
  hosts: Host[];
  member: TeamMember;
  selected: boolean;
}): Host[] => {
  if (!selected) return hosts.filter((host) => host.userId !== member.id);
  if (hosts.some((host) => host.userId === member.id)) return hosts;

  return [
    ...hosts,
    {
      userId: member.id,
      isFixed: false,
      priority: 2,
      weight: 100,
      scheduleId: member.defaultScheduleId,
      groupId: null,
    },
  ];
};

const EventTeamAssignmentTab = ({ team, teamMembers }: Props) => {
  const { t } = useLocale();
  const { control } = useFormContext<FormValues>();

  if (!team) return null;

  return (
    <div className="rounded-md border border-subtle bg-default">
      <div className="border-subtle border-b px-6 py-5">
        <h2 className="font-semibold text-base text-emphasis">{t("round_robin_hosts")}</h2>
        <p className="mt-1 text-sm text-subtle">{t("hosts_schedule_description")}</p>
      </div>

      <Controller
        control={control}
        name="hosts"
        render={({ field }) => {
          const hosts = field.value ?? [];
          const selectedHostIds = new Set(hosts.map((host) => host.userId));

          return teamMembers.length > 0 ? (
            <ul className="divide-y divide-subtle px-6">
              {teamMembers.map((member) => {
                const inputId = `round-robin-host-${team.id}-${member.id}`;

                return (
                  <li key={member.id} className="flex items-center gap-3 py-4">
                    <input
                      className="h-4 w-4 rounded-[4px] border-default bg-default checked:bg-brand-default"
                      id={inputId}
                      type="checkbox"
                      checked={selectedHostIds.has(member.id)}
                      onChange={(event) => {
                        field.onChange(
                          updateRoundRobinHosts({ hosts, member, selected: event.target.checked })
                        );
                      }}
                    />
                    <Avatar size="sm" imageSrc={member.avatar} alt={member.name ?? member.email} />
                    <label htmlFor={inputId} className="min-w-0 cursor-pointer">
                      <span className="block truncate font-medium text-emphasis text-sm">
                        {member.name ?? member.email}
                      </span>
                      {member.name ? (
                        <span className="block truncate text-sm text-subtle">{member.email}</span>
                      ) : null}
                    </label>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="px-6 py-5 text-sm text-subtle">{t("no_assigned_members")}</p>
          );
        }}
      />
    </div>
  );
};

export type { EventTeamAssignmentTabCustomClassNames };
export { updateRoundRobinHosts };
export default EventTeamAssignmentTab;
