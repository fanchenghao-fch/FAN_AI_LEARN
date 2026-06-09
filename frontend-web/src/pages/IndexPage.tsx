/**
 * Page ①: 首页 · 知识输入
 * React DOM adaptation — uses HTML elements, React Router nav, CSS classes from prototype.
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Mascot from "../components/Mascot";
import "../styles/index.css";

export default function IndexPage() {
  const [knowledgeInput, setKnowledgeInput] = useState("");
  const navigate = useNavigate();

  const handleStartQuiz = () => {
    const input = knowledgeInput.trim();
    if (!input) { alert("请输入想学的知识"); return; }
    navigate(`/loading?input=${encodeURIComponent(input)}`);
  };

  return (
    <div className="app-phone-frame">
      <div className="app-phone-content page1">
        <div className="status-bar-spacer" />

        <div className="page1-header">
          <div className="logo">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: "-4px" }}>
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
            <span>AI闯关学</span>
          </div>
          <span className="badge hot">连续学习3天</span>
        </div>

        <div className="mascot-area">
          <div className="mascot-wrap float">
            <Mascot mood="normal" size={80} />
          </div>
          <div className="speech-bubble mascot-msg">
            <span style={{ fontFamily: "var(--font-display)" }}>灯灯说：</span><br />
            把想学的知识丢进来！<br />我帮你变出超酷的题目～
          </div>
        </div>

        <div className="input-area">
          <textarea
            placeholder="今天想学什么？比如：Python面试高频题、中国近代史..."
            value={knowledgeInput}
            onChange={(e) => setKnowledgeInput(e.target.value)}
            maxLength={2000}
            className="knowledge-textarea"
            rows={3}
          />
          <div className="input-actions">
            {["文档", "链接", "拍照", "语音"].map((t) => (
              <button key={t} className="attach-btn" onClick={() => alert(`${t}功能即将上线`)}>
                {t}
              </button>
            ))}
          </div>
        </div>

        <button className="comic-btn primary lg generate-btn" onClick={handleStartQuiz}>
          开始闯关
        </button>

        <div className="hot-quiz-section">
          <div className="section-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#F59E0B" stroke="#1E1E1E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: "-3px" }}>
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
            <span>热门闯关</span>
          </div>
          <div className="hot-quiz-list">
            {[
              ["Py", "#FEF3C7", "Python面试高频题50道", "1280人已闯关 · 中等难度"],
              ["史", "#DBEAFE", "中国近代史十大事件", "890人已闯关 · 简单难度"],
              ["物", "#D1FAE5", "高考物理必考公式", "新上线 · 困难难度"],
            ].map(([icon, bg, title, meta]) => (
              <div key={title} className="hot-quiz-item" onClick={() => setKnowledgeInput(title)}>
                <div className="quiz-icon" style={{ background: bg, fontWeight: 900, fontSize: "0.8rem", color: "#1E1E1E" }}>
                  {icon}
                </div>
                <div className="quiz-info">
                  <span className="quiz-title">{title}</span>
                  <span className="quiz-meta">{meta}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="nav-bar">
          {["首页", "发现", "出题", "消息", "我的"].map((item) => (
            <div key={item} className={`nav-item${item === "首页" ? " active" : ""}`}>
              {item}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
