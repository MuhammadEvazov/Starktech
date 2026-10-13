import '../../styles/site/home.css';
import { useState } from 'react';
import { Link } from '../../lib/router.jsx';
import { useAsync } from '../../lib/hooks.js';
import { categoriesApi, portfolioApi } from '../../api/endpoints.js';
import { descOf, nameOf } from '../../lib/format.js';
import { Async, Empty, Img, Pagination } from '../../components/ui.jsx';
import { CONTACTS } from '../../lib/contacts.js';

export default function Portfolio() {
  const [categoryId, setCategoryId] = useState('');
  const [page, setPage] = useState(1);
  const categories = useAsync(() => categoriesApi.list({ isActive: true, pageSize: 50 }), []);
  const items = useAsync(() => portfolioApi.list({ isActive: true, categoryId, page, pageSize: 24 }), [categoryId, page]);

  const cats = [...(categories.data?.items ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
  const catName = (id) => nameOf(cats.find((c) => c.id === id));
  const pick = (id) => {
    setCategoryId(id);
    setPage(1);
  };

  return (
    <div className="site-container pf-page">
      <h1 className="site-title">Наши работы</h1>
      <p className="site-lead">Настоящие заказы наших клиентов: стикеры, брелки и чехлы с их фото.</p>

      {cats.length > 0 && (
        <div className="pf-filter" role="group" aria-label="Фильтр по категории">
          <button type="button" className="site-pill" aria-pressed={!categoryId} onClick={() => pick('')}>
            Все
          </button>
          {cats.map((c) => (
            <button
              key={c.id}
              type="button"
              className="site-pill"
              aria-pressed={categoryId === c.id}
              onClick={() => pick(c.id)}
            >
              {nameOf(c)}
            </button>
          ))}
        </div>
      )}

      <div className="home-state">
        <Async
          state={items}
          empty={
            <Empty
              title={categoryId ? 'В этой категории пока нет работ' : 'Здесь пока пусто'}
              action={
                categoryId ? (
                  <button type="button" className="btn btn--ghost" onClick={() => pick('')}>
                    Показать все работы
                  </button>
                ) : null
              }
            >
              {categoryId ? (
                'Загляните в другие категории.'
              ) : (
                <>
                  Скоро покажем свежие работы. Пока загляните в наш{' '}
                  <a href={CONTACTS.instagram} target="_blank" rel="noopener noreferrer" className="text-link">
                    Instagram {CONTACTS.instagramHandle}
                  </a>
                  .
                </>
              )}
            </Empty>
          }
        >
          {(data) => (
            <>
              <ul className="pf-grid">
                {data.items.map((p) => {
                  const desc = descOf(p);
                  const cat = !categoryId && catName(p.categoryId);
                  return (
                    <li key={p.id}>
                      <figure className="pf-item">
                        <Img src={p.imageUrl} alt={desc || 'Готовая работа StarkTech'} />
                        {(desc || cat) && (
                          <figcaption>
                            {cat && <span className="pf-item__cat">{cat}</span>}
                            {desc}
                          </figcaption>
                        )}
                      </figure>
                    </li>
                  );
                })}
              </ul>
              <Pagination page={data.page} totalPages={data.totalPages} onChange={setPage} />
            </>
          )}
        </Async>
      </div>

      <div className="site-surface pf-cta">
        <p>Хотите так же? Выберите товар и загрузите своё фото.</p>
        <Link to="/catalog" className="btn btn--primary btn--large">
          Перейти в каталог
        </Link>
      </div>
    </div>
  );
}
