import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuizStore } from "../stores/quizStore";
import { generateQuizStream } from "../services/api";
import type { QuizGenerateRequest, SSEProgressEvent, SSEGenerateResult } from "../types/quiz";
import Mascot from "../components/Mascot";
import "../styles/loading.css";

const COOL_FACTS = [
  "据说连续答对10题会触发隐藏彩蛋！",
  "灯灯每天生成超过10000道题目～",
  "AI出题时会像老师一样思考知识点的重要程度",
  "题目难度会根据你的表现动态调整哦",
];

export default function LoadingPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const input = searchParams.get("input") || "";

  const [steps, setSteps] = useState([
    { id: "analyze", label: "分析知识领域", status: "pending" as const },
    { id: "search", label: "联网搜索扩充知识库", status: "pending" as const },
    { id: "generate", label: "AI 生成题目中...", status: "pending" as const },
    { id: "validate", label: "校验题目准确性", status: "pending" as const },
  ]);
  const [tipsIdx, setTipsIdx] = useState(0);
  const startedRef = useRef(false);

  const initSession = useQuizStore((s) => s.initSession);

  // Rotate cool facts
  useEffect(() => {
    const timer = setInterval(() => setTipsIdx((p) => (p + 1) % COOL_FACTS.length), 3000);
    return () => clearInterval(timer);
  }, []);

  // Auto-progress demo steps (complement SSE)
  useEffect(() => {
    const timers = [
      setTimeout(() => setSteps((s) => s.map((st) => st.id === "analyze" ? { ...st, status: "done" } : st)), 1500),
      setTimeout(() => setSteps((s) => s.map((st) => st.id === "search" ? { ...st, status: "current" } : st)), 2000),
      setTimeout(() => setSteps((s) => s.map((st) => st.id === "search" ? { ...st, status: "done" } : st.id === "generate" ? { ...st, status: "current" } : st)), 4000),
      setTimeout(() => setSteps((s) => s.map((st) => st.id === "generate" ? { ...st, status: "done" } : st.id === "validate" ? { ...st, status: "current" } : st)), 7000),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    if (startedRef.current || !input) return;
    startedRef.current = true;

    const request: QuizGenerateRequest = {
      knowledge_input: input,
      question_count: 10,
      difficulty: "auto",
      question_types: ["choice"],
    };

    setSteps((s) => s.map((st) => st.id === "analyze" ? { ...st, status: "current" } : st));

    generateQuizStream(request, {
      onProgress: (event: SSEProgressEvent) => {
        if (event.stage === "generating") setSteps((s) => s.map((st) => st.id === "generate" ? { ...st, status: "current" } : st));
        if (event.stage === "validating") setSteps((s) => s.map((st) => st.id === "validate" ? { ...st, status: "current" } : st));
      },
      onResult: (result: SSEGenerateResult) => {
        setSteps((s) => s.map((st) => ({ ...st, status: "done" as const })));
        initSession(result.quiz_id, result.title, result.knowledge_domain, result.questions);
        navigate("/quiz", { replace: true });
      },
      onError: (msg) => {
        alert("出题失败: " + msg);
        navigate("/", { replace: true });
      },
    });
  }, [input]);

  if (!input) return <div className="app-phone-frame"><div className="app-phone-content">未收到知识输入</div></div>;

  return (
    <div className="app-phone-frame">
      <div className="app-phone-content loading-page">
        <div className="loading-hero">
          <div className="loading-mascot"><Mascot mood="thinking" size={80} /></div>
          <div className="loading-title">灯灯正在疯狂翻书...</div>
          <div className="loading-subtitle">AI 正在为你定制专属题目</div>

          <div className="loading-pot">
            <div className="pot-body">
              <div className="pot-bubble"/><div className="pot-bubble"/><div className="pot-bubble"/>
              <div className="pot-bubble"/><div className="pot-bubble"/>
            </div>
          </div>

          <div className="loading-steps">
            {steps.map((step) => (
              <div key={step.id} className={`loading-step ${step.status}`}>
                {step.status === "done" ? "✅" : step.status === "current" ? "⏳" : "⏱️"}
                <span>{step.label}</span>
              </div>
            ))}
          </div>

          <div className="loading-tips">
            💡 <strong>灯灯冷知识：</strong>{COOL_FACTS[tipsIdx]}
          </div>
        </div>

        <div className="cancel-btn" onClick={() => navigate("/", { replace: true })}>取消生成</div>
      </div>
    </div>
  );
}
