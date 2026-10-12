// Подключение к SignalR-хабу чата (/hubs/chat) — одно на вкладку, общее для виджета «Написать нам»,
// страницы чата в админке и бейджа в её меню. Пока есть хоть один пользователь (useChatHub), соединение
// держится и само переподключается; токен берётся из того же хранилища, что и у REST-клиента.
import { useEffect, useRef, useState } from 'react';
import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr';
import { API_URL, tokenStore } from '../api/client.js';

let connection = null;
let refs = 0;
let stopTimer = null;
let retryTimer = null;
let state = 'Disconnected';
const stateListeners = new Set();

function emit(next) {
  state = next;
  stateListeners.forEach((fn) => fn(next));
}

function build() {
  const c = new HubConnectionBuilder()
    .withUrl(`${API_URL}/hubs/chat`, { accessTokenFactory: () => tokenStore.get() || '' })
    // Переподключаемся бесконечно: 0с, 1с, 2с, 4с… но не реже раза в 30 секунд.
    .withAutomaticReconnect({ nextRetryDelayInMilliseconds: (ctx) => Math.min(30000, 1000 * 2 ** ctx.previousRetryCount) })
    .configureLogging(LogLevel.Warning)
    .build();

  c.onreconnecting(() => connection === c && emit('Reconnecting'));
  c.onreconnected(() => connection === c && emit('Connected'));
  c.onclose(() => {
    if (connection !== c) return;
    emit('Disconnected');
    scheduleStart(3000);
  });
  return c;
}

function scheduleStart(delay) {
  clearTimeout(retryTimer);
  if (refs > 0 && connection) retryTimer = setTimeout(start, delay);
}

async function start() {
  const c = connection;
  if (!c || c.state !== 'Disconnected') return;
  emit('Connecting');
  try {
    await c.start();
    if (connection === c) emit('Connected');
  } catch {
    // Бэкенд недоступен или токен истёк — пробуем снова, пока чат кому-то нужен.
    if (connection === c) {
      emit('Disconnected');
      scheduleStart(5000);
    }
  }
}

function acquire() {
  refs++;
  clearTimeout(stopTimer);
  if (!connection) {
    connection = build();
    start();
  }
  return connection;
}

function release() {
  refs = Math.max(0, refs - 1);
  if (refs > 0) return;
  // Небольшая пауза: StrictMode и переходы между страницами не рвут соединение зря.
  clearTimeout(stopTimer);
  stopTimer = setTimeout(() => {
    if (refs > 0 || !connection) return;
    const c = connection;
    connection = null;
    clearTimeout(retryTimer);
    c.stop().catch(() => {});
    emit('Disconnected');
  }, 1000);
}

/** Соединение с хабом, пока enabled (обычно — пока пользователь вошёл). connected — можно вызывать методы. */
export function useChatHub(enabled) {
  const [current, setCurrent] = useState(state);
  const [conn, setConn] = useState(null);

  useEffect(() => {
    if (!enabled) {
      setConn(null);
      return undefined;
    }
    const c = acquire();
    setConn(c);
    setCurrent(state);
    stateListeners.add(setCurrent);
    return () => {
      stateListeners.delete(setCurrent);
      release();
    };
  }, [enabled]);

  return { connection: conn, state: current, connected: !!conn && current === 'Connected' };
}

/** Подписка на событие хаба; обработчик всегда свежий, переподписка не нужна. */
export function useHubEvent(connection, name, handler) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    if (!connection) return undefined;
    const fn = (...args) => ref.current(...args);
    connection.on(name, fn);
    return () => connection.off(name, fn);
  }, [connection, name]);
}
