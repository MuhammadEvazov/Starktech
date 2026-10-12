import { useState } from 'react';
import { Link, NavLink, useLocation } from '../lib/router.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import { CONTACTS } from '../lib/contacts.js';
import ChatWidget from './chat/ChatWidget.jsx';

export function Logo() {
  return (
    <Link to="/" className="logo" aria-label="StarkTech, на главную">
      <svg viewBox="0 0 64 64" aria-hidden="true" className="logo__mark">
        <path
          d="M32 56 C10 42 4 30 8 20 C12 10 26 8 32 20 C38 8 52 10 56 20 C60 30 54 42 32 56Z"
          fill="var(--cobalt)"
          stroke="#fff"
          strokeWidth="5"
          paintOrder="stroke"
        />
      </svg>
      <span>StarkTech</span>
    </Link>
  );
}

export default function ShopLayout({ children }) {
  const { isAuthenticated, isAdmin, profile } = useAuth();
  const { count } = useCart();
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  return (
    <div className="shop">
      <a href="#main" className="skip-link">
        К содержимому
      </a>
      <header className="shop-header">
        <div className="container shop-header__row">
          <Logo />
          <button
            type="button"
            className="shop-header__burger"
            aria-expanded={open}
            aria-controls="shop-nav"
            onClick={() => setOpen((o) => !o)}
          >
            Меню
          </button>
          <nav id="shop-nav" className={`shop-nav ${open ? 'is-open' : ''}`} onClick={() => setOpen(false)}>
            <NavLink to="/catalog">Каталог</NavLink>
            <NavLink to="/prices">Цены</NavLink>
            <NavLink to="/portfolio">Наши работы</NavLink>
            {isAdmin && <NavLink to="/admin">Админка</NavLink>}
            {isAuthenticated ? (
              <NavLink to="/account">{profile?.fullName?.split(' ')[0] || 'Кабинет'}</NavLink>
            ) : (
              <NavLink to="/login" state={{ from: pathname }}>
                Войти
              </NavLink>
            )}
            <NavLink to="/cart" className="shop-nav__cart">
              Корзина
              {count > 0 && <span className="cart-count">{count}</span>}
            </NavLink>
          </nav>
        </div>
      </header>

      <main id="main" className="shop-main">
        {children}
      </main>

      <footer className="shop-footer">
        <div className="container shop-footer__row">
          <div>
            <Logo />
            <p className="shop-footer__text">
              3D-стикеры, брелки и чехлы с вашими фотографиями. Делаем в Душанбе, доставляем по Таджикистану.
            </p>
          </div>
          <nav className="shop-footer__nav" aria-label="Разделы">
            <Link to="/catalog">Каталог</Link>
            <Link to="/prices">Цены</Link>
            <Link to="/portfolio">Наши работы</Link>
            <Link to="/cart">Корзина</Link>
            <Link to="/account">Личный кабинет</Link>
          </nav>
          <address className="shop-footer__contacts">
            <a href={CONTACTS.phoneHref}>{CONTACTS.phone}</a>
            <a href={CONTACTS.whatsapp} target="_blank" rel="noopener noreferrer">WhatsApp</a>
            <a href={CONTACTS.telegram} target="_blank" rel="noopener noreferrer">Telegram</a>
            <a href={CONTACTS.instagram} target="_blank" rel="noopener noreferrer">
              Instagram {CONTACTS.instagramHandle}
            </a>
            <span>
              {CONTACTS.city}, срок изготовления {CONTACTS.leadTime}
            </span>
          </address>
          <p className="shop-footer__copy">© {new Date().getFullYear()} StarkTech</p>
        </div>
      </footer>

      <ChatWidget />
    </div>
  );
}
