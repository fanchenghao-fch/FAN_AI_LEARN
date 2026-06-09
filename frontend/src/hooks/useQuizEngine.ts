/**
 * React Hook: core quiz engine orchestrator.
 *
 * Coordinates between quizStore, uiStore, timer, and combo hooks
 * to manage the complete quiz answering lifecycle.
 */

import { useCallback } from "react";
import { useQuizStore } from "../stores/quizStore";
import { useUIStore } from "../stores/uiStore";
import Taro from "@tarojs/taro";

export function useQuizEngine() {
  const session = useQuizStore((s) => s.session);
  const submitAnswer = useQuizStore((s) => s.submitAnswer);
  const goToNextQuestion = useQuizStore((s) => s.goToNextQuestion);
  const getCurrentQuestion = useQuizStore((s) => s.getCurrentQuestion);
  const getProgress = useQuizStore((s) => s.getProgress);
  const lastAnswerCorrect = useQuizStore((s) => s.lastAnswerCorrect);
  const showExplanation = useQuizStore((s) => s.showExplanation);

  const setMascotMood = useUIStore((s) => s.setMascotMood);

  /**
   * Handle user selecting an answer.
   */
  const handleSelectAnswer = useCallback(
    (answer: string, timeSpent: number) => {
      const question = getCurrentQuestion();
      if (!question || showExplanation) return;

      const isCorrect = answer === question.correct_answer;

      // Update mascot mood
      setMascotMood(isCorrect ? "happy" : "encouraging");

      submitAnswer(question.id, answer, timeSpent);
    },
    [getCurrentQuestion, showExplanation, setMascotMood, submitAnswer],
  );

  /**
   * Handle "下一题" button press.
   */
  const handleNext = useCallback(() => {
    const progress = getProgress();
    if (progress.current >= progress.total) {
      // Quiz complete — navigate to result page
      Taro.redirectTo({ url: "/pages/result/index" });
    } else {
      goToNextQuestion();
      setMascotMood("normal");
    }
  }, [getProgress, goToNextQuestion, setMascotMood]);

  /**
   * Handle exit quiz.
   */
  const handleExit = useCallback(() => {
    Taro.showModal({
      title: "确认退出",
      content: "退出后当前闯关进度将丢失，确定要退出吗？",
      success: (res) => {
        if (res.confirm) {
          Taro.redirectTo({ url: "/pages/index/index" });
        }
      },
    });
  }, []);

  return {
    // State
    session,
    currentQuestion: getCurrentQuestion(),
    progress: getProgress(),
    lastAnswerCorrect,
    showExplanation,

    // Actions
    handleSelectAnswer,
    handleNext,
    handleExit,
  };
}
