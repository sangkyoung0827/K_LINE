import type React from "react";

type WoohyukmonGlassesIconProps = Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src">;

export function WoohyukmonGlassesIcon({
  className,
  title = "Woohyukmon glasses icon",
  alt,
  draggable = false,
  ...props
}: WoohyukmonGlassesIconProps) {
  return (
    <img
      src="/images/woohyukmon-icon.png"
      alt={alt ?? title}
      title={title}
      draggable={draggable}
      className={`object-contain ${className ?? ""}`.trim()}
      {...props}
    />
  );
}
