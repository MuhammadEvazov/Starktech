// HTTP-клиент для StarkTech API.
// Бэкенд отвечает обёрткой Result<T>: { isSuccess, data, errors, errorType }.
// Клиент разворачивает её и возвращает data, а ошибки превращает в ApiError
// с понятным списком сообщений.

export const API_URL = (import.meta.env?.VITE_API_URL || '').replace(/\/$/, '');
const TOKEN_KEY = 'st_token';

export const tokenStore = {
  get: () => {
    try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
  },
  set: (t) => {
    try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch { /* приватный режим */ }
  },
};

export class ApiError extends Error {
  constructor(status, messages) {
    const list = messages?.length ? messages : [defaultMessage(status)];
    super(list.join('\n'));
    this.status = status;
    this.messages = list;
  }
}

function defaultMessage(status) {
  if (status === 0) return 'Сервер недоступен. Проверьте, что бэкенд запущен (dotnet run --project WebApi).';
  if (status === 401) return 'Нужно войти в аккаунт.';
  if (status === 403) return 'Недостаточно прав для этого действия.';
  if (status === 404) return 'Не найдено.';
  if (status >= 500) return 'Ошибка на сервере. Подробности — в логах бэкенда (WebApi/Logs).';
  return 'Запрос не выполнен.';
}

function extractMessages(body) {
  if (!body) return [];
  if (typeof body === 'string') return [body];
  if (Array.isArray(body)) return body.map(String);
  if (Array.isArray(body.errors)) return body.errors.map(String);
  // ValidationProblemDetails: { errors: { Field: ["msg"] } }
  if (body.errors && typeof body.errors === 'object') return Object.values(body.errors).flat().map(String);
  if (body.error) return [String(body.error)]; // ExceptionMiddleWare
  if (body.title) return [String(body.title)];
  if (body.message) return [String(body.message)];
  return [];
}

export function assetUrl(path) {
  if (!path) return null;
  if (/^(https?:|blob:|data:)/.test(path)) return path;
  return API_URL + (path.startsWith('/') ? path : `/${path}`);
}

function buildQuery(query) {
  if (!query) return '';
  const sp = new URLSearchParams();
  Object.entries(query).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return;
    sp.set(k, v);
  });
  const s = sp.toString();
  return s ? `?${s}` : '';
}

async function request(method, path, { query, body, form, raw } = {}) {
  const headers = { Accept: 'application/json' };
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;

  let payload;
  if (form) {
    payload = form; // FormData — заголовок Content-Type браузер выставит сам
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(API_URL + path + buildQuery(query), { method, headers, body: payload });
  } catch {
    throw new ApiError(0);
  }

  const text = await res.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); } catch { data = text; }
  }

  if (!res.ok) {
    if (res.status === 401 && token) {
      tokenStore.set(null);
      window.dispatchEvent(new Event('auth:expired'));
    }
    throw new ApiError(res.status, extractMessages(data));
  }

  if (raw) return data;
  if (data && typeof data === 'object' && 'isSuccess' in data) {
    if (!data.isSuccess) throw new ApiError(res.status, extractMessages(data));
    return data.data;
  }
  return data;
}

function fileForm(file, fieldName = 'file', extra = {}) {
  const fd = new FormData();
  fd.append(fieldName, file);
  Object.entries(extra).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') fd.append(k, v);
  });
  return fd;
}

export const http = {
  get: (path, query) => request('GET', path, { query }),
  post: (path, body) => request('POST', path, { body: body ?? {} }),
  put: (path, body) => request('PUT', path, { body: body ?? {} }),
  del: (path) => request('DELETE', path),
  upload: (path, file, { method = 'POST', field = 'file', extra } = {}) =>
    request(method, path, { form: fileForm(file, field, extra) }),
  form: (path, fields, method = 'POST') => {
    const fd = new FormData();
    Object.entries(fields).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') fd.append(k, v);
    });
    return request(method, path, { form: fd });
  },
};
