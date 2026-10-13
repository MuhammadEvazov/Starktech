import { useState } from 'react';
import { Link } from '../../lib/router.jsx';
import { useAsync } from '../../lib/hooks.js';
import { reviewsApi } from '../../api/endpoints.js';
import { dateTime, nameOf } from '../../lib/format.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Async, Badge, Empty, Pagination, Stars } from '../../components/ui.jsx';
import { ConfirmDelete, FilterBar } from './CrudPage.jsx';
import { TrashIcon } from './icons.jsx';
import { useProductOptions } from './useLookups.js';

const FILTERS = [
  { name: 'isApproved', label: 'Статус', type: 'bool', trueLabel: 'Опубликованы', falseLabel: 'На модерации' },
  {
    name: 'minRating',
    label: 'Оценка от',
    type: 'select',
    allLabel: 'Любая оценка',
    options: [5, 4, 3, 2, 1].map((n) => ({ value: String(n), label: `от ${n} ★` })),
  },
];

export default function Reviews() {
  const toast = useToast();
  const products = useProductOptions();
  const [query, setQuery] = useState({ isApproved: 'false', page: 1 });
  const [removing, setRemoving] = useState(null);
  const list = useAsync(() => reviewsApi.list({ ...query, pageSize: 20 }), [JSON.stringify(query)]);

  // Русское название из отзыва; если его нет — из каталога, в крайнем случае английское.
  const productName = (r) => {
    if (r.productNameRu) return r.productNameRu;
    const p = products.items.find((x) => x.id === r.productId);
    return (p && nameOf(p)) || r.productNameEn || 'Товар';
  };

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
      <FilterBar
        filters={FILTERS}
        query={query}
        total={list.data?.totalCount}
        onChange={(name, v) => setQuery((q) => ({ ...q, [name]: v, page: 1 }))}
        onReset={() => setQuery({ page: 1 })}
      />
      <Async state={list} empty={<Empty title="Отзывов нет">{query.isApproved === 'false' ? 'Все отзывы проверены.' : 'Измените фильтры.'}</Empty>}>
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
                        {productName(r)}
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
                    <button type="button" className="icon-action icon-action--delete" aria-label="Удалить отзыв" title="Удалить" onClick={() => setRemoving(r)}>
                      <TrashIcon />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <Pagination page={data.page} totalPages={data.totalPages} onChange={(p) => setQuery((q) => ({ ...q, page: p }))} />
          </>
        )}
      </Async>

      {removing && (
        <ConfirmDelete
          title="Удалить отзыв?"
          text={`Отзыв ${removing.userFullName || 'покупателя'} удалится без возможности восстановления.`}
          onCancel={() => setRemoving(null)}
          onConfirm={async () => {
            await reviewsApi.remove(removing.id);
            setRemoving(null);
            toast('Отзыв удалён');
            list.reload();
          }}
        />
      )}
    </>
  );
}
