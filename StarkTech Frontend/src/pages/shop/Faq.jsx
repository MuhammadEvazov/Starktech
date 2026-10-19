import '../../styles/site/home.css';
import '../../styles/site/info.css';
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from '../../lib/router.jsx';
import { CONTACTS, whatsappWith } from '../../lib/contacts.js';

// Вопросы и ответы. Ответы — простой текст (по нему работает поиск),
// ссылки — отдельным полем links: { to } для страниц сайта, { href } для внешних.
// id раздела — якорь: /faq#returns, /faq#payment и т. д.
const SECTIONS = [
  {
    id: 'order',
    title: 'Как заказать',
    items: [
      {
        q: 'Как оформить заказ?',
        a: [
          'Выбери товар в каталоге и войди в аккаунт (email и пароль). На странице товара загрузи фото и подгони каждое под форму — сердце, круг или чехол.',
          'Добавь товар в корзину и оформи заказ: укажи адрес или самовывоз и способ оплаты. Статус заказа виден в личном кабинете.',
        ],
        links: [{ to: '/catalog', label: 'Открыть каталог' }],
      },
      {
        q: 'Можно заказать без регистрации?',
        a: [
          'Нет. Фото и заказ привязываются к твоему аккаунту — так мы не перепутаем снимки, а ты видишь статус, макет и чат с менеджером в одном месте. Регистрация занимает минуту.',
        ],
        links: [{ to: '/register', label: 'Зарегистрироваться' }],
      },
      {
        q: 'Сколько времени занимает изготовление?',
        a: [
          `Обычно ${CONTACTS.leadTime} после подтверждения заказа. Если менеджер присылает макет на согласование, срок считается с момента, когда ты его одобрил.`,
        ],
      },
    ],
  },
  {
    id: 'photos',
    title: 'Фото',
    items: [
      {
        q: 'Какие фото подходят?',
        a: [
          'Форматы JPG, PNG или WEBP, размер файла — до 5 МБ.',
          'Лучше всего печатаются чёткие снимки при хорошем свете, примерно от 1000 пикселей по короткой стороне. Скриншоты, фото с экрана и сильно увеличенные кадры получаются размытыми.',
        ],
      },
      {
        q: 'Сколько фото нужно загрузить?',
        a: [
          'Одно фото — одна штука: 5 стикеров — 5 фото. Если хочешь несколько одинаковых, загрузи один снимок нужное количество раз.',
        ],
      },
      {
        q: 'Есть скидка, если заказать много?',
        a: [
          'Да, у многих товаров цена за штуку снижается с количеством. Пороги скидки указаны на странице товара, а итог пересчитывается в корзине. Про комбо-наборы и промокоды — в разделе «Оплата».',
        ],
        links: [{ to: '/prices', label: 'Посмотреть цены' }],
      },
    ],
  },
  {
    id: 'layout',
    title: 'Согласование макета',
    items: [
      {
        q: 'Что такое макет и зачем его согласовывать?',
        a: [
          'Иногда менеджер готовит макет — картинку того, как фото ляжет на изделие. Он появляется в личном кабинете в карточке заказа.',
          'Пока ты не одобришь макет, заказ в печать не уходит. Если что-то не так, попроси правки там же и опиши, что поменять, — менеджер пришлёт новый вариант.',
        ],
        links: [{ to: '/account', label: 'Мои заказы' }],
      },
      {
        q: 'Макет присылают всегда?',
        a: [
          'Нет, только когда нужно что-то уточнить: обрезку, расположение, несколько фото на одном изделии. Если макета нет, печатаем фото так, как ты подогнал его на странице товара.',
        ],
      },
    ],
  },
  {
    id: 'payment',
    title: 'Оплата',
    items: [
      {
        q: 'Какие способы оплаты есть?',
        a: [
          'Наличными при получении, Корти Миллӣ, Alif Pay или переводом на карту. При переводе загрузи скриншот чека в карточке заказа — его проверит менеджер, и оплата отразится в заказе.',
        ],
      },
      {
        q: 'Нужна ли предоплата?',
        a: [
          'Процент предоплаты задаёт магазин, точная сумма к предоплате видна при оформлении заказа. Остаток оплачиваешь при получении или переводом.',
        ],
      },
      {
        q: 'Скидки суммируются?',
        a: [
          'Нет. Если подходят и промокод, и комбо-набор, применяется одна скидка — та, что выгоднее для тебя. Скидка за количество уже заложена в цену штуки.',
        ],
      },
    ],
  },
  {
    id: 'changes',
    title: 'Изменение и отмена',
    items: [
      {
        q: 'Можно изменить заказ после оформления?',
        a: [
          'Да, пока заказ в статусе «Новый» или «Подтверждён» и ещё не оплачен — состав и количество меняются прямо в личном кабинете.',
          'Если ты уже внёс оплату или отправил чек на проверку, изменения делает менеджер: напиши ему в чате на сайте.',
        ],
      },
      {
        q: 'Как отменить заказ?',
        a: [
          'Напиши менеджеру в чате, пока заказ не ушёл в производство. После начала печати отменить его нельзя — изделие уже сделано под тебя.',
          'Если заказ отменяем мы (например, не можем напечатать фото в нужном качестве), предоплату вернём полностью.',
        ],
      },
    ],
  },
  {
    id: 'returns',
    title: 'Возврат и брак',
    items: [
      {
        q: 'Можно вернуть товар, если он не понравился?',
        a: [
          'Стикеры, брелки и чехлы печатаются с твоими фото и больше никому не подойдут, поэтому возврата «передумал» нет. Именно для этого мы показываем подгонку фото и макеты до печати.',
        ],
      },
      {
        q: 'Что делать, если пришёл брак?',
        a: [
          'Если есть дефект, ошибка печати или фото обрезано не так, как было согласовано, — это наша ошибка. Бесплатно перепечатаем или вернём деньги, на твой выбор.',
          'Напиши в чат на сайте или в WhatsApp в течение 3 дней после получения и приложи фото изделия и номер заказа.',
        ],
        links: [{ href: whatsappWith('Здравствуйте! Проблема с заказом №'), label: 'Написать в WhatsApp' }],
      },
    ],
  },
  {
    id: 'delivery',
    title: 'Доставка и самовывоз',
    items: [
      {
        q: 'Куда и за сколько доставляете?',
        a: [
          `Привозим до двери в ${CONTACTS.city} и отправляем в другие города Таджикистана. Список городов и стоимость доставки видны при оформлении заказа — цена добавляется к сумме автоматически.`,
        ],
      },
      {
        q: 'Можно забрать самому?',
        a: ['Да, самовывоз бесплатный. Выбери его при оформлении, а когда заказ будет готов, менеджер напишет и подскажет, куда подойти.'],
      },
    ],
  },
  {
    id: 'coins',
    title: 'Монеты',
    items: [
      {
        q: 'Что такое монеты?',
        a: [
          'Это бонусы за покупки. Они начисляются на счёт после того, как заказ доставлен, и считаются от стоимости товаров без доставки.',
          '1 монета = 1 сомони. Списать монеты можно при оформлении следующего заказа. Если заказ отменён, списанные монеты возвращаются.',
        ],
        links: [{ to: '/account/coins', label: 'Мои монеты' }],
      },
    ],
  },
];

const norm = (s) => s.toLowerCase().replace(/ё/g, 'е');

export default function Faq() {
  const [query, setQuery] = useState('');
  const location = useLocation();
  const q = norm(query.trim());

  const sections = useMemo(() => {
    if (!q) return SECTIONS;
    return SECTIONS.map((s) => ({
      ...s,
      items: s.items.filter((it) => norm([s.title, it.q, ...it.a].join(' ')).includes(q)),
    })).filter((s) => s.items.length > 0);
  }, [q]);

  // Якорь (/faq#returns): роутер прокручивает наверх, поэтому доводим до раздела сами
  // и раскрываем первый вопрос в нём. location меняется при каждом переходе, даже по той же странице.
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (!id) return undefined;
    const raf = requestAnimationFrame(() => {
      const el = document.getElementById(id);
      if (!el) return;
      const first = el.querySelector('details');
      if (first) first.open = true;
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    });
    return () => cancelAnimationFrame(raf);
  }, [location]);

  const total = sections.reduce((n, s) => n + s.items.length, 0);

  return (
    <div className="site-container faq-page">
      <header className="faq-hero promo-panel">
        <div className="faq-hero__text">
          <h1 className="faq-hero__title display-upper">Вопросы и ответы</h1>
          <p className="faq-hero__lead">
            Как загрузить фото, оплатить, вернуть брак и получить заказ. Не нашёл ответ — напиши нам.
          </p>
        </div>
        {/* Фирменный знак: «?» в неоновом кольце */}
        <span className="faq-hero__mark neon-outline" aria-hidden="true">
          ?
        </span>
        <label className="faq-search">
          <span className="sr-only">Поиск по вопросам</span>
          <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
            <circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="m13 13 4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Например, «чек» или «доставка»"
            autoComplete="off"
          />
        </label>
      </header>

      <div className="faq-layout">
        <nav className="faq-toc" aria-label="Разделы">
          <ul>
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="faq-toc__link">
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="faq-body">
          <p className="sr-only" aria-live="polite">
            {q ? `Найдено вопросов: ${total}` : ''}
          </p>
          {sections.length === 0 ? (
            <div className="faq-empty site-surface">
              <p>
                <strong>По запросу «{query.trim()}» ничего нет.</strong> Попробуй другое слово или спроси менеджера.
              </p>
              <button type="button" className="btn btn--ghost" onClick={() => setQuery('')}>
                Показать все вопросы
              </button>
            </div>
          ) : (
            sections.map((s) => (
              <section key={s.id} id={s.id} className="faq-section" aria-labelledby={`${s.id}-title`}>
                <h2 id={`${s.id}-title`} className="faq-section__title">
                  {s.title}
                </h2>
                <div className="faq-list">
                  {s.items.map((it) => (
                    <details key={it.q} className="faq-item" open={Boolean(q) || undefined}>
                      <summary>
                        <span>{it.q}</span>
                        <svg className="faq-item__chev" viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
                          <path d="m5 7.5 5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </summary>
                      <div className="faq-item__answer">
                        {it.a.map((p) => (
                          <p key={p}>{p}</p>
                        ))}
                        {it.links?.length > 0 && (
                          <p className="faq-item__links">
                            {it.links.map((l) =>
                              l.to ? (
                                <Link key={l.label} to={l.to}>
                                  {l.label}
                                </Link>
                              ) : (
                                <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer">
                                  {l.label}
                                </a>
                              ),
                            )}
                          </p>
                        )}
                      </div>
                    </details>
                  ))}
                </div>
              </section>
            ))
          )}

          <aside className="faq-contact section-dark" aria-labelledby="faq-contact-title">
            <div>
              <h2 id="faq-contact-title">Остался вопрос?</h2>
              <p>
                Напиши в чат на сайте, в WhatsApp или Telegram — или позвони:{' '}
                <a href={CONTACTS.phoneHref}>{CONTACTS.phone}</a>.
              </p>
            </div>
            <div className="faq-contact__buttons">
              <a
                className="btn btn--neon btn--large"
                href={whatsappWith('Здравствуйте! У меня вопрос по заказу.')}
                target="_blank"
                rel="noopener noreferrer"
              >
                Написать в WhatsApp
              </a>
              <a className="btn btn--on-dark btn--large" href={CONTACTS.telegram} target="_blank" rel="noopener noreferrer">
                Telegram
              </a>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
