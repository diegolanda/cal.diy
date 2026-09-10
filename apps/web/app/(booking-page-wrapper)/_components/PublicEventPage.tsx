import { loadTranslations } from "@calcom/i18n/server";
import { WEBAPP_URL } from "@calcom/lib/constants";
import { generateMeetingMetadata } from "app/_utils";
import { CustomI18nProvider } from "app/CustomI18nProvider";
import type { Metadata } from "next";
import type { PageProps } from "~/users/views/users-type-public-view";
import LegacyPage from "~/users/views/users-type-public-view";

export async function renderPublicEventPage(props: PageProps): Promise<JSX.Element> {
  const locale = props.eventData?.interfaceLanguage;
  if (!locale) return <LegacyPage {...props} />;

  const ns = "common";
  const translations = await loadTranslations(locale, ns);
  return (
    <CustomI18nProvider translations={translations} locale={locale} ns={ns}>
      <LegacyPage {...props} />
    </CustomI18nProvider>
  );
}

export async function generatePublicEventMetadata({
  props,
  canonicalPath,
}: {
  props: PageProps;
  canonicalPath: string;
}): Promise<Metadata> {
  const { booking, isSEOIndexable = true, eventData, isBrandingHidden } = props;
  const rescheduleUid = booking?.uid;
  const profileName = eventData?.profile?.name ?? "";
  const title = eventData?.title ?? "";
  const meeting = {
    title,
    profile: { name: profileName, image: eventData?.profile.image },
    users:
      eventData?.subsetOfUsers.map((user) => ({
        name: `${user.name}`,
        username: `${user.username}`,
      })) || [],
  };
  const metadata = await generateMeetingMetadata(
    meeting,
    (t) => `${rescheduleUid && booking ? t("reschedule") : ""} ${title} | ${profileName}`,
    (t) => `${rescheduleUid ? t("reschedule") : ""} ${title}`,
    isBrandingHidden,
    WEBAPP_URL,
    canonicalPath
  );

  return {
    ...metadata,
    robots: {
      follow: !(eventData?.hidden || !isSEOIndexable),
      index: !(eventData?.hidden || !isSEOIndexable),
    },
  };
}
