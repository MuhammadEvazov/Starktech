import { useCallback, useEffect, useRef, useState } from 'react';

/** Загрузка данных: { data, error, loading, reload, setData } */
export function useAsync(fn, deps = []) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const seq = useRef(0);

  const run = useCallback(() => {
    const id = ++seq.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    return Promise.resolve()
      .then(fn)
      .then(
        (data) => id === seq.current && setState({ data, error: null, loading: false }),
        (error) => id === seq.current && setState({ data: null, error, loading: false }),
      );
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    run();
  }, [run]);

  const setData = useCallback((updater) => {
    setState((s) => ({ ...s, data: typeof updater === 'function' ? updater(s.data) : updater }));
  }, []);

  return { ...state, reload: run, setData };
}

/** Обёртка для кнопок-действий: pending + ошибка. */
export function useAction(fn) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  const run = useCallback(
    async (...args) => {
      setPending(true);
      setError(null);
      try {
        return await fn(...args);
      } catch (e) {
        setError(e);
        throw e;
      } finally {
        setPending(false);
      }
    },
    [fn],
  );
  return { run, pending, error, setError };
}

export function useDebounced(value, delay = 350) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}
