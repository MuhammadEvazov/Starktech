import '../../styles/site/home.css';
import { Link } from '../../lib/router.jsx';
import { useAsync } from '../../lib/hooks.js';
import { categoriesApi, citiesApi, portfolioApi, productsApi } from '../../api/endpoints.js';
import { money, nameOf, descOf } from '../../lib/format.js';
import { SEED_CATEGORIES } from '../../components/StickerSheet.jsx';
import ProductCard from '../../components/ProductCard.jsx';
import { Img, Spinner, ErrorBox, Empty } from '../../components/ui.jsx';
import { CONTACTS, whatsappWith } from '../../lib/contacts.js';

// Формы для плиток категорий (координаты 100×100), подбираются по slug.
const SHAPES = {
  heart: 'M50 88 C20 68 8 50 12 34 C16 18 38 14 50 32 C62 14 84 18 88 34 C92 50 80 68 50 88Z',
  circle: 'M50 10 A40 40 0 1 1 49.9 10Z',
  phone: 'M36 6 H64 Q76 6 76 18 V82 Q76 94 64 94 H36 Q24 94 24 82 V18 Q24 6 36 6Z',
  flower: flowerPath(),
};
function flowerPath() {
  const pts = [];
  for (let i = 0; i <= 20; i++) {
    const a = (Math.PI * i) / 10 - Math.PI / 2;
    const r = i % 2 === 0 ? 42 : 33;
    pts.push(`${(50 + r * Math.cos(a)).toFixed(1)} ${(50 + r * Math.sin(a)).toFixed(1)}`);
  }
  return `M${pts.join(' L')}Z`;
}
const SHAPE_BY_SLUG = {
  '3d-stickers': 'heart',
  keychains: 'circle',
  'clear-cases': 'phone',
  'custom-cases': 'phone',
  'gift-sets': 'flower',
};
const SHAPE_FALLBACK = ['heart', 'circle', 'phone', 'flower'];

export default function Home() {
  const categories = useAsync(() => categoriesApi.list({ isActive: true, pageSize: 20 }), []);
  const products = useAsync(() => productsApi.list({ isActive: true, pageSize: 8 }), []);
  const portfolio = useAsync(() => portfolioApi.list({ isActive: true, pageSize: 6 }), []);
  const cities = useAsync(() => citiesApi.list({ isActive: true, pageSize: 50 }), []);

  const cats = [...(categories.data?.items ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
  const catName = (id) => nameOf(cats.find((c) => c.id === id));
  // Пока бэкенд не ответил (или упал) — показываем категории из DataSeed, они ведут в общий каталог.
  const tiles = cats.length ? cats : SEED_CATEGORIES;

  return (
    <>
      <section className="home-hero">
        <div className="site-container home-hero__row">
          <div>
            <h1 className="home-hero__title">
              Ваше фото на&nbsp;<em>стикере</em>, брелке или&nbsp;чехле
            </h1>
            <p className="home-hero__lead">
              Выберите товар, загрузите снимок — напечатаем в {CONTACTS.city} за {CONTACTS.leadTime} и привезём по
              всему Таджикистану.
            </p>
            <div className="home-hero__actions">
              <Link to="/catalog" className="btn btn--primary btn--large">
                Выбрать товар
              </Link>
              <Link to="/portfolio" className="btn btn--ghost btn--large">
                Посмотреть работы
              </Link>
            </div>
            <ul className="home-hero__facts">
              <li>
                <Check /> Готово за {CONTACTS.leadTime}
              </li>
              <li>
                <Check /> Доставка до двери
              </li>
              <li>
                <Check /> Наличные или Alif Pay
              </li>
            </ul>
          </div>
          <HeroArt />
        </div>
      </section>

      <section className="home-section site-container" aria-labelledby="home-cats-title">
        <div className="home-section__head">
          <h2 id="home-cats-title" className="home-h2">
            Что можно заказать
          </h2>
          <Link to="/catalog" className="home-more">
            Весь каталог
          </Link>
        </div>
        <ul className="home-cats">
          {tiles.map((c, i) => (
            <li key={c.id || c.slug}>
              <CategoryTile category={c} index={i} />
            </li>
          ))}
        </ul>
      </section>

      <section className="home-section site-container" aria-labelledby="home-steps-title">
        <div className="site-surface home-steps">
          <h2 id="home-steps-title" className="home-h2">
            Как сделать заказ
          </h2>
          <ol className="home-steps__list">
            <li>
              <strong>Выберите товар</strong>
              <span>Стикер, брелок или чехол. Затем размер, форму или модель телефона.</span>
            </li>
            <li>
              <strong>Добавьте фото</strong>
              <span>Прикрепите снимки в корзине. Заказываете без аккаунта — менеджер попросит фото после звонка.</span>
            </li>
            <li>
              <strong>Получите заказ</strong>
              <span>Привезём за {CONTACTS.leadTime}. Оплата наличными, Alif Pay, Корти Миллӣ или переводом.</span>
            </li>
          </ol>
          <Link to="/catalog" className="btn btn--primary btn--large home-steps__cta">
            Начать заказ
          </Link>
        </div>
      </section>

      <section className="home-section site-container" aria-labelledby="home-popular-title">
        <div className="home-section__head">
          <h2 id="home-popular-title" className="home-h2">
            Популярное
          </h2>
          <Link to="/catalog" className="home-more">
            Все товары
          </Link>
        </div>
        {products.loading ? (
          <Spinner />
        ) : products.error ? (
          <ErrorBox error={products.error} onRetry={products.reload} />
        ) : products.data?.items?.length ? (
          <div className="home-products">
            {products.data.items.map((p) => (
              <ProductCard key={p.id} product={p} categoryName={catName(p.categoryId)} />
            ))}
          </div>
        ) : (
          <Empty title="Скоро здесь появятся товары">Пока каталог наполняется, напишите нам в WhatsApp — подскажем и посчитаем цену.</Empty>
        )}
      </section>

      {portfolio.data?.items?.length > 0 && (
        <section className="home-section site-container" aria-labelledby="home-works-title">
          <div className="home-section__head">
            <h2 id="home-works-title" className="home-h2">
              Наши работы
            </h2>
            <Link to="/portfolio" className="home-more">
              Все работы
            </Link>
          </div>
          <ul className="home-works">
            {portfolio.data.items.map((p) => (
              <li key={p.id}>
                <figure>
                  <Img src={p.imageUrl} alt={descOf(p) || 'Готовая работа StarkTech'} />
                  {descOf(p) && <figcaption>{descOf(p)}</figcaption>}
                </figure>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="home-section site-container" aria-labelledby="home-trust-title">
        <h2 id="home-trust-title" className="sr-only">
          Сроки, доставка и контакты
        </h2>
        <div className="home-trust">
          <div>
            <ul className="home-trust__facts">
              <li className="home-trust__fact">
                <strong>{CONTACTS.leadTime}</strong>
                <span>Столько занимает печать после подтверждения заказа</span>
              </li>
              <li className="home-trust__fact">
                <strong>Весь Таджикистан</strong>
                <span>Привезём до двери в {CONTACTS.city} и отправим в другие города</span>
              </li>
              <li className="home-trust__fact">
                <strong>Оплата удобно</strong>
                <span>Наличными, Alif Pay, Корти Миллӣ или переводом</span>
              </li>
            </ul>

            {cities.data?.items?.length > 0 && (
              <div className="home-delivery">
                <h3>Стоимость доставки</h3>
                <ul>
                  {cities.data.items.map((c) => {
                    const free = Number(c.deliveryCost) === 0;
                    return (
                      <li key={c.id}>
                        <span>{nameOf(c)}</span>
                        <span className={`home-delivery__cost ${free ? 'home-delivery__cost--free' : ''}`}>
                          {free ? 'бесплатно' : money(c.deliveryCost)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>

          <div className="home-trust__contact">
            <p className="home-h2">Есть вопрос? Напишите нам</p>
            <p>
              Ответим в WhatsApp, подскажем размер и посчитаем цену. Больше работ и отзывов — в Instagram{' '}
              {CONTACTS.instagramHandle}.
            </p>
            <div className="home-trust__buttons">
              <a
                className="btn btn--large home-btn-wa"
                href={whatsappWith('Здравствуйте! Хочу заказать товар с фото.')}
                target="_blank"
                rel="noopener noreferrer"
              >
                Написать в WhatsApp
              </a>
              <a
                className="btn btn--large home-btn-light"
                href={CONTACTS.instagram}
                target="_blank"
                rel="noopener noreferrer"
              >
                Открыть Instagram
              </a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function Check() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="10" r="9" fill="currentColor" opacity="0.14" />
      <path d="M6 10.4 8.7 13 14 7.4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CategoryTile({ category, index }) {
  const to = category.id ? `/catalog?category=${category.id}` : '/catalog';
  const shape = SHAPE_BY_SLUG[category.slug] || SHAPE_FALLBACK[index % SHAPE_FALLBACK.length];
  const tone = index % 5;
  const desc = descOf(category);
  const placeholder = (
    <span className="home-cat__shape" aria-hidden="true">
      <svg viewBox="-6 -6 112 112">
        <path d={SHAPES[shape]} className="home-cat__cut" stroke="#fff" strokeWidth="10" strokeLinejoin="round" />
        <path d={SHAPES[shape]} className="home-cat__fill" />
      </svg>
    </span>
  );
  return (
    <Link to={to} className={`home-cat home-cat--t${tone}`}>
      <span className="home-cat__media">
        {category.imageUrl ? <Img src={category.imageUrl} alt="" fallback={placeholder} /> : placeholder}
      </span>
      <span className="home-cat__body">
        <span className="home-cat__name">{nameOf(category)}</span>
        {desc && <span className="home-cat__desc">{desc}</span>}
      </span>
    </Link>
  );
}

// «Ваше фото → стикер, брелок, чехол». Один и тот же снимок вырезан в три формы.
function HeroArt() {
  const heart = SHAPES.heart;
  const circle = 'M50 12 A38 38 0 1 1 49.9 12Z';
  const phone = SHAPES.phone;
  return (
    <figure className="home-hero__art">
      <svg viewBox="0 0 440 310" role="img" aria-labelledby="home-art-cap">
        <defs>
          <g id="home-portrait">
            <rect width="100" height="100" fill="#ffe7a0" />
            <circle cx="76" cy="22" r="10" fill="#ffd84a" />
            <path d="M0 78 Q30 62 56 74 T100 70 V100 H0Z" fill="#b9b3ff" />
            <circle cx="50" cy="46" r="15" fill="#14163a" />
            <path d="M20 100 C20 76 34 66 50 66 C66 66 80 76 80 100Z" fill="#2a3be0" />
          </g>
          <clipPath id="home-clip-photo">
            <rect x="0" y="0" width="100" height="100" rx="4" />
          </clipPath>
          <clipPath id="home-clip-heart">
            <path d={heart} />
          </clipPath>
          <clipPath id="home-clip-circle">
            <path d={circle} />
          </clipPath>
          <clipPath id="home-clip-phone">
            <path d={phone} />
          </clipPath>
        </defs>

        {/* Исходное фото — полароид */}
        <g className="home-art__item" transform="translate(18 66) rotate(-5)">
          <rect width="132" height="158" rx="10" fill="#fff" />
          <g transform="translate(9 9) scale(1.14)" clipPath="url(#home-clip-photo)">
            <use href="#home-portrait" />
          </g>
        </g>
        <text className="home-art__label" x="84" y="262" textAnchor="middle">
          Ваше фото
        </text>

        <path className="home-art__arrow" d="M164 150 C182 132 196 132 212 140" />
        <path d="M204 133 L214 141 L202 146" fill="none" stroke="#4d5175" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

        {/* Стикер-сердце — единственный анимированный элемент */}
        <g transform="translate(205 6) scale(1.25)">
          <g className="home-art__item home-art__peel">
            <path d={heart} className="home-art__edge" />
            <g clipPath="url(#home-clip-heart)">
              <use href="#home-portrait" />
            </g>
          </g>
        </g>
        <text className="home-art__label" x="268" y="150" textAnchor="middle">
          Стикер
        </text>

        {/* Брелок */}
        <g className="home-art__item" transform="translate(334 30) rotate(6 50 50)">
          <circle cx="50" cy="4" r="8" fill="none" stroke="#9aa0bf" strokeWidth="3" />
          <path d={circle} className="home-art__edge" />
          <g clipPath="url(#home-clip-circle)">
            <use href="#home-portrait" />
          </g>
        </g>
        <text className="home-art__label" x="388" y="150" textAnchor="middle">
          Брелок
        </text>

        {/* Чехол */}
        <g className="home-art__item" transform="translate(262 162) scale(1.45) rotate(-4 50 50)">
          <path d={phone} className="home-art__edge" />
          <g clipPath="url(#home-clip-phone)">
            <use href="#home-portrait" />
          </g>
          <rect x="30" y="12" width="15" height="15" rx="5" fill="#14163a" opacity="0.85" />
        </g>
        <text className="home-art__label" x="290" y="240" textAnchor="end">
          Чехол
        </text>
      </svg>
      <figcaption id="home-art-cap">Одно фото — стикер, брелок или чехол на выбор</figcaption>
    </figure>
  );
}
