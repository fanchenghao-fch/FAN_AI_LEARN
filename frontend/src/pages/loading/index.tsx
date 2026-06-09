/**
 * Page ②: AI 出题加载中
 *
 * Faithful reproduction of PAGE 2/8 from 01-核心业务流程.html prototype.
 * Shows loading animation with mascot, cauldron, and progress steps.
 * Handles SSE stream for quiz generation.
 *
 * All SVG icons replaced with emoji/CSS for WeChat Mini Program compatibility.
 */

import { useEffect, useState, useRef, useCallback } from "react";
import { View, Text } from "@tarojs/components";
import Taro, { useLoad } from "@tarojs/taro";
import Mascot from "../../components/Mascot";
import { useQuizStore } from "../../stores/quizStore";
import { useUIStore } from "../../stores/uiStore";
import { generateQuizStream } from "../../services/api";
import type { QuizGenerateRequest, SSEProgressEvent, SSEGenerateResult } from "../../types/quiz";
import "./index.scss";

interface LoadingStep {
  id: string;
  label: string;
  status: "pending" | "current" | "done";
}

export default function LoadingPage() {
  const [steps, setSteps] = useState<LoadingStep[]>([
    { id: "analyze", label: "分析知识领域", status: "pending" },
    { id: "search", label: "联网搜索扩充知识库", status: "pending" },
    { id: "generate", label: "AI 生成题目中...", status: "pending" },
    { id: "validate", label: "校验题目准确性", status: "pending" },
  ]);

  const [tipsRotation, setTipsRotation] = useState(0);
  const controllerRef = useRef<AbortController | null>(null);

  const initSession = useQuizStore((s) => s.initSession);
  const setGenerating = useUIStore((s) => s.setGenerating);

  const coolFacts = [
    "据说连续答对10题会触发隐藏彩蛋！",
    "灯灯每天生成超过10000道题目～",
    "AI出题时会像老师一样思考知识点的重要程度",
    "题目难度会根据你的表现动态调整哦",
  ];

  // Rotate cool facts every 3 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setTipsRotation((prev) => (prev + 1) % coolFacts.length);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  useLoad((options) => {
    const input = decodeURIComponent(options?.input || "");
    if (input) {
      startGeneration(input);
    } else {
      Taro.showToast({ title: "未收到知识输入", icon: "none" });
      setTimeout(() => Taro.navigateBack(), 1000);
    }
  });

  const updateStep = useCallback((stepId: string, status: LoadingStep["status"]) => {
    setSteps((prev) =>
      prev.map((s) => (s.id === stepId ? { ...s, status } : s))
    );
  }, []);

  const startGeneration = useCallback((input: string) => {
    setGenerating(true);

    const request: QuizGenerateRequest = {
      knowledge_input: input,
      question_count: 10,
      difficulty: "auto",
      question_types: ["choice"],
    };

    // Mark first step as current
    updateStep("analyze", "current");

    controllerRef.current = generateQuizStream(request, {
      onProgress: (event: SSEProgressEvent) => {
        switch (event.stage) {
          case "generating":
            if (event.message.includes("分析")) {
              updateStep("analyze", "done");
              updateStep("search", "current");
            } else if (event.message.includes("搜索")) {
              updateStep("search", "done");
              updateStep("generate", "current");
            } else if (event.message.includes("生成")) {
              updateStep("generate", "current");
            }
            break;
          case "validating":
            updateStep("generate", "done");
            updateStep("validate", "current");
            break;
        }
      },

      onResult: (result: SSEGenerateResult) => {
        // All steps done
        updateStep("validate", "done");
        setGenerating(false);

        // Initialize session and navigate to quiz
        initSession(
          result.quiz_id,
          result.title,
          result.knowledge_domain,
          result.questions,
        );

        Taro.redirectTo({ url: "/pages/quiz/index" });
      },

      onDone: () => {
        setGenerating(false);
      },

      onError: (message, detail) => {
        console.error("Generation error:", message, detail);
        setGenerating(false);
        Taro.showModal({
          title: "出题失败",
          content: message || "AI出题遇到问题，请重试",
          showCancel: false,
          success: () => Taro.navigateBack(),
        });
      },
    });
  }, [setGenerating, updateStep, initSession]);

  const handleCancel = useCallback(() => {
    if (controllerRef.current) {
      controllerRef.current.abort();
    }
    setGenerating(false);
    Taro.navigateBack();
  }, [setGenerating]);

  // Auto-progress steps for visual demo if SSE hasn't updated them
  useEffect(() => {
    const timers = [
      setTimeout(() => updateStep("analyze", "done"), 1500),
      setTimeout(() => { updateStep("analyze", "done"); updateStep("search", "current"); }, 2000),
      setTimeout(() => { updateStep("search", "done"); updateStep("generate", "current"); }, 4000),
      setTimeout(() => { updateStep("generate", "done"); updateStep("validate", "current"); }, 7000),
    ];

    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <View className="app-phone-frame">
      <View className="app-phone-content loading-page">
        <View className="loading-hero">
          {/* Mascot — thinking/concentrating */}
          <View className="loading-mascot">
            <Mascot mood="thinking" size={80} />
          </View>

          <Text className="loading-title">灯灯正在疯狂翻书...</Text>
          <Text className="loading-subtitle">AI 正在为你定制专属题目</Text>

          {/* Cauldron / Pot Animation */}
          <View className="loading-pot">
            <View className="pot-body">
              <View className="pot-bubble" />
              <View className="pot-bubble" />
              <View className="pot-bubble" />
              <View className="pot-bubble" />
              <View className="pot-bubble" />
            </View>
          </View>

          {/* Loading Steps */}
          <View className="loading-steps">
            {steps.map((step) => (
              <View key={step.id} className={`loading-step ${step.status}`}>
                {step.status === "done" ? (
                  <Text className="step-icon done">✅</Text>
                ) : step.status === "current" ? (
                  <View className="step-spinner" />
                ) : (
                  <Text className="step-icon pending">⏳</Text>
                )}
                <Text>{step.label}</Text>
              </View>
            ))}
          </View>

          {/* Cool Fact Tips */}
          <View className="loading-tips">
            <Text className="tips-emoji">💡</Text>
            <Text style={{ fontWeight: 700 }}> 灯灯冷知识：</Text>
            <Text>{coolFacts[tipsRotation]}</Text>
          </View>
        </View>

        {/* Cancel Button */}
        <View className="cancel-btn" onClick={handleCancel}>
          <Text>取消生成</Text>
        </View>
      </View>
    </View>
  );
}
