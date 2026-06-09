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
    // 两端独立输出目录，避免互相覆盖
    outputRoot: `${process.env.TARO_ENV === "h5" ? "dist-h5" : "dist"}`,
    // 也可以通过环境变量注入构建时间
    env: {
      TARO_APP_BUILD_TIME: JSON.stringify(new Date().toISOString()),
    },
    plugins: [
      "@tarojs/plugin-platform-h5",
      "@tarojs/plugin-platform-weapp",
      "@tarojs/plugin-framework-react",
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
    mini: {
      webpackChain(chain) {
        // 排除 H5 专属样式
        chain.module
          .rule("h5-scss-null")
          .test(/\.h5\.scss$/)
          .enforce("pre")
          .use("null-loader")
          .loader("null-loader");
      },
    },
    h5: {
      publicPath: "/",
      staticDirectory: "static",
      output: {
        filename: "js/[name].[hash:8].js",
        chunkFilename: "js/[name].[chunkhash:8].js",
      },
      miniCss: {
        filename: "css/[name].[hash:8].css",
        chunkFilename: "css/[name].[chunkhash:8].css",
      },
      router: {
        mode: "hash",
        basename: "/",
      },
      devServer: {
        port: 10086,
        host: "0.0.0.0",
      },
      webpackChain(chain) {
        chain.output.set("publicPath", "/");
      },
    },
    rn: {
      appName: "AiQuizFrontend",
    },
  };

  if (process.env.NODE_ENV === "development") {
    return merge({}, baseConfig, devConfig);
  }
  return merge({}, baseConfig, prodConfig);
});
