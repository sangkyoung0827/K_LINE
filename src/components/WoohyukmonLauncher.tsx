"use client";

import type { ButtonHTMLAttributes } from "react";

export const openWoohyukmonEvent = "kline:open-woohyukmon";

export function WoohyukmonLauncher({ onClick, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" aria-haspopup="dialog" aria-controls="global-woohyukmon" title="Woohyukmon" {...props} onClick={(event) => {
    event.currentTarget.focus({ preventScroll: true });
    onClick?.(event);
    if (!event.defaultPrevented) {
      // Let the mobile menu close before the conversation takes focus.
      requestAnimationFrame(() => window.dispatchEvent(new Event(openWoohyukmonEvent)));
    }
  }}>{children}</button>;
}
