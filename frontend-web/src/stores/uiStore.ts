import { create } from "zustand";

interface UIState {
  isGenerating: boolean;
  isAnalyzing: boolean;
  mascotMood: "normal" | "thinking" | "happy" | "sad" | "encouraging";
}

interface UIActions {
  setGenerating: (val: boolean) => void;
  setAnalyzing: (val: boolean) => void;
  setMascotMood: (mood: UIState["mascotMood"]) => void;
}

export const useUIStore = create<UIState & UIActions>((set) => ({
  isGenerating: false,
  isAnalyzing: false,
  mascotMood: "normal",

  setGenerating: (val) => set({ isGenerating: val }),
  setAnalyzing: (val) => set({ isAnalyzing: val }),
  setMascotMood: (mood) => set({ mascotMood: mood }),
}));
