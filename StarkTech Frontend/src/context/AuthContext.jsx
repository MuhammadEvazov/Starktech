import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
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

export function AuthProvider({ children }) {
  const [session, setSession] = useState(readSession);
  const [profile, setProfile] = useState(null);

  const logout = useCallback(() => {
    tokenStore.set(null);
    setSession(null);
    setProfile(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    try {
      setProfile(await profileApi.get());
    } catch {
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    if (session) refreshProfile();
  }, [session?.token]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onExpired = () => logout();
    window.addEventListener('auth:expired', onExpired);
    return () => window.removeEventListener('auth:expired', onExpired);
  }, [logout]);

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
      isAuthenticated: !!session,
      roles,
      isAdmin: roles.includes('Admin') || roles.includes('SuperAdmin'),
      isSuperAdmin: roles.includes('SuperAdmin'),
      login,
      logout,
      refreshProfile,
      setProfile,
    };
  }, [session, profile, login, logout, refreshProfile]);

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
