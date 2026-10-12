import { useState } from 'react';
import { Link } from '../../lib/router.jsx';
import { useAsync } from '../../lib/hooks.js';
import { reviewsApi } from '../../api/endpoints.js';
import { dateTime } from '../../lib/format.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Async, Badge, Empty, Pagination, Select, Stars } from '../../components/ui.jsx';

export default function Reviews() {
  const toast = useToast();
  const [query, setQuery] = useState({ isApproved: 'false', minRating: '', page: 1 });
  const list = useAsync(() => reviewsApi.list({ ...query, pageSize: 20 }), [JSON.stringify(query)]);

  const act = async (fn, msg) => {
    try {
      await fn();
      toast(msg);
      list.reload();
    } catch (e) {
      toast(e.messages?.[0] || 'Ошибка', 'error');
    }
  };

  return (
    <>
      <header className="admin-head">
        <h1 className="admin-title">Отзывы</h1>
      </header>
      <div className="filters">
        <Select
          label="Статус"
          placeholder="Все"
          options={[
            { value: 'false', label: 'На модерации' },
            { value: 'true', label: 'Опубликованы' },
          ]}
          value={query.isApproved}
          onChange={(e) => setQuery((q) => ({ ...q, isApproved: e.target.value, page: 1 }))}
        />
        <Select
          label="Оценка от"
          placeholder="Любая"
          options={[5, 4, 3, 2, 1].map((n) => ({ value: n, label: `${n} ★` }))}
          value={query.minRating}
          onChange={(e) => setQuery((q) => ({ ...q, minRating: e.target.value, page: 1 }))}
        />
      </div>
      <Async state={list} empty={<Empty title="Отзывов нет">{query.isApproved === 'false' ? 'Все отзывы проверены.' : null}</Empty>}>
        {(data) => (
          <>
            <ul className="moderation">
              {data.items.map((r) => (
                <li key={r.id} className="moderation__item">
                  <div className="moderation__meta">
                    <Stars value={r.rating} size="sm" />
                    <strong>{r.userFullName || 'Покупатель'}</strong>
                    {r.productId && (
                      <Link to={`/product/${r.productId}`} target="_blank" rel="noreferrer" className="text-link">
                        {r.productNameEn || 'Товар'}
                      </Link>
                    )}
                    <span className="muted small">{dateTime(r.createdAt)}</span>
                    {r.isApproved ? <Badge tone="green">Опубликован</Badge> : <Badge tone="yellow">Ждёт проверки</Badge>}
                  </div>
                  <p>{r.comment || <span className="muted">Без текста</span>}</p>
                  <div className="row-actions">
                    {!r.isApproved && (
                      <button type="button" className="btn btn--small btn--primary" onClick={() => act(() => reviewsApi.approve(r.id), 'Отзыв опубликован')}>
                        Опубликовать
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn--small btn--quiet"
                      onClick={() => window.confirm('Удалить отзыв?') && act(() => reviewsApi.remove(r.id), 'Отзыв удалён')}
                    >
                      Удалить
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <Pagination page={data.page} totalPages={data.totalPages} onChange={(p) => setQuery((q) => ({ ...q, page: p }))} />
          </>
        )}
      </Async>
    </>
  );
}
