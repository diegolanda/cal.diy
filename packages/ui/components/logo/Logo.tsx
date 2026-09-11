import classNames from "@calcom/ui/classNames";
import type { ReactElement, ReactNode } from "react";

export function Logo({
  small,
  icon,
  inline = true,
  className,
  src = "/api/logo",
  darkSrc,
}: {
  small?: boolean;
  icon?: boolean;
  inline?: boolean;
  className?: string;
  src?: string;
  darkSrc?: string;
}): ReactElement {
  const wordmarkClassName = small ? "h-4 w-auto" : "h-5 w-auto";
  let resolvedDarkSrc = darkSrc;
  if (!resolvedDarkSrc && src === "/api/logo") resolvedDarkSrc = "/nuen-wordmark-dark.svg";

  let content: ReactNode;
  if (icon) {
    content = <img aria-hidden="true" className="mx-auto w-9" alt="" src={`${src}?type=icon`} />;
  } else if (resolvedDarkSrc) {
    content = (
      <>
        <img aria-hidden="true" className={classNames(wordmarkClassName, "dark:hidden")} alt="" src={src} />
        <img
          aria-hidden="true"
          className={classNames(wordmarkClassName, "hidden dark:block")}
          alt=""
          src={resolvedDarkSrc}
        />
      </>
    );
  } else {
    content = <img aria-hidden="true" className={wordmarkClassName} alt="" src={src} />;
  }

  return (
    <span
      role="img"
      aria-label="Nuen"
      title="Nuen"
      className={classNames("logo", inline && "inline", className)}>
      {content}
    </span>
  );
}
