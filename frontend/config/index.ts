import { defineConfig, type UserConfigExport } from "@tarojs/cli";
import devConfig from "./dev";
import prodConfig from "./prod";

export default defineConfig<"webpack5">(async (merge, { command, mode }) => {
  const baseConfig: UserConfigExport<"webpack5"> = {
    projectName: "ai-quiz-frontend",
    date: "2026-6-8",
    designWidth: 375,
    deviceRatio: {
      640: 2.34 / 2,
      750: 1,
      375: 2,
      828: 1.81 / 2,
    },
    sourceRoot: "src",
    // 小程序独立输出目录
    outputRoot: "dist",
    // 也可以通过环境变量注入构建时间
    env: {
      TARO_APP_BUILD_TIME: JSON.stringify(new Date().toISOString()),
    },
    plugins: [
      "@tarojs/plugin-platform-weapp",
      "@tarojs/plugin-framework-react",
      "@tarojs/plugin-html",
    ],
    defineConstants: {},
    copy: {
      patterns: [],
      options: {},
    },
    framework: "react",
    compiler: "webpack5",
    cache: {
      enable: false,
    },
    mini: {},
    rn: {
      appName: "AiQuizFrontend",
    },
  };

  if (process.env.NODE_ENV === "development") {
    return merge({}, baseConfig, devConfig);
  }
  return merge({}, baseConfig, prodConfig);
});
