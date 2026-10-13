// Небольшой роутер на History API: маршруты с параметрами (:id), вложенные
// разделы через "/*", Link/NavLink, useNavigate, useParams, useSearch.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

const RouterCtx = createContext(null);
const ParamsCtx = createContext({ params: {}, base: '' });

function readLocation() {
  return {
    pathname: window.location.pathname,
    search: window.location.search,
    state: window.history.state?.usr ?? null,
  };
}

export function Router({ children }) {
  const [location, setLocation] = useState(readLocation);

  useEffect(() => {
    const onPop = () => setLocation(readLocation());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigate = useCallback((to, opts = {}) => {
    if (typeof to === 'number') {
      window.history.go(to);
      return;
    }
    const method = opts.replace ? 'replaceState' : 'pushState';
    window.history[method]({ usr: opts.state ?? null }, '', to);
    setLocation(readLocation());
    if (!opts.keepScroll) window.scrollTo(0, 0);
  }, []);

  // Смена страницы: переводим фокус на <main>, чтобы скринридер начал с нового содержимого.
  // При первой загрузке не трогаем; не отнимаем фокус у поля/диалога, который страница сфокусировала сама.
  const firstPath = useRef(true);
  useEffect(() => {
    if (firstPath.current) {
      firstPath.current = false;
      return undefined;
    }
    const raf = requestAnimationFrame(() => {
      const main = document.querySelector('main');
      if (!main) return;
      const active = document.activeElement;
      if (
        active &&
        active !== document.body &&
        (active.closest('[role="dialog"]') || (main.contains(active) && active.matches('input, select, textarea, [contenteditable]')))
      )
        return;
      if (!main.hasAttribute('tabindex')) main.setAttribute('tabindex', '-1');
      main.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(raf);
  }, [location.pathname]);

  const value = useMemo(() => ({ location, navigate }), [location, navigate]);
  return <RouterCtx.Provider value={value}>{children}</RouterCtx.Provider>;
}

/** Заголовок вкладки для маршрута. Страницы с динамическим заголовком (товар) ставят свой поверх. */
function RouteTitle({ title }) {
  const { pathname } = useLocation();
  useEffect(() => {
    if (title) document.title = title;
  }, [title, pathname]);
  return null;
}

export const useLocation = () => useContext(RouterCtx).location;
export const useNavigate = () => useContext(RouterCtx).navigate;
export const useParams = () => useContext(ParamsCtx).params;

/** Параметры строки запроса как объект + функция обновления. */
export function useSearch() {
  const { location, navigate } = useContext(RouterCtx);
  const params = useMemo(
    () => Object.fromEntries(new URLSearchParams(location.search)),
    [location.search],
  );
  const setParams = useCallback(
    (next) => {
      const sp = new URLSearchParams();
      Object.entries(next).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') sp.set(k, v);
      });
      const qs = sp.toString();
      navigate(location.pathname + (qs ? `?${qs}` : ''), { replace: true, keepScroll: true });
    },
    [location.pathname, navigate],
  );
  return [params, setParams];
}

export function matchPath(pattern, pathname) {
  const wildcard = pattern.endsWith('/*');
  const pParts = pattern.replace(/\/\*$/, '').split('/').filter(Boolean);
  const uParts = pathname.split('/').filter(Boolean);
  if (!wildcard && pParts.length !== uParts.length) return null;
  if (wildcard && uParts.length < pParts.length) return null;
  const params = {};
  for (let i = 0; i < pParts.length; i++) {
    const p = pParts[i];
    if (p.startsWith(':')) params[p.slice(1)] = decodeURIComponent(uParts[i]);
    else if (p !== uParts[i]) return null;
  }
  return params;
}

/**
 * Рендерит первый подходящий маршрут. routes: [{ path, element, title? }]
 * title (и fallbackTitle) задают document.title; задавайте их только на верхнем уровне,
 * иначе внешний Routes перезапишет заголовок вложенного.
 */
export function Routes({ routes, fallback = null, fallbackTitle }) {
  const { pathname } = useLocation();
  for (const r of routes) {
    const params = matchPath(r.path, pathname);
    if (params) {
      return (
        <ParamsCtx.Provider value={{ params }}>
          {r.title && <RouteTitle title={r.title} />}
          {r.element}
        </ParamsCtx.Provider>
      );
    }
  }
  return (
    <>
      {fallbackTitle && <RouteTitle title={fallbackTitle} />}
      {fallback}
    </>
  );
}

export function Link({ to, state, replace, onClick, children, ...rest }) {
  const navigate = useNavigate();
  return (
    <a
      href={to}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || rest.target) return;
        e.preventDefault();
        navigate(to, { state, replace });
      }}
      {...rest}
    >
      {children}
    </a>
  );
}

export function NavLink({ to, end = false, className = '', activeClassName = 'is-active', ...rest }) {
  const { pathname } = useLocation();
  const active = end ? pathname === to : pathname === to || pathname.startsWith(to + '/');
  return (
    <Link
      to={to}
      aria-current={active ? 'page' : undefined}
      className={[className, active ? activeClassName : ''].filter(Boolean).join(' ')}
      {...rest}
    />
  );
}

export function Navigate({ to, replace = true, state }) {
  const navigate = useNavigate();
  useEffect(() => {
    navigate(to, { replace, state });
  }, [to]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
