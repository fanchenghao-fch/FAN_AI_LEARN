import { PropsWithChildren } from "react";
import { useLaunch } from "@tarojs/taro";
import Taro from "@tarojs/taro";
import { getCurrentApiBase } from "./services/api";
import "./app.scss";

function App({ children }: PropsWithChildren<object>) {
  useLaunch(() => {
    console.log("AI Quiz Platform launched.");

    // Quick connectivity check — warn if backend is unreachable
    const apiBase = getCurrentApiBase();
    console.log("[App] API base:", apiBase);
    Taro.request({
      url: `${apiBase}/api/auth/me`,
      method: "GET",
      timeout: 3000,
      success: () => {
        console.log("[App] Backend reachable ✓");
      },
      fail: (err) => {
        console.warn("[App] Backend unreachable:", err.errMsg);
        Taro.showModal({
          title: "后端连接失败",
          content: `无法连接服务器 ${apiBase}\n\n请确认：\n1. 后端已启动\n2. 在"我的"页面可切换API地址`,
          showCancel: false,
        });
      },
    });
  });

  // children is the page component provided by Taro router
  return children;
}

export default App;
