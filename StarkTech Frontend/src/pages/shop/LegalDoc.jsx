import '../../styles/site/home.css';
import '../../styles/site/info.css';
import { useEffect } from 'react';
import { Link, useLocation } from '../../lib/router.jsx';
import { COMPANY, LEGAL_UPDATED, legalUpdatedText } from '../../lib/legal.js';

// Общий каркас юридических страниц (/privacy, /terms, /refund) в стиле «Вопросов и ответов»:
// шапка-баннер, оглавление слева и разделы-карточки. id раздела — якорь (/privacy#cookies).
export default function LegalDoc({ title, lead, sticker, sections }) {
  const location = useLocation();

  // Роутер прокручивает наверх при переходе, поэтому до якоря доводим сами (как на /faq).
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (!id) return undefined;
    const raf = requestAnimationFrame(() => {
      const el = document.getElementById(id);
      if (!el) return;
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    });
    return () => cancelAnimationFrame(raf);
  }, [location]);

  return (
    <div className="site-container faq-page legal-page">
      <header className="faq-hero">
        <div className="faq-hero__text">
          <h1 className="faq-hero__title">{title}</h1>
          <p className="faq-hero__lead">{lead}</p>
          <p className="legal-hero__date">
            Редакция от <time dateTime={LEGAL_UPDATED}>{legalUpdatedText()}</time>
          </p>
        </div>
        <span className="faq-hero__sticker" aria-hidden="true">
          {sticker}
        </span>
      </header>

      <div className="faq-layout">
        <nav className="faq-toc" aria-label="Разделы документа">
          <ul>
            {sections.map((s, i) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className={`faq-toc__link faq-tone--${s.tone || 'cobalt'}`}>
                  <span className="faq-dot" aria-hidden="true" />
                  {i + 1}. {s.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="faq-body">
          {sections.map((s, i) => (
            <section
              key={s.id}
              id={s.id}
              className={`faq-section legal-section faq-tone--${s.tone || 'cobalt'}`}
              aria-labelledby={`${s.id}-title`}
            >
              <h2 id={`${s.id}-title`} className="faq-section__title">
                <span className="faq-dot" aria-hidden="true" />
                {i + 1}. {s.title}
              </h2>
              <div className="legal-prose">{s.content}</div>
            </section>
          ))}

          <aside className="faq-contact" aria-labelledby="legal-contact-title">
            <div>
              <h2 id="legal-contact-title">Остались вопросы?</h2>
              <p>
                Напишите в чат на сайте или позвоните: <a href={COMPANY.phoneHref}>{COMPANY.phone}</a>. Ответы на частые
                вопросы — на странице <Link to="/faq">«Вопросы и ответы»</Link>.
              </p>
            </div>
            <div className="faq-contact__buttons">
              <a className="btn btn--large home-btn-wa" href={COMPANY.whatsapp} target="_blank" rel="noopener noreferrer">
                WhatsApp
              </a>
              <a className="btn btn--large faq-contact__tg" href={COMPANY.telegram} target="_blank" rel="noopener noreferrer">
                Telegram
              </a>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

/** Блок реквизитов продавца/оператора. */
export function Requisites() {
  return (
    <dl className="legal-requisites">
      <dt>Продавец</dt>
      <dd>{COMPANY.legalName}</dd>
      <dt>ИНН</dt>
      <dd>{COMPANY.tin}</dd>
      <dt>Адрес</dt>
      <dd>{COMPANY.address}</dd>
      <dt>Телефон</dt>
      <dd>
        <a href={COMPANY.phoneHref}>{COMPANY.phone}</a>
      </dd>
      <dt>Email</dt>
      <dd>{COMPANY.email.includes('@') ? <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a> : COMPANY.email}</dd>
      <dt>Мессенджеры</dt>
      <dd>
        <a href={COMPANY.whatsapp} target="_blank" rel="noopener noreferrer">
          WhatsApp
        </a>
        {', '}
        <a href={COMPANY.telegram} target="_blank" rel="noopener noreferrer">
          Telegram
        </a>
        {', чат на сайте'}
      </dd>
    </dl>
  );
}
