import '../../styles/site/catalog.css';
import { useEffect, useState } from 'react';
import { useAsync, useDebounced } from '../../lib/hooks.js';
import { useSearch } from '../../lib/router.jsx';
import { categoriesApi, productsApi } from '../../api/endpoints.js';
import { nameOf, descOf } from '../../lib/format.js';
import ProductCard from '../../components/ProductCard.jsx';
import { ErrorBox, Img, Pagination } from '../../components/ui.jsx';
import { CONTACTS } from '../../lib/contacts.js';

// Значок категории в чипе — силуэт изделия (сердце-стикер, брелок, чехол), если у категории нет обложки.
const GLYPHS = {
  heart: 'M12 20.5C6.2 16.6 3 13.3 3 9.6 3 7 5 5 7.5 5c1.8 0 3.4 1 4.5 2.6C13.1 6 14.7 5 16.5 5 19 5 21 7 21 9.6c0 3.7-3.2 7-9 10.9Z',
  ring: 'M12 3a5 5 0 0 1 2.2 9.5V14h1.3v2h-1.3v5h-4.4v-5H8.5v-2h1.3v-1.5A5 5 0 0 1 12 3Zm0 2.6a2.4 2.4 0 1 0 0 4.8 2.4 2.4 0 0 0 0-4.8Z',
  phone: 'M8 2.5h8A2.5 2.5 0 0 1 18.5 5v14a2.5 2.5 0 0 1-2.5 2.5H8A2.5 2.5 0 0 1 5.5 19V5A2.5 2.5 0 0 1 8 2.5Zm.3 2.3v4h4v-4h-4Z',
  gift: 'M4 9h16v4H4zM5.5 13h13v8h-13zM11 9h2v12h-2zM12 9C9 9 7 7.8 7 6.2 7 5 8 4 9.3 4 11 4 12 6 12 9Zm0 0c0-3 1-5 2.7-5C16 4 17 5 17 6.2 17 7.8 15 9 12 9Z',
};
const glyphFor = (slug = '') =>
  /sticker|стикер/i.test(slug) ? GLYPHS.heart : /key|брел/i.test(slug) ? GLYPHS.ring : /case|чех/i.test(slug) ? GLYPHS.phone : GLYPHS.gift;

function ChipCover({ category }) {
  return (
    <span className="cat-chip__cover" aria-hidden="true">
      {category?.imageUrl ? (
        <Img src={category.imageUrl} alt="" />
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24">
          <path d={category ? glyphFor(category.slug) : 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z'} fill="currentColor" />
        </svg>
      )}
    </span>
  );
}

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
      {/* Промо-баннер бренда: тёмно-синий фон, неоновая рамка — как в постах @starktech.tj */}
      <header className="cat-hero">
        <div className="cat-hero__text">
          <h1 className="cat-hero__title">{active ? nameOf(active) : 'Каталог'}</h1>
          <p className="cat-hero__lead">
            {(active && descOf(active)) ||
              'Стикеры, брелки и чехлы с твоими фото. Выбери товар — фото добавишь прямо на его странице.'}
          </p>
        </div>
        <p className="cat-hero__frame">
          <span className="cat-hero__frame-label">Готово за</span>
          <span className="cat-hero__frame-value">{CONTACTS.leadTime}</span>
          <span className="cat-hero__frame-note">печатаем в {CONTACTS.city}</span>
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
            placeholder="Найти стикер, брелок или чехол"
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
            className="site-pill cat-chip"
            aria-pressed={!categoryId}
            onClick={() => setParams({ q: params.q })}
          >
            <ChipCover />
            Все товары
          </button>
          {categories.loading && !categories.data
            ? [1, 2, 3].map((n) => <span key={n} className="cat-chips__ghost" aria-hidden="true" />)
            : cats.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="site-pill cat-chip"
                  aria-pressed={categoryId === c.id}
                  onClick={() => setParams({ q: params.q, category: c.id })}
                >
                  <ChipCover category={c} />
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
                ? `По запросу «${params.q}» товаров нет. Попробуй другое слово или посмотри все товары.`
                : 'В этой категории пока пусто. Загляни в соседние разделы.'}
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
