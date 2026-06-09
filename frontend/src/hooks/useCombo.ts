/**
 * React Hook for combo (连续答对) tracking and animation triggering.
 */

import { useCallback } from "react";
import { useQuizStore } from "../stores/quizStore";
import { useUIStore } from "../stores/uiStore";

export function useCombo() {
  const combo = useQuizStore((s) => s.session.combo);
  const maxCombo = useQuizStore((s) => s.session.max_combo);
  const triggerComboEffect = useUIStore((s) => s.triggerComboEffect);

  /**
   * Check and trigger combo effect at milestones.
   */
  const checkCombo = useCallback(() => {
    if (combo > 0 && combo % 3 === 0) {
      triggerComboEffect();
    }
  }, [combo, triggerComboEffect]);

  /**
   * Get combo milestone label.
   */
  const getComboLabel = useCallback((): string | null => {
    if (combo >= 10) return `🔥 超级连击 ×${combo}`;
    if (combo >= 7) return `⚡ 连击 ×${combo}`;
    if (combo >= 5) return `✨ 连击 ×${combo}`;
    if (combo >= 3) return `💪 连击 ×${combo}`;
    return null;
  }, [combo]);

  return {
    combo,
    maxCombo,
    comboLabel: getComboLabel(),
    checkCombo,
  };
}
