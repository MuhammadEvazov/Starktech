import '../../styles/site/catalog.css';
import { useEffect, useState } from 'react';
import { useAsync, useDebounced } from '../../lib/hooks.js';
import { useSearch } from '../../lib/router.jsx';
import { categoriesApi, productsApi } from '../../api/endpoints.js';
import { nameOf, descOf } from '../../lib/format.js';
import ProductCard from '../../components/ProductCard.jsx';
import { ErrorBox, Pagination } from '../../components/ui.jsx';

const plural = (n, one, few, many) => {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
};

export default function Catalog() {
  const [params, setParams] = useSearch();
  const [search, setSearch] = useState(params.q || '');
  const q = useDebounced(search);
  const page = Number(params.page || 1);
  const categoryId = params.category || '';

  // URL — источник правды: «Назад» или клик по «Каталогу» без q очищают поле поиска.
  useEffect(() => {
    setSearch(params.q || '');
  }, [params.q]);

  useEffect(() => {
    if ((params.q || '') !== q) setParams({ ...params, q, page: 1 });
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  const categories = useAsync(() => categoriesApi.list({ isActive: true, pageSize: 50 }), []);
  const products = useAsync(
    () => productsApi.list({ isActive: true, categoryId, name: params.q, page, pageSize: 12 }),
    [categoryId, params.q, page],
  );

  const cats = [...(categories.data?.items ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
  const active = cats.find((c) => c.id === categoryId);
  const filtered = Boolean(params.q || categoryId);

  const resetAll = () => {
    setSearch('');
    setParams({});
  };

  const data = products.data;
  const total = data?.totalCount;

  return (
    <div className="site-container cat-page">
      <header className="cat-head">
        <h1 className="site-title">{active ? nameOf(active) : 'Каталог'}</h1>
        <p className="site-lead">
          {(active && descOf(active)) ||
            'Стикеры, брелки и чехлы с вашими фото. Выберите товар, а фото загрузите на его странице.'}
        </p>
      </header>

      <div className="cat-bar">
        <label className="cat-search">
          <svg className="cat-search__icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            type="search"
            className="cat-search__input"
            placeholder="Найти товар"
            aria-label="Поиск по названию"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button type="button" className="cat-search__clear" aria-label="Очистить поиск" onClick={() => setSearch('')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          )}
        </label>

        <nav className="cat-chips" aria-label="Категории">
          <button
            type="button"
            className="cat-chip"
            aria-pressed={!categoryId}
            onClick={() => setParams({ q: params.q })}
          >
            Все товары
          </button>
          {categories.loading && !categories.data
            ? [1, 2, 3].map((n) => <span key={n} className="cat-chip cat-chip--ghost" aria-hidden="true" />)
            : cats.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="cat-chip"
                  aria-pressed={categoryId === c.id}
                  onClick={() => setParams({ q: params.q, category: c.id })}
                >
                  {nameOf(c)}
                </button>
              ))}
        </nav>
      </div>

      <section className="cat-results" aria-label="Товары" aria-busy={products.loading}>
        {products.loading && !data ? (
          <div className="cat-grid" role="status" aria-label="Загружаем товары">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="cat-skel" aria-hidden="true">
                <span className="cat-skel__img" />
                <span className="cat-skel__line" />
                <span className="cat-skel__line cat-skel__line--short" />
              </div>
            ))}
          </div>
        ) : products.error ? (
          <ErrorBox error={products.error} onRetry={products.reload} />
        ) : !data?.items?.length ? (
          <div className="cat-empty">
            <svg className="cat-empty__art" width="72" height="72" viewBox="0 0 64 64" aria-hidden="true">
              <path d="M12 8h30l12 12v30a6 6 0 0 1-6 6H12a6 6 0 0 1-6-6V14a6 6 0 0 1 6-6Z" fill="var(--paper)" stroke="var(--site-line)" strokeWidth="3" />
              <path d="M42 8v8a4 4 0 0 0 4 4h8" fill="var(--sheet)" stroke="var(--site-line)" strokeWidth="3" strokeLinejoin="round" />
              <circle cx="24" cy="32" r="3" fill="var(--ink)" />
              <circle cx="38" cy="32" r="3" fill="var(--ink)" />
              <path d="M24 44c4-3 10-3 14 0" stroke="var(--ink)" strokeWidth="3" strokeLinecap="round" fill="none" />
            </svg>
            <p className="cat-empty__title">Ничего не нашлось</p>
            <p className="cat-empty__text">
              {params.q
                ? `По запросу «${params.q}» товаров нет. Попробуйте другое слово или посмотрите все товары.`
                : 'В этой категории пока нет товаров. Загляните в другие разделы.'}
            </p>
            {filtered && (
              <button type="button" className="btn btn--primary" onClick={resetAll}>
                Показать все товары
              </button>
            )}
          </div>
        ) : (
          <>
            {typeof total === 'number' && (
              <p className="cat-count" aria-live="polite">
                {total} {plural(total, 'товар', 'товара', 'товаров')}
                {filtered && (
                  <button type="button" className="cat-count__reset" onClick={resetAll}>
                    Сбросить
                  </button>
                )}
              </p>
            )}
            <div className={`cat-grid ${products.loading ? 'is-loading' : ''}`}>
              {data.items.map((p) => (
                <ProductCard key={p.id} product={p} categoryName={nameOf(cats.find((c) => c.id === p.categoryId))} />
              ))}
            </div>
            <div className="cat-pages">
              <Pagination
                page={data.page}
                totalPages={data.totalPages}
                onChange={(p) => setParams({ ...params, page: p })}
              />
            </div>
          </>
        )}
      </section>
    </div>
  );
}
