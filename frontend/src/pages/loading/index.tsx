/**
 * Page ②: AI 出题加载中
 *
 * 3-phase quiz generation loading page:
 *   ① Searching  — 联网搜索最新知识
 *   ② Generating — AI 生成定制题目
 *   ③ Validating — 校验答案准确性 + 领域相关性
 *
 * Driven by SSEProgressEvent `stage` field from the backend sync pipeline.
 * All SVG icons replaced with emoji/CSS for WeChat Mini Program compatibility.
 */

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { View, Text } from "@tarojs/components";
import Taro, { useLoad } from "@tarojs/taro";
import Mascot from "../../components/Mascot";
import { useQuizStore } from "../../stores/quizStore";
import { useUIStore } from "../../stores/uiStore";
import { generateQuizStream } from "../../services/api";
import type { QuizGenerateRequest, SSEProgressEvent, SSEGenerateResult } from "../../types/quiz";
import "./index.scss";

/** One loading step in the 3-phase indicator. */
interface LoadingStep {
  id: string;
  label: string;
  status: "pending" | "active" | "done" | "error";
}

/** Per-stage mascot subtitle overrides. */
const STAGE_SUBTITLES: Record<string, string> = {
  searching: "灯灯正在翻阅知识海洋...",
  generating: "灯灯正在奋笔疾书出题中...",
  validating: "灯灯正在逐题核对答案...",
};

const STAGE_MESSAGES: Record<string, string> = {
  searching: "正在搜索最新知识...",
  generating: "正在生成专属题目...",
  validating: "正在校验题目准确性...",
};

export default function LoadingPage() {
  const [steps, setSteps] = useState<LoadingStep[]>([
    { id: "search",    label: "联网搜索扩充知识",  status: "pending" },
    { id: "generate",  label: "AI 生成定制题目",    status: "pending" },
    { id: "validate",  label: "校验题目准确性",       status: "pending" },
  ]);

  const [currentStage, setCurrentStage] = useState<string | null>(null);
  const [activeMessage, setActiveMessage] = useState("");
  const [tipsRotation, setTipsRotation] = useState(0);
  const controllerRef = useRef<AbortController | null>(null);
  const knowledgeInputRef = useRef<string>("");
  const enableSearchRef = useRef<boolean>(true);

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
      knowledgeInputRef.current = input;
      startGeneration(input);
    } else {
      Taro.showToast({ title: "未收到知识输入", icon: "none" });
      setTimeout(() => Taro.navigateBack(), 1000);
    }
  });

  // ── Step helpers ─────────────────────────────────────────────

  const updateStep = useCallback(
    (stepId: string, status: LoadingStep["status"]) => {
      setSteps((prev) =>
        prev.map((s) => (s.id === stepId ? { ...s, status } : s))
      );
    },
    [],
  );

  const activateStage = useCallback(
    (stage: string, message?: string) => {
      if (currentStage === stage) return; // already active
      setCurrentStage(stage);

      // Mark previous stages done
      const stageOrder = ["search", "generate", "validate"];
      const idx = stageOrder.indexOf(stage);
      for (let i = 0; i < stageOrder.length; i++) {
        if (i < idx) updateStep(stageOrder[i], "done");
        else if (i === idx) updateStep(stageOrder[i], "active");
        // else stays pending
      }

      if (message) setActiveMessage(message);
      else if (STAGE_MESSAGES[stage]) setActiveMessage(STAGE_MESSAGES[stage]);
    },
    [currentStage, updateStep],
  );

  // ── Auto-advance stage timer ──────────────────────────────────
  // Transition search→generate after 6s so the user sees progress
  // during the 60-120s backend wait instead of being stuck on "search".
  useEffect(() => {
    if (currentStage !== "search") return;
    const timer = setTimeout(() => {
      activateStage("generate", "AI 正在生成专属题目...");
    }, 6000);
    return () => clearTimeout(timer);
  }, [currentStage, activateStage]);

  // ── Rotate progress messages during generate phase ────────────
  const generateMessages = [
    "正在分析知识点结构...",
    "正在设计题目难度梯度...",
    "正在构思有趣的题目...",
    "灯灯正在奋笔疾书中...",
  ];

  useEffect(() => {
    if (currentStage !== "generate") return;
    let idx = 0;
    const timer = setInterval(() => {
      idx = (idx + 1) % generateMessages.length;
      setActiveMessage(generateMessages[idx]);
    }, 4000);
    return () => clearInterval(timer);
  }, [currentStage]);

  // ── Generation start ─────────────────────────────────────────

  const startGeneration = useCallback(
    (input: string) => {
      setGenerating(true);

      const request: QuizGenerateRequest = {
        knowledge_input: input,
        question_count: 10,
        difficulty: "auto",
        question_types: ["choice"],
        enable_search: true, // default on; user can adjust via settings
      };

      enableSearchRef.current = request.enable_search !== false;

      // Initialize: set first step active
      if (request.enable_search !== false) {
        activateStage("search", "正在搜索最新知识...");
      } else {
        // Skip search — mark it as done immediately
        updateStep("search", "done");
        activateStage("generate", "正在分析知识点...");
      }

      controllerRef.current = generateQuizStream(request, {
        onProgress: (event: SSEProgressEvent) => {
          // Drive step transitions from actual SSE stage events
          switch (event.stage) {
            case "searching":
              if (event.status === "done") {
                updateStep("search", "done");
                activateStage("generate", "题目生成中...");
              } else if (!currentStage || currentStage === "searching") {
                // Still searching — update message
                setActiveMessage(
                  event.message.includes("提取")
                    ? "正在提取网页内容..."
                    : event.message || "正在搜索最新知识...",
                );
              }
              break;

            case "generating":
              if (event.status === "done") {
                updateStep("generate", "done");
                activateStage("validate", "正在校验题目准确性...");
              } else if (currentStage === "generating") {
                setActiveMessage(event.message || "题目生成中...");
              }
              break;

            case "validating":
              if (event.status === "done") {
                updateStep("validate", "done");
              } else {
                setActiveMessage(event.message || "正在校验题目准确性...");
              }
              break;
          }
        },

        onResult: (result: SSEGenerateResult) => {
          // Mark all steps done
          updateStep("search", "done");
          updateStep("generate", "done");
          updateStep("validate", "done");
          setCurrentStage(null);
          setGenerating(false);

          // Initialize session and navigate to quiz
          initSession(
            result.quiz_id,
            result.title,
            result.knowledge_domain,
            knowledgeInputRef.current,
            result.questions,
          );

          // Small delay for user to see all checkmarks
          setTimeout(() => {
            Taro.redirectTo({ url: "/pages/quiz/index" });
          }, 400);
        },

        onDone: () => {
          setGenerating(false);
        },

        onError: (message, detail) => {
          console.error("Generation error:", message, detail);
          // Mark current stage as error
          if (currentStage) {
            updateStep(currentStage, "error");
          }
          setGenerating(false);
          Taro.showModal({
            title: "出题失败",
            content: message || "AI出题遇到问题，请重试",
            showCancel: false,
            success: () => Taro.navigateBack(),
          });
        },
      });
    },
    [setGenerating, activateStage, updateStep, initSession, currentStage],
  );

  const handleCancel = useCallback(() => {
    if (controllerRef.current) {
      controllerRef.current.abort();
    }
    setGenerating(false);
    Taro.navigateBack();
  }, [setGenerating]);

  // ── Derived display values ───────────────────────────────────

  const subtitle = useMemo(() => {
    if (!currentStage) return "AI 正在为你定制专属题目";
    return (
      STAGE_SUBTITLES[currentStage] || "AI 正在为你定制专属题目"
    );
  }, [currentStage]);

  // ── Render ───────────────────────────────────────────────────

  return (
    <View className="app-phone-frame">
      <View className="app-phone-content loading-page">
        <View className="loading-hero">
          {/* Mascot — thinking / concentrating */}
          <View className="loading-mascot">
            <Mascot mood="thinking" size={80} />
          </View>

          <Text className="loading-title">灯灯正在处理...</Text>
          <Text className="loading-subtitle">{subtitle}</Text>

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

          {/* 3-Phase Loading Steps */}
          <View className="loading-steps">
            {steps.map((step) => (
              <View key={step.id} className={`loading-step ${step.status}`}>
                {/* Status icon */}
                {step.status === "done" ? (
                  <View className="step-icon-done">
                    <View className="check-mark" />
                  </View>
                ) : step.status === "active" ? (
                  <View className="step-spinner" />
                ) : step.status === "error" ? (
                  <View className="step-icon-error">
                    <Text className="error-mark">!</Text>
                  </View>
                ) : (
                  <View className="step-icon-pending" />
                )}

                {/* Label + sub-message */}
                <View className="step-text">
                  <Text
                    className={`step-label ${
                      step.status === "active" ? "step-label-active" : ""
                    }`}
                  >
                    {step.label}
                  </Text>
                  {step.status === "active" && activeMessage && (
                    <Text className="step-message">{activeMessage}</Text>
                  )}
                </View>
              </View>
            ))}
          </View>

          {/* Cool Fact Tips */}
          <View className="loading-tips">
            <View className="tips-icon">
              <View className="bulb-dot" />
            </View>
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
