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
      viewBox="0 0 420 250"
      role="img"
      aria-label={title}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid meet"
      {...props}
    >
      <defs>
        <linearGradient id="woohyukmonLensLeft" x1="82" x2="190" y1="96" y2="183" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fbf9ff" />
          <stop offset="0.32" stopColor="#d6d1db" />
          <stop offset="0.67" stopColor="#b7b1bf" />
          <stop offset="1" stopColor="#817b8b" />
        </linearGradient>
        <linearGradient id="woohyukmonLensRight" x1="240" x2="352" y1="94" y2="184" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fbf9ff" />
          <stop offset="0.34" stopColor="#ddd8e2" />
          <stop offset="0.7" stopColor="#b7b1bf" />
          <stop offset="1" stopColor="#817b8b" />
        </linearGradient>
        <linearGradient id="woohyukmonFrame" x1="70" x2="350" y1="40" y2="202" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#3b3b42" />
          <stop offset="0.22" stopColor="#07080b" />
          <stop offset="0.5" stopColor="#1b1d22" />
          <stop offset="0.78" stopColor="#050507" />
          <stop offset="1" stopColor="#34343a" />
        </linearGradient>
        <radialGradient id="woohyukmonSpark" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.45" stopColor="#ffffff" stopOpacity="0.96" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <filter id="woohyukmonDrop" x="-15%" y="-28%" width="130%" height="156%" colorInterpolationFilters="sRGB">
          <feDropShadow dx="0" dy="7" stdDeviation="5" floodColor="#040406" floodOpacity="0.34" />
        </filter>
      </defs>

      <g filter="url(#woohyukmonDrop)">
        <path
          d="M79 95 144 36c9-8 19-7 27 3l49 61-11 76c-3 19-16 31-36 31h-69c-18 0-31-9-36-26L56 132c-5-20 3-34 23-37Z"
          fill="url(#woohyukmonFrame)"
        />
        <path
          d="M341 95 276 36c-9-8-19-7-27 3l-49 61 11 76c3 19 16 31 36 31h69c18 0 31-9 36-26l12-49c5-20-3-34-23-37Z"
          fill="url(#woohyukmonFrame)"
        />

        <path
          d="M91 111 154 57l42 53-9 55c-2 13-11 21-25 21h-47c-13 0-22-7-26-19l-10-38c-2-9 2-16 12-18Z"
          fill="url(#woohyukmonLensLeft)"
          stroke="#0a0b0e"
          strokeWidth="6"
          strokeLinejoin="round"
        />
        <path
          d="M329 111 266 57l-42 53 9 55c2 13 11 21 25 21h47c13 0 22-7 26-19l10-38c2-9-2-16-12-18Z"
          fill="url(#woohyukmonLensRight)"
          stroke="#0a0b0e"
          strokeWidth="6"
          strokeLinejoin="round"
        />

        <path
          d="M200 113c7-5 13-7 20-7s13 2 20 7"
          fill="none"
          stroke="#050507"
          strokeWidth="12"
          strokeLinecap="round"
        />
        <rect x="197" y="110" width="46" height="20" rx="8" fill="#f8f8f5" stroke="#0a0b0e" strokeWidth="6" />

        <path
          d="M121 92 156 39 196 95"
          fill="none"
          stroke="#050507"
          strokeWidth="14"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M299 92 264 39 224 95"
          fill="none"
          stroke="#050507"
          strokeWidth="14"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M128 91 158 47M139 92 168 57"
          fill="none"
          stroke="#f4f2f5"
          strokeWidth="3.5"
          strokeLinecap="round"
          opacity="0.82"
        />
        <path
          d="M292 91 262 47M281 92 252 57"
          fill="none"
          stroke="#f4f2f5"
          strokeWidth="3.5"
          strokeLinecap="round"
          opacity="0.82"
        />

        <path
          d="M78 111h-18c-8 0-13 5-13 14v14c0 11 7 18 18 20l15 3"
          fill="none"
          stroke="#050507"
          strokeWidth="13"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M342 111h18c8 0 13 5 13 14v14c0 11-7 18-18 20l-15 3"
          fill="none"
          stroke="#050507"
          strokeWidth="13"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M58 123c0 16 6 22 21 25" fill="none" stroke="#f1eff3" strokeWidth="5" strokeLinecap="round" opacity="0.75" />
        <path d="M362 123c0 16-6 22-21 25" fill="none" stroke="#f1eff3" strokeWidth="5" strokeLinecap="round" opacity="0.75" />

        <path
          d="M100 128c24-9 54-13 91-9M91 160c27-18 59-30 99-37M124 101l63 68M87 142l34 40"
          fill="none"
          stroke="#686471"
          strokeWidth="4"
          strokeLinecap="round"
          opacity="0.58"
        />
        <path
          d="M320 128c-24-9-54-13-91-9M329 160c-27-18-59-30-99-37M296 101l-63 68M333 142l-34 40"
          fill="none"
          stroke="#686471"
          strokeWidth="4"
          strokeLinecap="round"
          opacity="0.58"
        />

        <path
          d="M128 123c9-6 23-9 41-7 12 1 22 4 30 9l-6 28c-34-20-69-16-101 10l-6-23c9-7 23-12 42-17Z"
          fill="#ffffff"
          opacity="0.22"
        />
        <path
          d="M292 123c-9-6-23-9-41-7-12 1-22 4-30 9l6 28c34-20 69-16 101 10l6-23c-9-7-23-12-42-17Z"
          fill="#ffffff"
          opacity="0.22"
        />

        <ellipse cx="136" cy="144" rx="32" ry="18" fill="url(#woohyukmonSpark)" opacity="0.55" />
        <ellipse cx="284" cy="144" rx="34" ry="18" fill="url(#woohyukmonSpark)" opacity="0.55" />
        <path d="M143 122 151 139l18 7-18 7-8 18-7-18-18-7 18-7 7-17Z" fill="#ffffff" />
        <path d="M280 119 289 138l20 8-20 8-9 20-8-20-20-8 20-8 8-19Z" fill="#ffffff" />
        <circle cx="171" cy="120" r="4" fill="#ffffff" opacity="0.92" />
        <circle cx="310" cy="120" r="4" fill="#ffffff" opacity="0.92" />

        <path
          d="M82 103c25 16 77 16 114 5M224 108c37 11 89 11 114-5"
          fill="none"
          stroke="#ffffff"
          strokeWidth="4"
          strokeLinecap="round"
          opacity="0.45"
        />
      </g>
    </svg>
  );
}
