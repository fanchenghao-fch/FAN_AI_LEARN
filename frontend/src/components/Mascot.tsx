/**
 * Mascot Component — 灯灯 (DengDeng) AI Learning Companion
 *
 * Supports multiple moods: normal, thinking, happy, sad, encouraging.
 * Renders SVG as base64 data URI via Image component (WeChat Mini Program compatible).
 */

import { useMemo } from "react";
import { Image } from "@tarojs/components";

interface MascotProps {
  mood?: "normal" | "thinking" | "happy" | "sad" | "encouraging";
  size?: number;
  className?: string;
}

/** Encode an SVG string to a data URI — uses minimal encoding for mini program compat */
function svgToDataUri(svg: string): string {
  // Use encodeURIComponent directly; Taro polyfills this for mini programs.
  // Avoids btoa/unescape which may not be available in all runtimes.
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** Shared SVG defs (glow gradient) */
const SVG_DEFS = `
  <defs>
    <radialGradient id="glow" cx="50%" cy="30%" r="50%">
      <stop offset="0%" stop-color="#FEF3C7" stop-opacity="0.5"/>
      <stop offset="100%" stop-color="#FEF3C7" stop-opacity="0"/>
    </radialGradient>
  </defs>
`;

/** Shared body + features (everything that doesn't change with mood) */
const SVG_BODY = `
  <!-- Glow -->
  <circle cx="50" cy="42" r="46" fill="url(#glow)"/>

  <!-- Body — Golden/Yellow -->
  <path d="M50 4 C28 4 12 24 16 46 C18 58 24 66 24 72 L24 78 L76 78 L76 72 C76 66 82 58 84 46 C88 24 72 4 50 4Z"
        fill="#FBBF24" stroke="#1E1E1E" stroke-width="3" stroke-linejoin="round"/>

  <!-- Belly highlight -->
  <ellipse cx="44" cy="36" rx="14" ry="18" fill="#FDE68A" opacity="0.5"/>

  <!-- Shelf/Table -->
  <rect x="30" y="78" width="40" height="14" rx="3" fill="#9CA3AF" stroke="#1E1E1E" stroke-width="3"/>
  <line x1="34" y1="82" x2="66" y2="82" stroke="#1E1E1E" stroke-width="1.5" opacity="0.3"/>
  <line x1="34" y1="86" x2="66" y2="86" stroke="#1E1E1E" stroke-width="1.5" opacity="0.3"/>

  <!-- Left Eye -->
  <ellipse cx="36" cy="42" rx="10" ry="12" fill="white" stroke="#1E1E1E" stroke-width="2.5"/>
  <circle cx="38" cy="44" r="4" fill="#1E1E1E"/>
  <circle cx="37" cy="42" r="1.5" fill="white"/>

  <!-- Right Eye -->
  <ellipse cx="60" cy="40" rx="10" ry="12" fill="white" stroke="#1E1E1E" stroke-width="2.5"/>
  <circle cx="62" cy="42" r="4" fill="#1E1E1E"/>
  <circle cx="61" cy="40" r="1.5" fill="white"/>

  <!-- Cheek blush -->
  <circle cx="28" cy="54" r="4" fill="#FCA5A5" opacity="0.35"/>
  <circle cx="72" cy="54" r="4" fill="#FCA5A5" opacity="0.35"/>

  <!-- Feet -->
  <ellipse cx="38" cy="92" rx="9" ry="4.5" fill="#FBBF24" stroke="#1E1E1E" stroke-width="2.5"/>
  <ellipse cx="62" cy="92" rx="9" ry="4.5" fill="#FBBF24" stroke="#1E1E1E" stroke-width="2.5"/>
`;

/** Eyebrows for each mood */
const EYEBROWS: Record<string, string> = {
  normal: `
    <path d="M28 32 Q36 28 44 32" fill="none" stroke="#1E1E1E" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M56 30 Q64 26 72 32" fill="none" stroke="#1E1E1E" stroke-width="2.5" stroke-linecap="round"/>
  `,
  thinking: `
    <path d="M28 34 L44 30" fill="none" stroke="#1E1E1E" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M56 28 L72 34" fill="none" stroke="#1E1E1E" stroke-width="2.5" stroke-linecap="round"/>
  `,
  happy: `
    <path d="M28 28 Q36 22 44 26" fill="none" stroke="#1E1E1E" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M56 26 Q64 22 72 28" fill="none" stroke="#1E1E1E" stroke-width="2.5" stroke-linecap="round"/>
  `,
  sad: `
    <path d="M28 34 Q36 38 44 34" fill="none" stroke="#1E1E1E" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M56 34 Q64 38 72 34" fill="none" stroke="#1E1E1E" stroke-width="2.5" stroke-linecap="round"/>
  `,
  encouraging: `
    <path d="M28 34 Q36 28 44 34" fill="none" stroke="#1E1E1E" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M56 34 Q64 28 72 34" fill="none" stroke="#1E1E1E" stroke-width="2.5" stroke-linecap="round"/>
  `,
};

/** Mouth for each mood */
const MOUTH: Record<string, string> = {
  normal: `
    <path d="M44 60 Q50 66 56 60" fill="none" stroke="#1E1E1E" stroke-width="2.5" stroke-linecap="round"/>
  `,
  thinking: `
    <path d="M44 62 L48 58 L52 62 L56 58" fill="none" stroke="#1E1E1E" stroke-width="2.5"
          stroke-linecap="round" stroke-linejoin="round"/>
  `,
  happy: `
    <path d="M42 58 Q50 72 58 58" fill="none" stroke="#1E1E1E" stroke-width="2.5" stroke-linecap="round"/>
  `,
  sad: `
    <path d="M44 64 Q50 58 56 64" fill="none" stroke="#1E1E1E" stroke-width="2.5" stroke-linecap="round"/>
  `,
  encouraging: `
    <ellipse cx="50" cy="62" rx="7" ry="4" fill="#1E1E1E"/>
  `,
};

/** Sweat drop extras for thinking mode */
const EXTRAS: Record<string, string> = {
  normal: "",
  thinking: `
    <path d="M78 20 Q80 14 82 20 Q82 24 80 24 Q78 24 78 20Z"
          fill="#60A5FA" stroke="#1E1E1E" stroke-width="1.5"/>
  `,
  happy: "",
  sad: "",
  encouraging: "",
};

function generateMascotSvg(mood: string): string {
  return `<svg viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg">
${SVG_DEFS}
${SVG_BODY}
${EYEBROWS[mood] || EYEBROWS.normal}
${MOUTH[mood] || MOUTH.normal}
${EXTRAS[mood] || EXTRAS.normal}
</svg>`;
}

export default function Mascot({
  mood = "normal",
  size = 80,
  className = "",
}: MascotProps) {
  const src = useMemo(
    () => svgToDataUri(generateMascotSvg(mood)),
    [mood]
  );

  return (
    <Image
      className={`mascot-img ${className}`}
      src={src}
      style={{
        width: `${size}px`,
        height: `${size * 1.2}px`,
      }}
      mode="aspectFit"
    />
  );
}
