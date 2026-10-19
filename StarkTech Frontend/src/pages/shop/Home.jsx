import '../../styles/site/home.css';
import { Link } from '../../lib/router.jsx';
import { useAsync } from '../../lib/hooks.js';
import { categoriesApi, citiesApi, portfolioApi, productsApi } from '../../api/endpoints.js';
import { money, nameOf, descOf } from '../../lib/format.js';
import { SEED_CATEGORIES } from '../../components/StickerSheet.jsx';
import ProductCard from '../../components/ProductCard.jsx';
import { Img, Spinner, ErrorBox, Empty } from '../../components/ui.jsx';
import { CONTACTS, whatsappWith } from '../../lib/contacts.js';

// Иконка-заглушка для круглой обложки категории (пока у категории нет своей картинки), по slug.
const ICON_BY_SLUG = {
  '3d-stickers': 'sticker',
  keychains: 'keychain',
  'clear-cases': 'phone',
  'custom-cases': 'phone',
  'gift-sets': 'gift',
};
const ICON_FALLBACK = ['sticker', 'keychain', 'phone', 'gift'];

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
      <section className="home-hero site-container" aria-labelledby="home-hero-title">
        <div className="home-hero__panel promo-panel">
          <div className="home-hero__copy">
            <h1 id="home-hero-title" className="home-hero__title display-upper">
              Твоё фото на&nbsp;3D-стикере, брелке или&nbsp;чехле
            </h1>
            <p className="home-hero__badge neon-outline">
              <span className="home-hero__badge-big display-upper">за {CONTACTS.leadTime}</span>
              <span className="home-hero__badge-small">печатаем в {CONTACTS.city}</span>
            </p>
            <p className="home-hero__lead">
              <strong>Порадуй себя и близких.</strong> Выбери товар, загрузи фото — сделаем и привезём по всему
              Таджикистану.
            </p>
            <div className="home-hero__actions">
              <Link to="/catalog" className="btn btn--primary btn--large">
                Выбрать товар
              </Link>
              <a
                className="btn btn--on-dark btn--large"
                href={whatsappWith('Здравствуйте! Хочу заказать товар с фото.')}
                target="_blank"
                rel="noopener noreferrer"
              >
                Написать в WhatsApp
              </a>
            </div>
            <ul className="home-hero__perks">
              <li>
                <span aria-hidden="true">⚡</span> Готово за {CONTACTS.leadTime}
              </li>
              <li>
                <span aria-hidden="true">🚚</span> Доставка до двери
              </li>
              <li>
                <span aria-hidden="true">💳</span> Наличные, Alif Pay, Корти Миллӣ
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
              <CategoryCover category={c} index={i} />
            </li>
          ))}
        </ul>
      </section>

      <section className="home-section site-container" aria-labelledby="home-steps-title">
        <div className="home-steps">
          <h2 id="home-steps-title" className="home-h2">
            Как сделать заказ
          </h2>
          <ol className="home-steps__list">
            <li>
              <strong>Выбери товар</strong>
              <span>Стикер, брелок или чехол. Потом размер, форму или модель телефона.</span>
            </li>
            <li>
              <strong>Добавь фото</strong>
              <span>Войди в аккаунт и загрузи снимки прямо на странице товара — там же подгонишь их под форму.</span>
            </li>
            <li>
              <strong>Одобри макет</strong>
              <span>Если менеджер пришлёт макет, он появится в личном кабинете. Без твоего «да» ничего не печатаем.</span>
            </li>
            <li>
              <strong>Получи заказ</strong>
              <span>Привезём за {CONTACTS.leadTime}. Оплата наличными, Alif Pay, Корти Миллӣ или переводом.</span>
            </li>
          </ol>
          <div className="home-steps__foot">
            <Link to="/catalog" className="btn btn--primary btn--large">
              Начать заказ
            </Link>
            <p className="home-faq">
              Остались вопросы? <Link to="/faq#photos">Какие фото подходят</Link>,{' '}
              <Link to="/faq#payment">оплата</Link>, <Link to="/faq#returns">возврат и брак</Link> — в разделе{' '}
              <Link to="/faq">«Вопросы и ответы»</Link>.
            </p>
          </div>
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
          <Empty title="Скоро здесь появятся товары">
            Пока каталог наполняется, напиши нам в WhatsApp — подскажем и посчитаем цену.
          </Empty>
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
                  <Img src={p.imageUrl} alt={descOf(p) || 'Готовая работа Stark Tech'} />
                  {descOf(p) && <figcaption>{descOf(p)}</figcaption>}
                </figure>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="home-section site-container" aria-labelledby="home-contact-title">
        <div className="home-trust">
          {cities.data?.items?.length > 0 && (
            <div className="home-delivery">
              <h2 className="home-h3">Доставка</h2>
              <p className="home-delivery__note">
                Привезём до двери в {CONTACTS.city} и отправим в другие города. Самовывоз — бесплатно.
              </p>
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

          <div className="home-contact section-dark">
            <h2 id="home-contact-title" className="home-h2">
              Есть вопрос? Пиши нам
            </h2>
            <p>
              Ответим в WhatsApp или Telegram, подскажем размер и посчитаем цену. Больше работ и отзывов — в Instagram{' '}
              {CONTACTS.instagramHandle}.
            </p>
            <div className="home-contact__buttons">
              <a
                className="btn btn--neon btn--large"
                href={whatsappWith('Здравствуйте! Хочу заказать товар с фото.')}
                target="_blank"
                rel="noopener noreferrer"
              >
                WhatsApp
              </a>
              <a className="btn btn--on-dark btn--large" href={CONTACTS.telegram} target="_blank" rel="noopener noreferrer">
                Telegram
              </a>
              <a className="btn btn--on-dark btn--large" href={CONTACTS.instagram} target="_blank" rel="noopener noreferrer">
                Instagram
              </a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function CategoryCover({ category, index }) {
  const to = category.id ? `/catalog?category=${category.id}` : '/catalog';
  const icon = ICON_BY_SLUG[category.slug] || ICON_FALLBACK[index % ICON_FALLBACK.length];
  const placeholder = (
    <span className="round-cover home-cat__placeholder" aria-hidden="true">
      <CoverIcon kind={icon} />
    </span>
  );
  return (
    <Link to={to} className="home-cat">
      <span className="home-cat__media">
        {category.imageUrl ? <Img src={category.imageUrl} alt="" className="round-cover" fallback={placeholder} /> : placeholder}
      </span>
      <span className="home-cat__name">{nameOf(category)}</span>
    </Link>
  );
}

// Линейные иконки неоном на графите — как обложки хайлайтов в профиле.
function CoverIcon({ kind }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 3, strokeLinecap: 'round', strokeLinejoin: 'round' };
  return (
    <svg viewBox="0 0 64 64" width="44%" height="44%">
      {kind === 'sticker' && (
        <>
          <circle cx="32" cy="32" r="22" {...common} />
          <path d="M20 26a14 14 0 0 1 10-9" {...common} />
          <path d="M18 44 27 34l7 7 5-5 9 9" {...common} />
        </>
      )}
      {kind === 'keychain' && (
        <>
          <circle cx="32" cy="12" r="6" {...common} />
          <path d="M32 18v6" {...common} />
          <circle cx="32" cy="41" r="17" {...common} />
          <circle cx="32" cy="38" r="5" {...common} />
          <path d="M23 52a10 10 0 0 1 18 0" {...common} />
        </>
      )}
      {kind === 'phone' && (
        <>
          <rect x="17" y="6" width="30" height="52" rx="8" {...common} />
          <rect x="22" y="11" width="11" height="11" rx="3" {...common} />
          <circle cx="36" cy="40" r="7" {...common} />
        </>
      )}
      {kind === 'gift' && (
        <>
          <rect x="11" y="24" width="42" height="30" rx="4" {...common} />
          <path d="M8 24h48M32 24v30M32 24c-4-10-16-12-16-4 0 4 8 4 16 4 8 0 16 0 16-4 0-8-12-6-16 4" {...common} />
        </>
      )}
    </svg>
  );
}

// Задняя крышка телефона с круглыми фото-стикерами, брелок с фото и подпись «здесь твоё фото».
// Сцены «фото» нарисованы абстрактно в цветах бренда — без лиц и чужих снимков.
function HeroArt() {
  const stickers = [
    { x: 292, y: 100, r: 34, scene: 'a' },
    { x: 196, y: 214, r: 42, scene: 'b' },
    { x: 296, y: 228, r: 36, scene: 'c' },
    { x: 206, y: 330, r: 34, scene: 'd' },
    { x: 296, y: 344, r: 38, scene: 'a' },
  ];
  return (
    <figure className="home-hero__art">
      <svg viewBox="0 0 440 460" role="img" aria-labelledby="home-art-cap">
        <defs>
          <linearGradient id="ha-body" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#3a3d42" />
            <stop offset="0.5" stopColor="#232525" />
            <stop offset="1" stopColor="#121314" />
          </linearGradient>
          <linearGradient id="ha-sky-a" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#f4e6e5" />
            <stop offset="1" stopColor="#b5615a" />
          </linearGradient>
          <linearGradient id="ha-sky-b" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ddfbfb" />
            <stop offset="1" stopColor="#0b6b6d" />
          </linearGradient>
          <linearGradient id="ha-sky-c" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#f1f1f4" />
            <stop offset="1" stopColor="#8a8f99" />
          </linearGradient>
          <linearGradient id="ha-sky-d" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#1b2a5c" />
            <stop offset="1" stopColor="#060d2a" />
          </linearGradient>
          {/* Сцены 100×100: пара на закате, портрет у моря, портрет на светлом, ночной город */}
          <g id="ha-scene-a">
            <rect width="100" height="100" fill="url(#ha-sky-a)" />
            <circle cx="70" cy="40" r="13" fill="#fdfdfd" opacity="0.9" />
            <path d="M0 74 Q50 62 100 74 V100 H0Z" fill="#6e2b28" />
            <circle cx="40" cy="50" r="9" fill="#181919" />
            <path d="M26 100 C26 74 54 74 54 100Z" fill="#181919" />
            <circle cx="60" cy="54" r="8" fill="#181919" />
            <path d="M48 100 C48 78 72 78 72 100Z" fill="#181919" />
          </g>
          <g id="ha-scene-b">
            <rect width="100" height="100" fill="url(#ha-sky-b)" />
            <path d="M0 70 Q25 62 50 70 T100 68 V100 H0Z" fill="#08494a" />
            <circle cx="50" cy="46" r="15" fill="#181919" />
            <path d="M22 100 C22 72 78 72 78 100Z" fill="#181919" />
          </g>
          <g id="ha-scene-c">
            <rect width="100" height="100" fill="url(#ha-sky-c)" />
            <circle cx="50" cy="44" r="16" fill="#232525" />
            <path d="M34 36 Q50 18 66 36 Q60 28 50 28 Q40 28 34 36Z" fill="#8f3a36" />
            <path d="M18 100 C18 70 82 70 82 100Z" fill="#8f3a36" />
          </g>
          <g id="ha-scene-d">
            <rect width="100" height="100" fill="url(#ha-sky-d)" />
            <circle cx="28" cy="24" r="2" fill="#11f2f4" />
            <circle cx="72" cy="18" r="1.6" fill="#11f2f4" />
            <circle cx="82" cy="36" r="1.4" fill="#fdfdfd" />
            <path d="M0 100 V64 H14 V52 H26 V70 H38 V44 H52 V66 H62 V56 H76 V72 H88 V60 H100 V100Z" fill="#181919" />
            <path d="M42 50h6M42 58h6M66 62h4" stroke="#11f2f4" strokeWidth="2" />
          </g>
          <clipPath id="ha-clip">
            <circle cx="50" cy="50" r="50" />
          </clipPath>
        </defs>

        {/* Телефон, задняя крышка */}
        <g className="home-art__phone" transform="rotate(-7 250 230)">
          <rect x="140" y="24" width="220" height="400" rx="40" fill="url(#ha-body)" stroke="#b7bbc3" strokeWidth="3" />
          <rect x="146" y="30" width="208" height="388" rx="35" fill="none" stroke="#ffffff" strokeOpacity="0.08" strokeWidth="2" />
          {/* Блок камер */}
          <rect x="158" y="42" width="98" height="98" rx="26" fill="#2b2d30" stroke="#4a4d52" strokeWidth="2" />
          {[
            [184, 68],
            [184, 114],
            [230, 91],
          ].map(([cx, cy]) => (
            <g key={`${cx}-${cy}`}>
              <circle cx={cx} cy={cy} r="17" fill="#0d0e0f" stroke="#5a5d63" strokeWidth="4" />
              <circle cx={cx} cy={cy} r="7" fill="#1b2a5c" />
              <circle cx={cx - 4} cy={cy - 4} r="2.4" fill="#11f2f4" opacity="0.8" />
            </g>
          ))}

          {/* Фото-стикеры: круг с фото + блик «3D-заливки» */}
          {stickers.map((s, i) => (
            <g key={i} transform={`translate(${s.x - s.r} ${s.y - s.r}) scale(${(s.r * 2) / 100})`}>
              <circle cx="50" cy="52" r="50" fill="#000" opacity="0.35" />
              <g clipPath="url(#ha-clip)">
                <use href={`#ha-scene-${s.scene}`} />
              </g>
              <circle cx="50" cy="50" r="49" fill="none" stroke="#d6d7db" strokeWidth="2" />
              <path d="M22 30 A34 34 0 0 1 48 14" fill="none" stroke="#ffffff" strokeOpacity="0.75" strokeWidth="6" strokeLinecap="round" />
            </g>
          ))}
        </g>

        {/* Брелок с фото */}
        <g className="home-art__keychain">
          <circle cx="88" cy="258" r="15" fill="none" stroke="#b7bbc3" strokeWidth="5" />
          <path d="M88 273 v14" stroke="#b7bbc3" strokeWidth="5" strokeLinecap="round" />
          <circle cx="88" cy="292" r="6" fill="none" stroke="#b7bbc3" strokeWidth="4" />
          <g transform="translate(40 300) scale(0.96)">
            <circle cx="50" cy="50" r="54" fill="#d6d7db" />
            <g clipPath="url(#ha-clip)">
              <use href="#ha-scene-b" />
            </g>
            <path d="M20 32 A36 36 0 0 1 46 13" fill="none" stroke="#ffffff" strokeOpacity="0.75" strokeWidth="6" strokeLinecap="round" />
          </g>
        </g>

        {/* Подпись со стрелкой — как в постах */}
        <text className="home-art__note" x="18" y="150">
          <tspan x="18">Здесь</tspan>
          <tspan x="18" dy="30">твоё фото</tspan>
        </text>
        <path className="home-art__arrow" d="M70 196 C96 232 124 236 150 226" />
        <path className="home-art__arrow" d="M138 216 L152 226 L138 236" />
      </svg>
      <figcaption id="home-art-cap" className="sr-only">
        Телефон с круглыми фото-стикерами на крышке и брелок с фото
      </figcaption>
    </figure>
  );
}
