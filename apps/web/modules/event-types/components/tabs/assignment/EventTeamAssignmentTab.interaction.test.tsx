import type { FormValues, Host } from "@calcom/features/eventtypes/lib/types";
import { fireEvent, render, screen } from "@testing-library/react";
import { FormProvider, useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";
import EventTeamAssignmentTab from "./EventTeamAssignmentTab";

vi.mock("@calcom/lib/hooks/useLocale", () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

const ada = {
  id: 7,
  name: "Ada Lovelace",
  email: "ada@nuen.io",
  avatar: "",
  defaultScheduleId: 12,
};

const grace = {
  id: 8,
  name: "Grace Hopper",
  email: "grace@nuen.io",
  avatar: "",
  defaultScheduleId: 13,
};

const configuredHost: Host = {
  userId: 7,
  isFixed: false,
  priority: 4,
  weight: 50,
  scheduleId: 20,
  groupId: null,
};

const otherHost: Host = {
  userId: 8,
  isFixed: false,
  priority: 2,
  weight: 100,
  scheduleId: 13,
  groupId: null,
};

const AssignmentForm = ({ hosts, onRead }: { hosts: Host[]; onRead: (hosts: Host[]) => void }) => {
  const form = useForm<FormValues>({ defaultValues: { hosts } });

  return (
    <FormProvider {...form}>
      <EventTeamAssignmentTab team={{ id: 42 }} teamMembers={[ada, grace]} />
      <button type="button" onClick={() => onRead(form.getValues("hosts"))}>
        Read hosts
      </button>
    </FormProvider>
  );
};

describe("EventTeamAssignmentTab", () => {
  it("preserves host settings through a deselect and reselect interaction", () => {
    const onRead = vi.fn();
    render(<AssignmentForm hosts={[configuredHost, otherHost]} onRead={onRead} />);

    fireEvent.click(screen.getByRole("checkbox", { name: /Ada Lovelace/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Ada Lovelace/ }));
    fireEvent.click(screen.getByRole("button", { name: "Read hosts" }));

    expect(onRead).toHaveBeenCalledWith([otherHost, configuredHost]);
  });

  it("keeps the final host selected and explains the requirement", () => {
    render(<AssignmentForm hosts={[configuredHost]} onRead={vi.fn()} />);

    expect(screen.getByRole("checkbox", { name: /Ada Lovelace/ })).toBeDisabled();
    expect(screen.getByText("at_least_one_round_robin_host")).toBeInTheDocument();
  });
});
