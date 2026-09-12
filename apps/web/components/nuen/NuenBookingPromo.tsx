"use client";

import { useLocale } from "@calcom/lib/hooks/useLocale";
import { Logo } from "@calcom/ui/components/logo/Logo";

export const NuenBookingPromo = (): JSX.Element => {
  const { t } = useLocale();

  return (
    <section
      data-testid="nuen-booking-promo"
      className="dark relative z-10 mx-auto w-full max-w-7xl px-5 pt-2 pb-8 sm:px-8 sm:pb-10">
      <Logo inline={false} className="block [&_img]:h-5" />
      <div className="mx-auto mt-12 max-w-6xl text-center sm:mt-16">
        <p
          data-testid="nuen-booking-promo-headline"
          className="font-semibold text-[clamp(1rem,4.5vw,3.75rem)] leading-[1.08] tracking-[-0.035em]">
          <span data-testid="nuen-booking-promo-headline-lead" className="block whitespace-nowrap text-white">
            {t("nuen_booking_promo_headline_lead")}
          </span>{" "}
          <span
            data-testid="nuen-booking-promo-headline-accent"
            className="nuen-gradient-text block whitespace-nowrap">
            {t("nuen_booking_promo_headline_accent")}
          </span>
        </p>
      </div>
    </section>
  );
};
