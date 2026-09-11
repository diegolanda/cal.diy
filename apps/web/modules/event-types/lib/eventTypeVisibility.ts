type EventTypeVisibility = {
  hidden: boolean;
  teamId: number | null;
};

export const isArchivedTeamEventType = ({ hidden, teamId }: EventTypeVisibility): boolean =>
  Boolean(teamId && hidden);

export const getEventTypeVisibilityActionKey = ({
  hidden,
  teamId,
}: EventTypeVisibility):
  | "archive_team_event"
  | "hide_from_profile"
  | "restore_team_event"
  | "show_eventtype_on_profile" => {
  if (teamId && hidden) return "restore_team_event";
  if (teamId) return "archive_team_event";
  if (hidden) return "show_eventtype_on_profile";
  return "hide_from_profile";
};

export const getEventTypeVisibilityDescriptionKey = ({
  hidden,
  teamId,
}: EventTypeVisibility):
  | "archive_team_event_description"
  | "hide_from_profile"
  | "restore_team_event_description"
  | "show_eventtype_on_profile" => {
  if (teamId && hidden) return "restore_team_event_description";
  if (teamId) return "archive_team_event_description";
  if (hidden) return "show_eventtype_on_profile";
  return "hide_from_profile";
};

export const getEventTypeVisibilityStatusKey = ({ teamId }: EventTypeVisibility): "archived" | "hidden" => {
  if (teamId) return "archived";
  return "hidden";
};
