import '../../styles/site/home.css';
import { Link } from '../../lib/router.jsx';
import { useAsync } from '../../lib/hooks.js';
import { categoriesApi, comboOffersApi, productsApi } from '../../api/endpoints.js';
import { nameOf, descOf, date } from '../../lib/format.js';
import { comboProductIds, discountLabel, isComboLive } from '../../lib/combo.js';
import { CONTACTS, whatsappWith } from '../../lib/contacts.js';
import { Spinner, ErrorBox, Empty } from '../../components/ui.jsx';

const num = (v) => Number(v).toLocaleString('ru-RU');

// Самый частый вопрос в комментариях Instagram — «сколько стоит?».
// Эта страница отвечает на него одной ссылкой.
export default function Prices() {
  const categories = useAsync(() => categoriesApi.list({ isActive: true, pageSize: 50 }), []);
  const products = useAsync(() => productsApi.list({ isActive: true, pageSize: 200 }), []);
  const combos = useAsync(() => comboOffersApi.list({ isActive: true, pageSize: 50 }), []);

  const loading = categories.loading || products.loading;
  const error = categories.error || products.error;
  const cats = [...(categories.data?.items ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
  const items = products.data?.items ?? [];
  const groups = cats
    .map((c) => ({ cat: c, items: items.filter((p) => p.categoryId === c.id) }))
    .filter((g) => g.items.length > 0);
  const byId = new Map(items.map((p) => [p.id, p]));
  // Показываем только комбо, все товары которых сейчас продаются.
  const liveCombos = (combos.data?.items ?? []).filter(
    (c) => isComboLive(c) && comboProductIds(c).every((id) => byId.has(id)),
  );

  return (
    <div className="site-container pr-page">
      <div className="pr-layout">
        <header className="page-head">
          <h1 className="site-title">Цены</h1>
          <p className="site-lead">
            Цена указана за изделие с твоим фото. Чем больше штук, тем ниже цена за каждую — пороги скидки видны на
            странице товара. Изготовление {CONTACTS.leadTime}, доставка по всему Таджикистану.
          </p>
        </header>
        <p className="pr-note">
          Как оплатить, нужна ли предоплата и суммируются ли скидки — в разделе{' '}
          <Link to="/faq#payment">«Оплата» в вопросах и ответах</Link>.
        </p>

        {loading ? (
          <div className="home-state">
            <Spinner />
          </div>
        ) : error ? (
          <div className="home-state">
            <ErrorBox
              error={error}
              onRetry={() => {
                categories.reload();
                products.reload();
              }}
            />
          </div>
        ) : groups.length === 0 ? (
          <div className="home-state">
            <Empty title="Прайс скоро появится">
              Пока уточни цену в{' '}
              <a href={CONTACTS.whatsapp} target="_blank" rel="noopener noreferrer" className="text-link">
                WhatsApp
              </a>
              .
            </Empty>
          </div>
        ) : (
          <>
            {groups.length > 1 && (
              <nav aria-label="Категории прайса">
                <ul className="pr-jump">
                  {liveCombos.length > 0 && (
                    <li>
                      <a href="#pr-combos" className="site-pill">Комбо-наборы</a>
                    </li>
                  )}
                  {groups.map(({ cat }) => (
                    <li key={cat.id}>
                      <a href={`#pr-cat-${cat.id}`} className="site-pill">{nameOf(cat)}</a>
                    </li>
                  ))}
                </ul>
              </nav>
            )}

            {liveCombos.length > 0 && (
              <section id="pr-combos" className="pr-combos promo-panel" aria-labelledby="pr-combos-title">
                <h2 id="pr-combos-title" className="home-h2">
                  Комбо-наборы
                </h2>
                <p>Положи в корзину все товары набора — скидка применится при оформлении.</p>
                <ul className="pr-combo-list">
                  {liveCombos.map((c) => (
                    <li key={c.id} className="pr-combo">
                      <div className="pr-combo__head">
                        <span className="pr-combo__name">{nameOf(c)}</span>
                        <span className="pr-combo__badge neon-outline neon-outline--sm">{discountLabel(c)}</span>
                      </div>
                      <ul className="pr-combo__items" aria-label="Товары набора">
                        {comboProductIds(c).map((id) => (
                          <li key={id}>
                            <Link to={`/product/${id}`}>{nameOf(byId.get(id))}</Link>
                          </li>
                        ))}
                      </ul>
                      {c.validTo && <p className="pr-combo__until">Действует до {date(c.validTo)}</p>}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {groups.map(({ cat, items: list }) => (
              <section
                key={cat.id}
                id={`pr-cat-${cat.id}`}
                className="pr-group"
                aria-labelledby={`pr-cat-title-${cat.id}`}
              >
                <div className="pr-group__head">
                  <h2 id={`pr-cat-title-${cat.id}`} className="home-h2">
                    {nameOf(cat)}
                  </h2>
                  {descOf(cat) && <p className="pr-group__desc">{descOf(cat)}</p>}
                </div>
                <ul className="pr-list">
                  {[...list]
                    .sort((a, b) => Number(a.basePrice) - Number(b.basePrice))
                    .map((p) => (
                      <li key={p.id} className="pr-row">
                        <Link to={`/product/${p.id}`}>
                          <span className="pr-row__name">
                            {nameOf(p)}
                            {p.requiresPhotoUpload && <span className="brand-chip">С твоим фото</span>}
                          </span>
                          <span className="pr-row__price">
                            <small>от </small>
                            {num(p.basePrice)}
                            <small> смн</small>
                          </span>
                        </Link>
                      </li>
                    ))}
                </ul>
              </section>
            ))}
          </>
        )}

        <div className="pr-cta promo-panel">
          <div>
            <h2 className="pr-cta__title display-upper">Нужен свой размер или опт?</h2>
            <p>Напиши — посчитаем стоимость за пару минут.</p>
          </div>
          <a
            className="btn btn--neon btn--large"
            href={whatsappWith('Здравствуйте! Хочу узнать цену на заказ.')}
            target="_blank"
            rel="noopener noreferrer"
          >
            Написать в WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
}
