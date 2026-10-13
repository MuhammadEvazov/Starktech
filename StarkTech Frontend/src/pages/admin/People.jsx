import { useState } from 'react';
import { useAsync } from '../../lib/hooks.js';
import { coinsApi, notificationsApi, permissionsApi, telegramApi, usersApi } from '../../api/endpoints.js';
import {
  COIN_TYPE, date, dateTime, NOTIFICATION_CHANNEL, NOTIFICATION_STATUS, PERMISSION_LABELS, ROLES,
} from '../../lib/format.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { Async, Badge, Empty, ErrorBox, Img, Input, Modal, Pagination } from '../../components/ui.jsx';
import { ConfirmDelete, FilterBar } from './CrudPage.jsx';
import { TrashIcon } from './icons.jsx';

const opts = (o) => Object.entries(o).map(([value, label]) => ({ value, label }));
const roleOptions = opts(ROLES);

/** Состояние фильтров списка: смена фильтра возвращает на первую страницу. */
function useListQuery(initial = { page: 1 }) {
  const [query, setQuery] = useState(initial);
  return {
    query,
    setPage: (page) => setQuery((q) => ({ ...q, page })),
    onChange: (name, v) => setQuery((q) => ({ ...q, [name]: v, page: 1 })),
    onReset: () => setQuery({ page: 1 }),
  };
}

const USER_FILTERS = [
  { name: 'fullName', label: 'Имя', placeholder: 'Найти по имени' },
  { name: 'email', label: 'Email', placeholder: 'Email' },
  { name: 'phone', label: 'Телефон', placeholder: 'Телефон' },
  { name: 'role', label: 'Роль', type: 'select', options: roleOptions, allLabel: 'Все роли' },
];
const COIN_FILTERS = [
  { name: 'userId', label: 'ID профиля', placeholder: 'ID профиля клиента' },
  { name: 'type', label: 'Тип', type: 'select', options: opts(COIN_TYPE), allLabel: 'Все типы' },
];
const NOTIFICATION_FILTERS = [
  { name: 'channel', label: 'Канал', type: 'select', options: opts(NOTIFICATION_CHANNEL), allLabel: 'Все каналы' },
  { name: 'status', label: 'Статус', type: 'select', options: opts(NOTIFICATION_STATUS), allLabel: 'Любой статус' },
];

/* ───────── Пользователи ───────── */
export function Users() {
  const toast = useToast();
  const { session } = useAuth();
  const q = useListQuery();
  const [rolesFor, setRolesFor] = useState(null);
  const [removing, setRemoving] = useState(null);
  const list = useAsync(() => usersApi.list({ ...q.query, pageSize: 20 }), [JSON.stringify(q.query)]);

  return (
    <>
      <header className="admin-head">
        <h1 className="admin-title">Пользователи</h1>
      </header>
      <FilterBar filters={USER_FILTERS} query={q.query} total={list.data?.totalCount} onChange={q.onChange} onReset={q.onReset} />
      <Async state={list} empty={<Empty title="Никого не нашлось">Измените фильтры.</Empty>}>
        {(data) => (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Пользователь</th>
                    <th>Телефон</th>
                    <th>Роли</th>
                    <th>Регистрация</th>
                    <th aria-label="Действия" />
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((u) => (
                    <tr key={u.id}>
                      <td>
                        <div className="user-cell">
                          <Img src={u.avatarUrl || u.photoPath} className="avatar" alt="" fallback={<span className="avatar avatar--empty">{(u.fullName || u.email || '?')[0]}</span>} />
                          <div>
                            <strong>{u.fullName || '—'}</strong>
                            <span className="muted small block">{u.email}</span>
                          </div>
                        </div>
                      </td>
                      <td>{u.phoneNumber || '—'}</td>
                      <td>
                        <span className="badges">
                          {u.roles.map((r) => (
                            <Badge key={r} tone={r === 'Client' ? 'grey' : 'blue'}>{ROLES[r] || r}</Badge>
                          ))}
                        </span>
                      </td>
                      <td>{date(u.registerAt)}</td>
                      <td className="row-actions">
                        <button type="button" className="btn btn--small btn--ghost" onClick={() => setRolesFor(u)}>
                          Роли
                        </button>
                        {u.id !== session?.userId && (
                          <button
                            type="button"
                            className="icon-action icon-action--delete"
                            aria-label={`Удалить пользователя ${u.email}`}
                            title="Удалить"
                            onClick={() => setRemoving(u)}
                          >
                            <TrashIcon />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={data.page} totalPages={data.totalPages} onChange={q.setPage} />
          </>
        )}
      </Async>
      {removing && (
        <ConfirmDelete
          title="Удалить пользователя?"
          text={`${removing.fullName || removing.email} (${removing.email}) потеряет доступ к аккаунту. Удаление нельзя отменить.`}
          onCancel={() => setRemoving(null)}
          onConfirm={async () => {
            await usersApi.remove(removing.id);
            setRemoving(null);
            toast('Пользователь удалён');
            list.reload();
          }}
        />
      )}
      {rolesFor && (
        <RolesModal
          user={rolesFor}
          onClose={() => setRolesFor(null)}
          onChanged={(roles) => {
            setRolesFor((u) => ({ ...u, roles }));
            list.reload();
          }}
        />
      )}
    </>
  );
}

function RolesModal({ user, onClose, onChanged }) {
  const toast = useToast();
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);

  const toggle = async (role, on) => {
    setBusy(role);
    setError(null);
    try {
      if (on) await usersApi.assignRole(user.id, role);
      else await usersApi.removeRole(user.id, role);
      onChanged(on ? [...user.roles, role] : user.roles.filter((r) => r !== role));
      toast(on ? `Роль «${ROLES[role]}» выдана` : `Роль «${ROLES[role]}» снята`);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal title={`Роли: ${user.fullName || user.email}`} onClose={onClose}>
      <div className="stack">
        {Object.entries(ROLES).map(([role, label]) => {
          const has = user.roles.includes(role);
          return (
            <div key={role} className="role-row">
              <div>
                <strong>{label}</strong>
                <span className="muted small block">
                  {role === 'Client' && 'Покупатель: свои заказы, отзывы'}
                  {role === 'Admin' && 'Заказы, каталог, маркетинг'}
                  {role === 'SuperAdmin' && 'Всё, включая пользователей, права и монеты'}
                </span>
              </div>
              <button
                type="button"
                className={`btn btn--small ${has ? 'btn--quiet' : 'btn--primary'}`}
                disabled={busy === role}
                onClick={() => toggle(role, !has)}
              >
                {has ? 'Снять' : 'Выдать'}
              </button>
            </div>
          );
        })}
        <ErrorBox error={error} />
      </div>
    </Modal>
  );
}

/* ───────── Монеты ───────── */
export function Coins() {
  const toast = useToast();
  const q = useListQuery();
  const [adjusting, setAdjusting] = useState(false);
  const list = useAsync(() => coinsApi.list({ ...q.query, pageSize: 20 }), [JSON.stringify(q.query)]);

  return (
    <>
      <header className="admin-head">
        <div>
          <h1 className="admin-title">Монеты</h1>
          <p className="muted">Клиенты получают монеты за доставленные заказы и тратят их при оформлении.</p>
        </div>
        <button type="button" className="btn btn--primary" onClick={() => setAdjusting(true)}>
          Начислить или списать
        </button>
      </header>
      <FilterBar filters={COIN_FILTERS} query={q.query} total={list.data?.totalCount} onChange={q.onChange} onReset={q.onReset} />
      <Async state={list} empty={<Empty title="Операций нет">Монеты начисляются за доставленные заказы.</Empty>}>
        {(data) => (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Клиент</th>
                    <th>Тип</th>
                    <th className="num">Сумма</th>
                    <th>Комментарий</th>
                    <th>Дата</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((t) => (
                    <tr key={t.id}>
                      <td>
                        {t.userFullName || '—'}
                        <span className="muted small block mono-id">{t.userId}</span>
                      </td>
                      <td>{COIN_TYPE[t.type] || t.type}</td>
                      <td className={`num ${t.amount < 0 ? 'neg' : 'pos'}`}>{t.amount > 0 ? `+${t.amount}` : t.amount}</td>
                      <td>{t.description || '—'}</td>
                      <td>{dateTime(t.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={data.page} totalPages={data.totalPages} onChange={q.setPage} />
          </>
        )}
      </Async>
      {adjusting && (
        <AdjustModal
          onClose={() => setAdjusting(false)}
          onDone={() => {
            setAdjusting(false);
            toast('Баланс изменён');
            list.reload();
          }}
        />
      )}
    </>
  );
}

function AdjustModal({ onClose, onDone }) {
  const [form, setForm] = useState({ userId: '', amount: '', description: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  return (
    <Modal title="Корректировка монет" onClose={onClose}>
      <form
        className="stack"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          try {
            await coinsApi.adjust({ userId: form.userId.trim(), amount: Number(form.amount), description: form.description || null });
            onDone();
          } catch (err) {
            setError(err);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Input label="ID профиля клиента" required hint="Guid профиля, его видно в заказе клиента" value={form.userId} onChange={set('userId')} />
        <Input label="Сумма" type="number" step="1" required hint="Положительная начисляет, отрицательная списывает" value={form.amount} onChange={set('amount')} />
        <Input label="Комментарий" value={form.description} onChange={set('description')} />
        <ErrorBox error={error} />
        <button className="btn btn--primary" disabled={busy}>{busy ? 'Сохраняем…' : 'Применить'}</button>
      </form>
    </Modal>
  );
}

/* ───────── Права ролей ───────── */
export function Permissions() {
  const toast = useToast();
  const list = useAsync(() => permissionsApi.all(), []);
  const [pending, setPending] = useState(null);

  const toggle = async (role, key, isGranted) => {
    const id = `${role}:${key}`;
    setPending(id);
    try {
      await permissionsApi.set(role, key, isGranted);
      list.setData((rows) => {
        const exists = rows.some((r) => r.role === role && r.permissionKey === key);
        return exists
          ? rows.map((r) => (r.role === role && r.permissionKey === key ? { ...r, isGranted } : r))
          : [...rows, { id, role, permissionKey: key, isGranted }];
      });
      toast('Права обновлены');
    } catch (e) {
      toast(e.messages?.[0] || 'Не удалось сохранить', 'error');
    } finally {
      setPending(null);
    }
  };

  return (
    <>
      <header className="admin-head">
        <div>
          <h1 className="admin-title">Права ролей</h1>
          <p className="muted">Изменения применяются сразу, перелогин не нужен.</p>
        </div>
      </header>
      <Async state={list} empty={<Empty title="Права не загрузились">Обновите страницу или попробуйте позже.</Empty>}>
        {(rows) => {
          const keys = [...new Set([...Object.keys(PERMISSION_LABELS), ...rows.map((r) => r.permissionKey)])];
          const granted = (role, key) => rows.find((r) => r.role === role && r.permissionKey === key)?.isGranted ?? false;
          return (
            <div className="table-wrap">
              <table className="table matrix">
                <thead>
                  <tr>
                    <th>Право</th>
                    <th>{ROLES.Admin}</th>
                    <th>{ROLES.SuperAdmin}</th>
                  </tr>
                </thead>
                <tbody>
                  {keys.map((key) => (
                    <tr key={key}>
                      <td>
                        {PERMISSION_LABELS[key] || key}
                        <span className="muted small block">{key}</span>
                      </td>
                      {['Admin', 'SuperAdmin'].map((role) => (
                        <td key={role}>
                          <label className="switch">
                            <input
                              type="checkbox"
                              checked={granted(role, key)}
                              disabled={pending === `${role}:${key}`}
                              onChange={(e) => toggle(role, key, e.target.checked)}
                              aria-label={`${PERMISSION_LABELS[key] || key}: ${ROLES[role]}`}
                            />
                            <span />
                          </label>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }}
      </Async>
    </>
  );
}

/* ───────── Уведомления ───────── */
export function Notifications() {
  const q = useListQuery();
  const list = useAsync(() => notificationsApi.list({ ...q.query, pageSize: 30 }), [JSON.stringify(q.query)]);
  return (
    <>
      <header className="admin-head">
        <div>
          <h1 className="admin-title">Уведомления</h1>
          <p className="muted">Сообщения о смене статуса заказов, отправленные клиентам и администраторам.</p>
        </div>
      </header>
      <FilterBar filters={NOTIFICATION_FILTERS} query={q.query} total={list.data?.totalCount} onChange={q.onChange} onReset={q.onReset} />
      <Async state={list} empty={<Empty title="Уведомлений нет">Они появятся, когда у заказов начнёт меняться статус.</Empty>}>
        {(data) => (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Заказ</th>
                    <th>Канал</th>
                    <th>Статус</th>
                    <th>Текст</th>
                    <th>Дата</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((n) => (
                    <tr key={n.id}>
                      <td>{n.orderNumber || '—'}</td>
                      <td>{NOTIFICATION_CHANNEL[n.channel] || n.channel}</td>
                      <td>{n.status === 'Sent' ? <Badge tone="green">Отправлено</Badge> : <Badge tone="red">Ошибка</Badge>}</td>
                      <td className="cell-wrap">{n.payload || '—'}</td>
                      <td>{dateTime(n.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={data.page} totalPages={data.totalPages} onChange={q.setPage} />
          </>
        )}
      </Async>
    </>
  );
}

/* ───────── Telegram ───────── */
export function Telegram() {
  const toast = useToast();
  const list = useAsync(() => telegramApi.list({ pageSize: 50 }), []);
  const [userId, setUserId] = useState('');
  const [code, setCode] = useState(null);
  const [confirm, setConfirm] = useState({ code: '', telegramChatId: '' });
  const [error, setError] = useState(null);
  const [unlinking, setUnlinking] = useState(null);

  const run = async (fn) => {
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e);
    }
  };

  return (
    <>
      <header className="admin-head">
        <div>
          <h1 className="admin-title">Telegram</h1>
          <p className="muted">Привязка чатов администраторов для уведомлений о заказах.</p>
        </div>
      </header>

      <div className="detail-grid">
        <section className="panel">
          <h2 className="panel__title">1. Получить код привязки</h2>
          <form className="stack" onSubmit={(e) => { e.preventDefault(); run(async () => setCode(await telegramApi.initiate(userId.trim()))); }}>
            <Input label="ID профиля администратора" required value={userId} onChange={(e) => setUserId(e.target.value)} />
            <button className="btn btn--primary">Получить код</button>
          </form>
          {code && (
            <p className="notice notice--ok">
              Код: <strong className="big-code">{code.code}</strong>
              <br />
              Действует до {dateTime(code.expiresAt)}
            </p>
          )}
        </section>
        <section className="panel">
          <h2 className="panel__title">2. Подтвердить привязку</h2>
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault();
              run(async () => {
                await telegramApi.confirm(confirm.code.trim(), confirm.telegramChatId.trim());
                toast('Чат привязан');
                setConfirm({ code: '', telegramChatId: '' });
                list.reload();
              });
            }}
          >
            <Input label="Код" required value={confirm.code} onChange={(e) => setConfirm((c) => ({ ...c, code: e.target.value }))} />
            <Input label="Telegram Chat ID" required value={confirm.telegramChatId} onChange={(e) => setConfirm((c) => ({ ...c, telegramChatId: e.target.value }))} />
            <button className="btn btn--primary">Привязать</button>
          </form>
        </section>
      </div>
      <ErrorBox error={error} />

      <h2 className="subhead">Привязанные чаты</h2>
      <Async state={list} empty={<Empty title="Привязок пока нет" />}>
        {(data) => (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Администратор</th>
                  <th>Chat ID</th>
                  <th>Статус</th>
                  <th>С</th>
                  <th aria-label="Действия" />
                </tr>
              </thead>
              <tbody>
                {data.items.map((b) => (
                  <tr key={b.id}>
                    <td>{b.userFullName || b.userId}</td>
                    <td>{b.telegramChatId}</td>
                    <td>{b.isActive ? <Badge tone="green">Активна</Badge> : <Badge>Отключена</Badge>}</td>
                    <td>{date(b.createdAt)}</td>
                    <td className="row-actions">
                      {b.isActive && (
                        <button
                          type="button"
                          className="btn btn--small btn--quiet"
                          onClick={() => setUnlinking(b)}
                        >
                          Отвязать
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Async>

      {unlinking && (
        <ConfirmDelete
          title="Отвязать чат?"
          text={`${unlinking.userFullName || unlinking.userId} перестанет получать уведомления о заказах в Telegram. Чтобы вернуть их, чат придётся привязать заново с новым кодом.`}
          action="Отвязать"
          onCancel={() => setUnlinking(null)}
          onConfirm={async () => {
            await telegramApi.unlink(unlinking.userId);
            setUnlinking(null);
            toast('Привязка отключена');
            list.reload();
          }}
        />
      )}
    </>
  );
}
