import type React from "react";

type WoohyukmonGlassesIconProps = React.SVGProps<SVGSVGElement> & {
  title?: string;
};

export function WoohyukmonGlassesIcon({
  className,
  title = "Woohyukmon glasses icon",
  ...props
}: WoohyukmonGlassesIconProps) {
  return (
    <svg
      viewBox="0 0 240 120"
      role="img"
      aria-label={title}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <defs>
        <linearGradient id="woohyukmonLens" x1="24" x2="104" y1="31" y2="96" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#F7F4FF" />
          <stop offset="0.46" stopColor="#C9C7D8" />
          <stop offset="1" stopColor="#7E7C91" />
        </linearGradient>
        <linearGradient id="woohyukmonLensRight" x1="135" x2="218" y1="30" y2="97" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#F7F4FF" />
          <stop offset="0.44" stopColor="#D6D2E5" />
          <stop offset="1" stopColor="#827F95" />
        </linearGradient>
        <linearGradient id="woohyukmonHighlight" x1="33" x2="98" y1="38" y2="91" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.78" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0.08" />
        </linearGradient>
        <filter id="woohyukmonShadow" x="-18%" y="-28%" width="136%" height="156%" colorInterpolationFilters="sRGB">
          <feDropShadow dx="0" dy="6" stdDeviation="5" floodColor="#0B0B0F" floodOpacity="0.28" />
        </filter>
      </defs>

      <g filter="url(#woohyukmonShadow)">
        <path
          d="M29 49 62 16c5-5 11-4 15 2l16 24 7 45c1 7-4 13-11 13H38c-7 0-13-5-14-12l-6-32c-1-6 4-10 11-7Z"
          fill="url(#woohyukmonLens)"
          stroke="#101014"
          strokeWidth="8"
          strokeLinejoin="round"
        />
        <path
          d="M211 49 178 16c-5-5-11-4-15 2l-16 24-7 45c-1 7 4 13 11 13h51c7 0 13-5 14-12l6-32c1-6-4-10-11-7Z"
          fill="url(#woohyukmonLensRight)"
          stroke="#101014"
          strokeWidth="8"
          strokeLinejoin="round"
        />
        <path
          d="M95 55c15-10 35-10 50 0"
          fill="none"
          stroke="#101014"
          strokeWidth="9"
          strokeLinecap="round"
        />
        <path
          d="M69 19 48 10 21 42"
          fill="none"
          stroke="#101014"
          strokeWidth="7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M171 19 192 10l27 32"
          fill="none"
          stroke="#101014"
          strokeWidth="7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M41 50h45M34 71h60M56 35l28 50M31 86l47-44"
          fill="none"
          stroke="#4D4C59"
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.62"
        />
        <path
          d="M154 50h45M146 71h60M181 35l-28 50M209 86l-47-44"
          fill="none"
          stroke="#4D4C59"
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.62"
        />
        <path
          d="M26 54c8-5 21-7 37-6 16 0 26 3 31 8l3 17c-19-10-43-11-69-2l-2-17Z"
          fill="url(#woohyukmonHighlight)"
          opacity="0.58"
        />
        <path
          d="M214 54c-8-5-21-7-37-6-16 0-26 3-31 8l-3 17c19-10 43-11 69-2l2-17Z"
          fill="url(#woohyukmonHighlight)"
          opacity="0.58"
        />
        <path
          d="M61 52 67 64l13 5-13 5-6 13-5-13-13-5 13-5 5-12Z"
          fill="#FFFFFF"
        />
        <path
          d="M176 52 182 64l13 5-13 5-6 13-5-13-13-5 13-5 5-12Z"
          fill="#FFFFFF"
        />
        <circle cx="84" cy="50" r="3" fill="#FFFFFF" opacity="0.92" />
        <circle cx="199" cy="50" r="3" fill="#FFFFFF" opacity="0.92" />
      </g>
    </svg>
  );
}
