/**
 * Zustand store for user authentication and profile state.
 *
 * Manages: token persistence, user profile, login/logout flows.
 *
 * Token storage strategy:
 *   Mini-program: Taro.setStorageSync / getStorageSync
 */

import { create } from "zustand";
import Taro from "@tarojs/taro";
import type { UserBrief } from "../types/user";

// ── Token Helpers ───────────────────────────────────────────

const TOKEN_KEY = "aladeng_token";

function getPlatformToken(): string | null {
  try {
    return Taro.getStorageSync(TOKEN_KEY) || null;
  } catch {
    // Fallback for environments without Taro APIs
    if (typeof localStorage !== "undefined") {
      return localStorage.getItem(TOKEN_KEY);
    }
    return null;
  }
}

function setPlatformToken(token: string): void {
  try {
    Taro.setStorageSync(TOKEN_KEY, token);
  } catch {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(TOKEN_KEY, token);
    }
  }
}

function removePlatformToken(): void {
  try {
    Taro.removeStorageSync(TOKEN_KEY);
  } catch {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(TOKEN_KEY);
    }
  }
}

// ── Store State ─────────────────────────────────────────────

interface UserState {
  /** JWT token — null when not logged in */
  token: string | null;

  /** Current user profile — null when not loaded */
  user: UserBrief | null;

  /** Whether a login request is in flight */
  isLoggingIn: boolean;

  /** Error message from last failed login attempt */
  loginError: string | null;
}

// ── Store Actions ────────────────────────────────────────────

interface UserActions {
  /** Check if the user is currently logged in (has a token) */
  isLoggedIn: () => boolean;

  /** Login with WeChat code (Mini Program) */
  wechatLogin: (code: string) => Promise<void>;

  /** Load user profile from /api/auth/me using stored token */
  loadProfile: () => Promise<void>;

  /** Set the token and user data directly (after login API call) */
  setAuth: (token: string, user: UserBrief) => void;

  /** Clear all auth state and stored token */
  logout: () => void;

  /** Clear login error */
  clearLoginError: () => void;
}

// ── Store ───────────────────────────────────────────────────

export const useUserStore = create<UserState & UserActions>((set, get) => ({
  // ── Initial State ─────────────────────────────────────

  token: getPlatformToken(),
  user: null,
  isLoggingIn: false,
  loginError: null,

  // ── Actions ───────────────────────────────────────────

  isLoggedIn: () => {
    return !!get().token;
  },

  wechatLogin: async (code: string) => {
    set({ isLoggingIn: true, loginError: null });

    try {
      const { authApi } = await import("../services/api");
      const result = await authApi.wechatLogin(code);

      if (result.code === 0 && result.data) {
        get().setAuth(result.data.token, result.data.user);
      } else {
        set({ loginError: result.message || "微信登录失败" });
      }
    } catch (err) {
      set({ loginError: (err as Error).message || "网络请求失败" });
    } finally {
      set({ isLoggingIn: false });
    }
  },

  loadProfile: async () => {
    const { token } = get();
    if (!token) return;

    try {
      const { authApi } = await import("../services/api");
      const result = await authApi.getProfile();

      if (result.code === 0 && result.data) {
        set({ user: result.data.user });
      } else if (result.code === 401) {
        // Token expired — clear auth
        get().logout();
      }
    } catch {
      // Silently fail — token may be expired
      get().logout();
    }
  },

  setAuth: (token: string, user: UserBrief) => {
    setPlatformToken(token);
    set({ token, user, isLoggingIn: false, loginError: null });
  },

  logout: () => {
    removePlatformToken();
    set({ token: null, user: null, loginError: null });
  },

  clearLoginError: () => set({ loginError: null }),
}));
