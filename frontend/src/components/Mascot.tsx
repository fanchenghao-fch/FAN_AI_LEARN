/**
 * Mascot Component — 灯灯 (DengDeng) AI Learning Companion
 *
 * Supports multiple moods: normal, thinking, happy, encouraging.
 * SVG 100% faithful to 01-核心业务流程.html prototype.
 */

import { View } from "@tarojs/components";

interface MascotProps {
  mood?: "normal" | "thinking" | "happy" | "sad" | "encouraging";
  size?: number;
  className?: string;
}

export default function Mascot({
  mood = "normal",
  size = 80,
  className = "",
}: MascotProps) {
  const scale = size / 100;

  return (
    <View className={`mascot-wrap ${className}`} style={{ width: size, height: size * 1.2 }}>
      <svg
        className="mascot-svg"
        viewBox="0 0 100 120"
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size * 1.2}
      >
        <defs>
          <radialGradient id="glow" cx="50%" cy="30%" r="50%">
            <stop offset="0%" stopColor="#FEF3C7" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#FEF3C7" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Glow */}
        <circle cx="50" cy="42" r="46" fill="url(#glow)" />

        {/* Body — Golden/Yellow */}
        <path
          d="M50 4 C28 4 12 24 16 46 C18 58 24 66 24 72 L24 78 L76 78 L76 72 C76 66 82 58 84 46 C88 24 72 4 50 4Z"
          fill="#FBBF24"
          stroke="#1E1E1E"
          strokeWidth="3"
          strokeLinejoin="round"
        />

        {/* Belly highlight */}
        <ellipse cx="44" cy="36" rx="14" ry="18" fill="#FDE68A" opacity="0.5" />

        {/* Shelf/Table */}
        <rect x="30" y="78" width="40" height="14" rx="3" fill="#9CA3AF" stroke="#1E1E1E" strokeWidth="3" />
        <line x1="34" y1="82" x2="66" y2="82" stroke="#1E1E1E" strokeWidth="1.5" opacity="0.3" />
        <line x1="34" y1="86" x2="66" y2="86" stroke="#1E1E1E" strokeWidth="1.5" opacity="0.3" />

        {/* Left Eye */}
        <ellipse cx="36" cy="42" rx="10" ry="12" fill="white" stroke="#1E1E1E" strokeWidth="2.5" />
        <circle cx="38" cy="44" r="4" fill="#1E1E1E" />
        <circle cx="37" cy="42" r="1.5" fill="white" />

        {/* Right Eye */}
        <ellipse cx="60" cy="40" rx="10" ry="12" fill="white" stroke="#1E1E1E" strokeWidth="2.5" />
        <circle cx="62" cy="42" r="4" fill="#1E1E1E" />
        <circle cx="61" cy="40" r="1.5" fill="white" />

        {/* Eyebrows — normal */}
        {mood === "normal" && (
          <>
            <path d="M28 32 Q36 28 44 32" fill="none" stroke="#1E1E1E" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M56 30 Q64 26 72 32" fill="none" stroke="#1E1E1E" strokeWidth="2.5" strokeLinecap="round" />
          </>
        )}

        {/* Eyebrows — thinking (angled down, concentrating) */}
        {mood === "thinking" && (
          <>
            <path d="M28 34 L44 30" fill="none" stroke="#1E1E1E" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M56 28 L72 34" fill="none" stroke="#1E1E1E" strokeWidth="2.5" strokeLinecap="round" />
          </>
        )}

        {/* Eyebrows — happy (raised, excited) */}
        {mood === "happy" && (
          <>
            <path d="M28 28 Q36 22 44 26" fill="none" stroke="#1E1E1E" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M56 26 Q64 22 72 28" fill="none" stroke="#1E1E1E" strokeWidth="2.5" strokeLinecap="round" />
          </>
        )}

        {/* Eyebrows — sad */}
        {mood === "sad" && (
          <>
            <path d="M28 34 Q36 38 44 34" fill="none" stroke="#1E1E1E" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M56 34 Q64 38 72 34" fill="none" stroke="#1E1E1E" strokeWidth="2.5" strokeLinecap="round" />
          </>
        )}

        {/* Eyebrows — encouraging (determined) */}
        {mood === "encouraging" && (
          <>
            <path d="M28 34 Q36 28 44 34" fill="none" stroke="#1E1E1E" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M56 34 Q64 28 72 34" fill="none" stroke="#1E1E1E" strokeWidth="2.5" strokeLinecap="round" />
          </>
        )}

        {/* Mouth — normal smile */}
        {mood === "normal" && (
          <path d="M44 60 Q50 66 56 60" fill="none" stroke="#1E1E1E" strokeWidth="2.5" strokeLinecap="round" />
        )}

        {/* Mouth — thinking (wavy/zigzag = concentrating) */}
        {mood === "thinking" && (
          <path d="M44 62 L48 58 L52 62 L56 58" fill="none" stroke="#1E1E1E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        )}

        {/* Mouth — happy (big grin) */}
        {mood === "happy" && (
          <path d="M42 58 Q50 72 58 58" fill="none" stroke="#1E1E1E" strokeWidth="2.5" strokeLinecap="round" />
        )}

        {/* Mouth — sad (frown) */}
        {mood === "sad" && (
          <path d="M44 64 Q50 58 56 64" fill="none" stroke="#1E1E1E" strokeWidth="2.5" strokeLinecap="round" />
        )}

        {/* Mouth — encouraging (open encouragement) */}
        {mood === "encouraging" && (
          <ellipse cx="50" cy="62" rx="7" ry="4" fill="#1E1E1E" />
        )}

        {/* Cheek blush */}
        <circle cx="28" cy="54" r="4" fill="#FCA5A5" opacity="0.35" />
        <circle cx="72" cy="54" r="4" fill="#FCA5A5" opacity="0.35" />

        {/* Feet */}
        <ellipse cx="38" cy="92" rx="9" ry="4.5" fill="#FBBF24" stroke="#1E1E1E" strokeWidth="2.5" />
        <ellipse cx="62" cy="92" rx="9" ry="4.5" fill="#FBBF24" stroke="#1E1E1E" strokeWidth="2.5" />

        {/* Sweat drop (thinking mode) */}
        {mood === "thinking" && (
          <path
            d="M78 20 Q80 14 82 20 Q82 24 80 24 Q78 24 78 20Z"
            fill="#60A5FA"
            stroke="#1E1E1E"
            strokeWidth="1.5"
          />
        )}
      </svg>
    </View>
  );
}
