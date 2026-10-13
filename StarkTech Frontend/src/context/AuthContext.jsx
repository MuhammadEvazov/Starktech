import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { tokenStore } from '../api/client.js';
import { authApi, profileApi } from '../api/endpoints.js';

// Имена claim'ов, которые кладёт JwtService (ClaimTypes.*)
const ROLE_CLAIM = 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role';
const EMAIL_CLAIM = 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress';
const ID_CLAIM = 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier';

export function decodeToken(token) {
  try {
    const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(part)
        .split('')
        .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join(''),
    );
    const p = JSON.parse(json);
    const r = p[ROLE_CLAIM] ?? p.role ?? [];
    return {
      userId: p[ID_CLAIM] ?? p.nameid ?? p.sub,
      email: p[EMAIL_CLAIM] ?? p.email,
      roles: Array.isArray(r) ? r : [r],
      exp: p.exp ? p.exp * 1000 : null,
    };
  } catch {
    return null;
  }
}

function readSession() {
  const token = tokenStore.get();
  if (!token) return null;
  const claims = decodeToken(token);
  if (!claims || (claims.exp && claims.exp < Date.now())) {
    tokenStore.set(null);
    return null;
  }
  return { token, ...claims };
}

const AuthCtx = createContext(null);

// Как часто проверять срок действия токена и через сколько повторить неудачную загрузку профиля.
const EXPIRY_CHECK_MS = 60 * 1000;
const PROFILE_RETRY_MS = 15 * 1000;

export function AuthProvider({ children }) {
  const [session, setSession] = useState(readSession);
  const [profile, setProfile] = useState(null);
  // Ошибка последней загрузки профиля (сеть, 5xx). Профиль при этом не сбрасываем — остаётся последний удачный.
  const [profileError, setProfileError] = useState(null);
  const retryTimer = useRef(null);

  const logout = useCallback(() => {
    tokenStore.set(null);
    clearTimeout(retryTimer.current);
    setSession(null);
    setProfile(null);
    setProfileError(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    const token = tokenStore.get();
    if (!token) return;
    clearTimeout(retryTimer.current);
    try {
      const p = await profileApi.get();
      // Ответ мог прийти уже после выхода/смены пользователя — тогда он устарел.
      if (tokenStore.get() !== token) return;
      setProfile(p);
      setProfileError(null);
    } catch (e) {
      if (tokenStore.get() !== token) return;
      // 401 обрабатывает client.js (событие auth:expired → logout). Временные ошибки — повторим позже.
      if (e?.status === 401) return;
      setProfileError(e);
      retryTimer.current = setTimeout(() => refreshProfile(), PROFILE_RETRY_MS);
    }
  }, []);

  useEffect(() => {
    if (session) refreshProfile();
    return () => clearTimeout(retryTimer.current);
  }, [session?.token]); // eslint-disable-line react-hooks/exhaustive-deps

  // Профиль другого пользователя не показываем ни мгновения: при смене userId сбрасываем его.
  const userId = session?.userId ?? null;
  const prevUser = useRef(userId);
  useEffect(() => {
    if (prevUser.current !== userId) {
      prevUser.current = userId;
      setProfile(null);
      setProfileError(null);
    }
  }, [userId]);

  useEffect(() => {
    const onExpired = () => logout();
    window.addEventListener('auth:expired', onExpired);
    return () => window.removeEventListener('auth:expired', onExpired);
  }, [logout]);

  // Срок действия токена: проверяем раз в минуту и при возвращении на вкладку — истёк → выходим.
  useEffect(() => {
    if (!session?.exp) return undefined;
    const check = () => {
      if (session.exp <= Date.now()) logout();
    };
    check();
    const t = setInterval(check, EXPIRY_CHECK_MS);
    const onVisible = () => document.visibilityState === 'visible' && check();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [session?.exp, logout]); // eslint-disable-line react-hooks/exhaustive-deps

  const login = useCallback(async (email, password) => {
    const res = await authApi.login({ email, password });
    tokenStore.set(res.token);
    const s = readSession();
    setSession(s);
    return s;
  }, []);

  const value = useMemo(() => {
    const roles = session?.roles ?? [];
    return {
      session,
      profile,
      profileError,
      isAuthenticated: !!session,
      roles,
      isAdmin: roles.includes('Admin') || roles.includes('SuperAdmin'),
      isSuperAdmin: roles.includes('SuperAdmin'),
      login,
      logout,
      refreshProfile,
      setProfile,
    };
  }, [session, profile, profileError, login, logout, refreshProfile]);

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
