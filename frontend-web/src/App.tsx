import { Routes, Route } from "react-router-dom";
import IndexPage from "./pages/IndexPage";
import LoadingPage from "./pages/LoadingPage";
import QuizPage from "./pages/QuizPage";
import ResultPage from "./pages/ResultPage";

export default function App() {
  return (
    <div className="page-center">
      <Routes>
        <Route path="/" element={<IndexPage />} />
        <Route path="/loading" element={<LoadingPage />} />
        <Route path="/quiz" element={<QuizPage />} />
        <Route path="/result" element={<ResultPage />} />
      </Routes>
    </div>
  );
}
