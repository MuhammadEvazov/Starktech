import { useEffect, useState } from 'react';
import { useAsync, useDebounced } from '../../lib/hooks.js';
import { fromInputDate, toInputDate } from '../../lib/format.js';
import { useToast } from '../../context/ToastContext.jsx';
import { EditIcon, TrashIcon } from './icons.jsx';
import { Checkbox, Empty, ErrorBox, Input, Modal, Pagination, Select, Spinner, Textarea } from '../../components/ui.jsx';

/**
 * Универсальная таблица + форма создания/редактирования.
 * fields: [{ name, label, type: text|number|textarea|checkbox|select|datetime, options, required, edit: false, create: false, wide }]
 * filters: [{ name, label, type: text|select|bool, options }]
 */
export default function CrudPage({
  title,
  lead,
  api,
  columns,
  fields,
  filters = [],
  baseQuery = {},
  defaults = {},
  toPayload = (f) => f,
  rowActions,
  canCreate = true,
  canEdit = true,
  canDelete = true,
  createLabel = 'Добавить',
  extraForm,
  onSaved,
  embedded,
  renderCard, // (row) => JSX — показать записи карточками вместо таблицы
  headerActions, // доп. кнопки в шапке рядом с «Добавить»
  reloadKey, // смена значения перезагружает список (например, после восстановления)
  deleteConfirm, // { title, text(row), action, done } — тексты окна удаления
  validate, // (form, mode, item) => текст ошибки | массив текстов | null — проверка до отправки
}) {
  const toast = useToast();
  const [query, setQuery] = useState({ page: 1, pageSize: 20 });
  const list = useAsync(
    () => api.list({ ...baseQuery, ...query }),
    [JSON.stringify(query), JSON.stringify(baseQuery), reloadKey],
  );
  const [editing, setEditing] = useState(null);
  const [removing, setRemoving] = useState(null);

  // Удаление подтверждается в модальном окне, а не системным confirm().
  const remove = (row) => setRemoving(row);
  const confirmRemove = async () => {
    await api.remove(removing.id);
    toast(deleteConfirm?.done || 'Удалено');
    setRemoving(null);
    list.reload();
  };

  const Heading = embedded ? 'h3' : 'h1';

  return (
    <section className={embedded ? 'crud crud--embedded' : 'crud'}>
      <header className="admin-head">
        <div>
          <Heading className={embedded ? 'subhead' : 'admin-title'}>{title}</Heading>
          {lead && <p className="muted">{lead}</p>}
        </div>
        {(canCreate || headerActions) && (
          <div className="admin-head__actions">
            {headerActions}
            {canCreate && (
              <button type="button" className="btn btn--primary" onClick={() => setEditing({ mode: 'create', item: null })}>
                {createLabel}
              </button>
            )}
          </div>
        )}
      </header>

      {filters.length > 0 && (
        <FilterBar
          filters={filters}
          query={query}
          total={list.data?.totalCount}
          onChange={(name, v) => setQuery((q) => ({ ...q, [name]: v, page: 1 }))}
          onReset={() => setQuery((q) => ({ page: 1, pageSize: q.pageSize }))}
        />
      )}

      {list.loading && !list.data ? (
        <Spinner />
      ) : list.error ? (
        <ErrorBox error={list.error} onRetry={list.reload} />
      ) : !list.data?.items?.length ? (
        <Empty title="Записей нет">{canCreate ? 'Нажмите «' + createLabel + '», чтобы создать первую.' : null}</Empty>
      ) : (
        <>
          {renderCard ? (
            <ul className="crud-cards">
              {list.data.items.map((row) => (
                <li key={row.id} className="crud-card">
                  {renderCard(row)}
                  <div className="crud-card__actions">
                    {rowActions?.(row, list.reload)}
                    {canEdit && (
                      <button
                        type="button"
                        className="icon-action icon-action--edit"
                        aria-label="Изменить"
                        title="Изменить"
                        onClick={() => setEditing({ mode: 'edit', item: row })}
                      >
                        <EditIcon />
                      </button>
                    )}
                    {canDelete && (
                      <button type="button" className="icon-action icon-action--delete" aria-label="Удалить" title="Удалить" onClick={() => remove(row)}>
                        <TrashIcon />
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  {columns.map((c) => (
                    <th key={c.key} className={c.align === 'right' ? 'num' : ''}>
                      {c.label}
                    </th>
                  ))}
                  <th aria-label="Действия" />
                </tr>
              </thead>
              <tbody>
                {list.data.items.map((row) => (
                  <tr key={row.id}>
                    {columns.map((c) => (
                      <td key={c.key} className={c.align === 'right' ? 'num' : ''}>
                        {c.render ? c.render(row) : row[c.key] ?? '—'}
                      </td>
                    ))}
                    <td className="row-actions">
                      {rowActions?.(row, list.reload)}
                      {canEdit && (
                        <button
                          type="button"
                          className="icon-action icon-action--edit"
                          aria-label="Изменить"
                          title="Изменить"
                          onClick={() => setEditing({ mode: 'edit', item: row })}
                        >
                          <EditIcon />
                        </button>
                      )}
                      {canDelete && (
                        <button type="button" className="icon-action icon-action--delete" aria-label="Удалить" title="Удалить" onClick={() => remove(row)}>
                          <TrashIcon />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
          {/* С фильтрами счётчик стоит в панели фильтров */}
          {filters.length === 0 && <p className="muted small">Всего: {list.data.totalCount}</p>}
          <Pagination page={list.data.page} totalPages={list.data.totalPages} onChange={(p) => setQuery((q) => ({ ...q, page: p }))} />
        </>
      )}

      {removing && (
        <ConfirmDelete
          title={deleteConfirm?.title || 'Удалить запись?'}
          text={deleteConfirm?.text ? deleteConfirm.text(removing) : 'Запись удалится без возможности восстановления.'}
          action={deleteConfirm?.action || 'Удалить'}
          onCancel={() => setRemoving(null)}
          onConfirm={confirmRemove}
        />
      )}

      {editing && (
        <CrudForm
          title={editing.mode === 'create' ? createLabel : 'Редактирование'}
          mode={editing.mode}
          item={editing.item}
          fields={fields}
          defaults={defaults}
          extraForm={extraForm}
          onClose={() => setEditing(null)}
          onSubmit={async (form) => {
            const problems = [].concat(validate?.(form, editing.mode, editing.item) || []).filter(Boolean);
            if (problems.length) throw { messages: problems };
            const payload = toPayload(form, editing.mode, editing.item);
            const saved =
              editing.mode === 'create' ? await api.create(payload) : await api.update(editing.item.id, payload);
            toast(editing.mode === 'create' ? 'Создано' : 'Сохранено');
            setEditing(null);
            list.reload();
            onSaved?.(saved, editing.mode);
          }}
        />
      )}
    </section>
  );
}

/** Единое окно подтверждения удаления/необратимого действия во всей админке. */
export function ConfirmDelete({ title, text, action = 'Удалить', onCancel, onConfirm }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
    } catch (e) {
      setError(e);
      setBusy(false);
    }
  };

  return (
    <Modal title={title} onClose={busy ? () => {} : onCancel}>
      <div className="confirm">
        <span className="confirm__icon" aria-hidden="true">
          <TrashIcon />
        </span>
        <p className="confirm__text">{text}</p>
      </div>
      <ErrorBox error={error} />
      <div className="form-actions">
        <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={busy}>
          Отмена
        </button>
        <button type="button" className="btn btn--danger" onClick={confirm} disabled={busy}>
          {busy ? 'Удаляем…' : action}
        </button>
      </div>
    </Modal>
  );
}

// ─── Фильтры ─────────────────────────────────────────────────────────────────
// Текстовые фильтры — крупный поиск, да/нет — сегменты рядом с ним,
// короткие списки — ряд чипов-«стикеров» в один клик, длинные — выпадающий список.
// Чипы — кнопки-переключатели (aria-pressed): стрелочной навигации, как у radiogroup, у них нет.
const CHIP_LIMIT = 8;

const filterOptions = (f) =>
  f.type === 'bool'
    ? [
        { value: 'true', label: f.trueLabel || 'Да' },
        { value: 'false', label: f.falseLabel || 'Нет' },
      ]
    : f.options ?? [];

/**
 * Панель фильтров списка — общая для всех разделов (в том числе вне CrudPage: пользователи, отзывы, монеты…).
 * total — число записей: «Всего», пока фильтры не заданы, «Найдено» — когда заданы.
 */
export function FilterBar({ filters, query, total, onChange, onReset }) {
  const [resetKey, setResetKey] = useState(0);
  const texts = filters.filter((f) => !f.type || f.type === 'text' || f.type === 'search');
  const toggles = filters.filter((f) => f.type === 'bool');
  const lists = filters.filter((f) => f.type === 'select');
  const active = filters.some((f) => query[f.name] !== undefined && query[f.name] !== '');

  const reset = () => {
    setResetKey((k) => k + 1); // очищает локальное значение поиска
    onReset();
  };

  return (
    <div className="filterbar" role="search">
      <div className="filterbar__top">
        {texts.map((f) => (
          <SearchFilter key={`${f.name}-${resetKey}`} filter={f} value={query[f.name] ?? ''} onChange={(v) => onChange(f.name, v)} />
        ))}
        {toggles.map((f) => (
          <ChipGroup key={f.name} filter={f} value={query[f.name] ?? ''} onChange={(v) => onChange(f.name, v)} variant="segment" />
        ))}
        <div className="filterbar__meta" aria-live="polite">
          {total !== undefined && total !== null && (
            <span className="filterbar__count">
              {active ? 'Найдено' : 'Всего'}: {total}
            </span>
          )}
          {active && (
            <button type="button" className="filterbar__reset" onClick={reset}>
              Сбросить
            </button>
          )}
        </div>
      </div>
      {lists.map((f) => {
        const options = filterOptions(f);
        return options.length > CHIP_LIMIT ? (
          <Select
            key={f.name}
            className="filterbar__select"
            label={f.label}
            placeholder={f.allLabel || 'Все'}
            options={options}
            value={query[f.name] ?? ''}
            onChange={(e) => onChange(f.name, e.target.value)}
          />
        ) : (
          options.length > 0 && (
            <ChipGroup key={f.name} filter={f} value={query[f.name] ?? ''} onChange={(v) => onChange(f.name, v)} variant="chips" />
          )
        );
      })}
    </div>
  );
}

function SearchFilter({ filter, value, onChange }) {
  const [text, setText] = useState(value);
  const debounced = useDebounced(text, 300);

  useEffect(() => {
    if (debounced !== value) onChange(debounced);
  }, [debounced]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <label className="search-field">
      <span className="sr-only">{filter.label}</span>
      <svg className="search-field__icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <input
        type="search"
        className="search-field__input"
        placeholder={filter.placeholder || `Найти: ${filter.label.toLowerCase()}`}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
    </label>
  );
}

function ChipGroup({ filter, value, onChange, variant }) {
  const options = [{ value: '', label: filter.allLabel || 'Все' }, ...filterOptions(filter)];
  return (
    <div className={`chip-group chip-group--${variant}`} role="group" aria-label={filter.label}>
      {options.map((o) => {
        const on = String(value) === String(o.value);
        return (
          <button
            key={o.value || 'all'}
            type="button"
            aria-pressed={on}
            className={`fchip ${on ? 'is-on' : ''}`}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Время магазина (Душанбе, UTC+5, без летнего времени) ─────────────────────
// Поле datetime с zone: 'shop' показывает местное время магазина, а на сервер уходит строка
// без зоны — бэкенд переводит её в UTC через ShopClock.FromLocal.
const SHOP_OFFSET_MS = 5 * 60 * 60 * 1000;

/** UTC с сервера → значение <input type="datetime-local"> по времени Душанбе. */
export function toShopInput(iso) {
  if (!iso) return '';
  const s = String(iso);
  const utc = new Date(/[zZ]$|[+-]\d\d:?\d\d$/.test(s) ? s : `${s}Z`);
  if (Number.isNaN(utc.getTime())) return '';
  return new Date(utc.getTime() + SHOP_OFFSET_MS).toISOString().slice(0, 16);
}

/** Значение поля (время Душанбе) → строка без зоны для сервера. */
export const fromShopInput = (v) => (v ? (v.length === 16 ? `${v}:00` : v) : null);

/** Дата по времени Душанбе — для списков промокодов и комбо. */
export const shopDate = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Dushanbe' })
    : '—';

function initialForm(fields, item, defaults) {
  const form = {};
  fields.forEach((f) => {
    let v = item ? item[f.name] : defaults[f.name];
    if (f.type === 'datetime') v = f.zone === 'shop' ? toShopInput(v) : toInputDate(v);
    if (f.type === 'checkbox') v = v ?? (item ? false : f.default ?? true);
    form[f.name] = v ?? (f.type === 'checkbox' ? false : '');
  });
  return form;
}

export function normalize(fields, form) {
  const out = { ...form };
  fields.forEach((f) => {
    const v = form[f.name];
    if (f.type === 'number') out[f.name] = v === '' || v === null ? (f.nullable ? null : 0) : Number(v);
    else if (f.type === 'datetime') out[f.name] = f.zone === 'shop' ? fromShopInput(v) : fromInputDate(v);
    else if (f.type === 'checkbox') out[f.name] = !!v;
    else if (v === '' && f.nullable !== false && !f.required) out[f.name] = null;
  });
  return out;
}

function CrudForm({ title, mode, item, fields, defaults, onClose, onSubmit, extraForm }) {
  const [form, setForm] = useState(() => initialForm(fields, item, defaults));
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const visible = fields.filter((f) => (mode === 'create' ? f.create !== false : f.edit !== false));
  const set = (name, v) => setForm((f) => ({ ...f, [name]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onSubmit(normalize(fields, form));
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={title} onClose={onClose} wide={visible.length > 6}>
      <form onSubmit={submit} className="form-grid">
        {visible.map((f) => {
          const cls = f.wide || f.type === 'textarea' ? 'form-grid__wide' : '';
          if (f.type === 'checkbox')
            return (
              <div key={f.name} className={cls}>
                <Checkbox label={f.label} checked={form[f.name]} onChange={(v) => set(f.name, v)} />
              </div>
            );
          if (f.type === 'textarea')
            return <Textarea key={f.name} className={cls} label={f.label} hint={f.hint} value={form[f.name]} onChange={(e) => set(f.name, e.target.value)} />;
          if (f.type === 'select')
            return (
              <Select
                key={f.name} className={cls}
                label={f.label}
                hint={f.hint}
                required={f.required}
                placeholder={f.placeholder ?? (f.required ? undefined : '—')}
                options={typeof f.options === 'function' ? f.options(form) : f.options}
                value={form[f.name]}
                onChange={(e) => set(f.name, e.target.value)}
              />
            );
          return (
            <Input
              key={f.name} className={cls}
              label={f.label}
              hint={f.hint}
              required={f.required}
              type={f.type === 'datetime' ? 'datetime-local' : f.type || 'text'}
              step={f.type === 'number' ? f.step || 'any' : undefined}
              min={f.min}
              value={form[f.name]}
              onChange={(e) => set(f.name, e.target.value)}
            />
          );
        })}
        {extraForm && <div className="form-grid__wide">{extraForm(form, set, mode, item)}</div>}
        <div className="form-grid__wide">
          <ErrorBox error={error} />
        </div>
        <div className="form-grid__wide form-actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Отмена
          </button>
          <button className="btn btn--primary" disabled={busy}>
            {busy ? 'Сохраняем…' : 'Сохранить'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
