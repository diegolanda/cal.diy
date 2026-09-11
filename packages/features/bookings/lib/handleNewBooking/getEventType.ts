import { getDefaultEvent } from "@calcom/features/eventtypes/lib/defaultEvents";
import { ErrorCode } from "@calcom/lib/errorCodes";
import { ErrorWithCode } from "@calcom/lib/errors";
import { HttpError } from "@calcom/lib/http-error";
import { withReporting } from "@calcom/lib/sentryWrapper";
import { getBookingFieldsWithSystemFields } from "../getBookingFields";
import { getEventTypesFromDB } from "./getEventTypesFromDB";

const _getEventType = async ({
  eventTypeId,
  eventTypeSlug,
}: {
  eventTypeId: number;
  eventTypeSlug?: string;
}) => {
  if (!eventTypeId && !eventTypeSlug) {
    throw new HttpError({ statusCode: 400, message: "Either eventTypeId or eventTypeSlug must be provided" });
  }

  // handle dynamic user
  const eventType =
    !eventTypeId && !!eventTypeSlug ? getDefaultEvent(eventTypeSlug) : await getEventTypesFromDB(eventTypeId);

  if ("teamId" in eventType && eventType.teamId && eventType.hidden) {
    throw new ErrorWithCode(ErrorCode.EventTypeNotFound, "Event type not found");
  }

  const isOrgTeamEvent = !!eventType?.team && !!eventType?.team?.parentId;

  return {
    ...eventType,
    bookingFields: getBookingFieldsWithSystemFields({ ...eventType, isOrgTeamEvent }),
  };
};

export const getEventType = withReporting(_getEventType, "getEventType");
