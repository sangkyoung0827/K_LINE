"use client";

import { forwardRef, useImperativeHandle, useLayoutEffect, useRef, type TextareaHTMLAttributes } from "react";

type Props = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "value"> & { value: string };

export function shouldSubmitPrompt(event: Pick<KeyboardEvent, "key" | "shiftKey" | "isComposing" | "keyCode">) {
  return event.key === "Enter" && !event.shiftKey && !event.isComposing && event.keyCode !== 229;
}

export const WoohyukmonPromptInput = forwardRef<HTMLTextAreaElement, Props>(function WoohyukmonPromptInput(
  { value, onKeyDown, style, ...props }, forwardedRef
) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  useImperativeHandle(forwardedRef, () => textareaRef.current!, []);

  function resize() {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    const computed = getComputedStyle(textarea);
    const border = parseFloat(computed.borderTopWidth) + parseFloat(computed.borderBottomWidth);
    textarea.style.height = `${textarea.scrollHeight + border}px`;
  }

  useLayoutEffect(resize, [value]);
  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    let width = textarea.clientWidth;
    // Observe width only: changing our own height must not cause a resize loop.
    const observer = new ResizeObserver(() => {
      if (textarea.clientWidth === width) return;
      width = textarea.clientWidth;
      resize();
    });
    observer.observe(textarea);
    return () => observer.disconnect();
  }, []);

  return <textarea
    {...props}
    ref={textareaRef}
    value={value}
    rows={1}
    wrap="soft"
    style={{ ...style, boxSizing: "border-box", resize: "none", maxHeight: "min(320px, 45dvh)", overflowY: "auto", overflowX: "hidden", whiteSpace: "pre-wrap", overflowWrap: "anywhere", wordBreak: "break-word" }}
    onKeyDown={(event) => {
      onKeyDown?.(event);
      if (!event.defaultPrevented && shouldSubmitPrompt(event.nativeEvent)) {
        event.preventDefault();
        event.currentTarget.form?.requestSubmit();
      }
    }}
  />;
});
