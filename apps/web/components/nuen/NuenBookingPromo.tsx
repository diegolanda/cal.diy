"use client";

import { useLocale } from "@calcom/lib/hooks/useLocale";
import { Logo } from "@calcom/ui/components/logo/Logo";

export const NuenBookingPromo = (): JSX.Element => {
  const { t } = useLocale();

  return (
    <section
      data-testid="nuen-booking-promo"
      className="dark relative z-10 mx-auto w-full max-w-5xl px-5 pb-8 pt-2 sm:px-8 sm:pb-10">
      <Logo inline={false} className="block [&_img]:h-5" />
      <div className="mt-12 max-w-3xl sm:mt-16">
        <p
          data-testid="nuen-booking-promo-headline"
          className="text-4xl font-semibold leading-[1.08] tracking-[-0.035em] sm:text-5xl lg:text-6xl">
          <span className="text-white">{t("nuen_booking_promo_headline_lead")} </span>
          <span className="nuen-gradient-text">{t("nuen_booking_promo_headline_accent")}</span>
        </p>
        <p className="mt-6 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
          {t("nuen_booking_promo_description")}
        </p>
      </div>
    </section>
  );
};
