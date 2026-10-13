// Подключение к SignalR-хабу чата (/hubs/chat) — одно на вкладку, общее для виджета «Написать нам»,
// страницы чата в админке и бейджа в её меню. Пока есть хоть один пользователь (useChatHub), соединение
// держится и само переподключается; токен берётся из того же хранилища, что и у REST-клиента.
// Соединение привязано к токену, с которым создано: сменился токен (выход/вход другим пользователем) —
// старое соединение останавливаем и создаём новое, даже в пределах паузы перед закрытием.
import { useEffect, useRef, useState } from 'react';
import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr';
import { API_URL, tokenStore } from '../api/client.js';

let connection = null;
let connectionToken = null;
let refs = 0;
let stopTimer = null;
let retryTimer = null;
let state = 'Disconnected';
const stateListeners = new Set();
// Подписчики на замену самого объекта соединения (все useChatHub должны перейти на новое)
const connListeners = new Set();

function emit(next) {
  state = next;
  stateListeners.forEach((fn) => fn(next));
}

function build(token) {
  const c = new HubConnectionBuilder()
    // Токен фиксирован для этого соединения: чужой (новый) токен — значит, нужно новое соединение.
    .withUrl(`${API_URL}/hubs/chat`, { accessTokenFactory: () => token || '' })
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

function dispose() {
  const c = connection;
  connection = null;
  connectionToken = null;
  clearTimeout(retryTimer);
  c?.stop().catch(() => {});
}

function acquire() {
  refs++;
  clearTimeout(stopTimer);
  const token = tokenStore.get();
  if (connection && connectionToken !== token) {
    // Соединение открыто под другим пользователем/старым токеном — не переиспользуем.
    dispose();
    emit('Disconnected');
  }
  if (!connection) {
    connection = build(token);
    connectionToken = token;
    connListeners.forEach((fn) => fn(connection));
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
    dispose();
    emit('Disconnected');
  }, 1000);
}

/**
 * Соединение с хабом, пока enabled (обычно — пока пользователь вошёл). connected — можно вызывать методы.
 * При смене токена (вход другим пользователем) соединение пересоздаётся.
 */
export function useChatHub(enabled) {
  const [current, setCurrent] = useState(state);
  const [conn, setConn] = useState(null);
  // Компоненты с useAuth перерисовываются при смене сессии — тогда и видим новый токен.
  const token = enabled ? tokenStore.get() : null;

  useEffect(() => {
    if (!enabled) {
      setConn(null);
      return undefined;
    }
    const c = acquire();
    setConn(c);
    setCurrent(state);
    stateListeners.add(setCurrent);
    connListeners.add(setConn);
    return () => {
      stateListeners.delete(setCurrent);
      connListeners.delete(setConn);
      release();
    };
  }, [enabled, token]);

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
