/**
 * Login page — WeChat Mini Program one-click login.
 */

import { useCallback } from "react";
import { View, Text } from "@tarojs/components";
import Taro from "@tarojs/taro";
import Mascot from "../../components/Mascot";
import { useUserStore } from "../../stores/userStore";
import "./index.scss";

export default function LoginPage() {
  const { wechatLogin, isLoggingIn, loginError } = useUserStore();

  const handleWechatLogin = useCallback(async () => {
    try {
      const loginRes = await Taro.login();
      if (!loginRes.code) {
        Taro.showToast({ title: "微信登录失败", icon: "none" });
        return;
      }
      await wechatLogin(loginRes.code);
      const state = useUserStore.getState();
      if (state.token) {
        Taro.showToast({ title: "登录成功！", icon: "success", duration: 1200 });
        setTimeout(() => {
          Taro.navigateBack();
        }, 800);
      }
    } catch (err) {
      Taro.showToast({
        title: `微信登录失败: ${(err as Error).message}`,
        icon: "none",
      });
    }
  }, [wechatLogin]);

  return (
    <View className="login-page">
      <View className="status-bar-spacer" />

      {/* Mascot */}
      <View className="login-mascot-area">
        <View className="login-mascot-wrap float">
          <Mascot mood="normal" size={100} />
        </View>
        <View className="speech-bubble login-speech">
          <Text className="login-speech-title">灯灯说：</Text>
          <Text>{"\n"}欢迎来到阿拉灯神丁！</Text>
          <Text>{"\n"}点击下方按钮，开启学习之旅吧～</Text>
        </View>
      </View>

      {/* Login Card */}
      <View className="login-card comic-card">
        <View className="login-card-title-wrap">
          <View className="section-bar yellow" />
          <Text className="section-title">开始学习</Text>
        </View>

        {/* WeChat Login */}
        <View className="login-form">
          <Text className="login-wx-hint">点击下方按钮授权登录</Text>

          {loginError && (
            <View className="login-error">
              <Text>{loginError}</Text>
            </View>
          )}

          <View
            className={`comic-btn primary lg login-submit-btn${
              isLoggingIn ? " disabled" : ""
            }`}
            onClick={isLoggingIn ? undefined : handleWechatLogin}
          >
            <Text>{isLoggingIn ? "正在登录..." : "微信一键登录"}</Text>
          </View>
        </View>
      </View>

      {/* Footer Message */}
      <View className="login-footer">
        <Text className="login-footer-text">
          登录后可以保存学习记录、积累金币、复习错题哦！
        </Text>
      </View>
    </View>
  );
}
