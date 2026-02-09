import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren
} from "react";

import {
  getMe,
  login as loginApi,
  logoutAuth,
  refreshAuth,
  register as registerApi,
  type AuthUser
} from "../../lib/api/client";

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  loading: boolean;
  login: (payload: { email: string; password: string }) => Promise<void>;
  register: (payload: { email: string; password: string; timezone: string }) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

const STORAGE_KEY = "reward-auth";

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const clearSession = useCallback(() => {
    setUser(null);
    setAccessToken(null);
    setRefreshToken(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const persistTokens = useCallback((nextAccessToken: string, nextRefreshToken: string) => {
    setAccessToken(nextAccessToken);
    setRefreshToken(nextRefreshToken);
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ accessToken: nextAccessToken, refreshToken: nextRefreshToken })
    );
  }, []);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      setLoading(false);
      return;
    }

    try {
      const parsed = JSON.parse(raw) as { accessToken: string; refreshToken: string };
      setAccessToken(parsed.accessToken);
      setRefreshToken(parsed.refreshToken);

      getMe(parsed.accessToken)
        .then((response) => {
          setUser(response.user);
        })
        .catch(async () => {
          try {
            const refreshed = await refreshAuth({ refreshToken: parsed.refreshToken });
            persistTokens(refreshed.tokens.accessToken, refreshed.tokens.refreshToken);
            const me = await getMe(refreshed.tokens.accessToken);
            setUser(me.user);
          } catch {
            clearSession();
          }
        })
        .finally(() => setLoading(false));
    } catch {
      clearSession();
      setLoading(false);
    }
  }, [clearSession, persistTokens]);

  const login = useCallback(
    async (payload: { email: string; password: string }) => {
      const response = await loginApi(payload);
      persistTokens(response.tokens.accessToken, response.tokens.refreshToken);
      setUser(response.user);
    },
    [persistTokens]
  );

  const register = useCallback(
    async (payload: { email: string; password: string; timezone: string }) => {
      const response = await registerApi(payload);
      persistTokens(response.tokens.accessToken, response.tokens.refreshToken);
      setUser(response.user);
    },
    [persistTokens]
  );

  const logout = useCallback(async () => {
    if (refreshToken) {
      await logoutAuth({ refreshToken }).catch(() => undefined);
    }

    clearSession();
  }, [clearSession, refreshToken]);

  const value = useMemo(
    () => ({ user, accessToken, refreshToken, loading, login, register, logout }),
    [user, accessToken, refreshToken, loading, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return ctx;
}
