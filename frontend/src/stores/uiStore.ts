/**
 * Zustand store for UI-related state.
 *
 * Manages loading states, animations, and navigation.
 */

import { create } from "zustand";

interface UIState {
  // Loading states
  isGenerating: boolean;
  isAnalyzing: boolean;

  // Current page (for navigation tracking)
  currentPage: string;

  // Combo display
  showComboEffect: boolean;

  // Mascot mood
  mascotMood: "normal" | "thinking" | "happy" | "sad" | "encouraging";
}

interface UIActions {
  setGenerating: (val: boolean) => void;
  setAnalyzing: (val: boolean) => void;
  setCurrentPage: (page: string) => void;
  triggerComboEffect: () => void;
  setMascotMood: (mood: UIState["mascotMood"]) => void;
}

export const useUIStore = create<UIState & UIActions>((set) => ({
  // Initial state
  isGenerating: false,
  isAnalyzing: false,
  currentPage: "index",
  showComboEffect: false,
  mascotMood: "normal",

  // Actions
  setGenerating: (val) => set({ isGenerating: val }),
  setAnalyzing: (val) => set({ isAnalyzing: val }),
  setCurrentPage: (page) => set({ currentPage: page }),

  triggerComboEffect: () => {
    set({ showComboEffect: true });
    setTimeout(() => set({ showComboEffect: false }), 1500);
  },

  setMascotMood: (mood) => set({ mascotMood: mood }),
}));
