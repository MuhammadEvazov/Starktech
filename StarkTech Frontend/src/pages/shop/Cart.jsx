import '../../styles/site/checkout.css';
import { Link } from '../../lib/router.jsx';
import { useCart } from '../../context/CartContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { attrLabel, attrValue, money, nameOf } from '../../lib/format.js';
import { useAsync } from '../../lib/hooks.js';
import { comboOffersApi } from '../../api/endpoints.js';
import { bestCombo, discountLabel } from '../../lib/combo.js';
import { Img } from '../../components/ui.jsx';
import PhotoPicker from '../../components/PhotoPicker.jsx';
import { Stepper } from './Product.jsx';

const plural = (n, one, few, many) => {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
};

export default function Cart() {
  const cart = useCart();
  const { isAuthenticated } = useAuth();
  const combos = useAsync(() => comboOffersApi.list({ isActive: true, pageSize: 100 }), []);
  const combo = bestCombo(combos.data?.items, cart.items, cart.subtotal);

  if (!cart.items.length) {
    return (
      <div className="site-container cart-x-page">
        <header className="cart-x-head">
          <h1 className="site-title">Корзина</h1>
        </header>
        <div className="site-surface cart-x-empty">
          <h2>Здесь пока пусто</h2>
          <p>Выберите стикер, брелок или чехол — он появится здесь.</p>
          <Link to="/catalog" className="btn btn--primary btn--large">
            Перейти в каталог
          </Link>
        </div>
      </div>
    );
  }

  const needsPhotos = cart.items.some((i) => i.requiresPhoto && !i.photos.length);
  const count = cart.items.reduce((s, i) => s + i.quantity, 0);
  const countLabel = `${count} ${plural(count, 'товар', 'товара', 'товаров')}`;

  return (
    <div className="site-container cart-x-page">
      <header className="cart-x-head">
        <h1 className="site-title">Корзина</h1>
        <p className="site-lead">{countLabel} на сумму {money(cart.subtotal)}</p>
      </header>

      <div className="cart-x-layout">
        <ul className="site-surface cart-x-list" aria-label="Товары в корзине">
          {cart.items.map((item) => {
            const attrs = Object.entries(item.attrs || {});
            const missing = item.requiresPhoto && !item.photos.length;
            return (
              <li key={item.variantId} className="cart-x-item">
                <Img src={item.image} alt="" className="cart-x-thumb" />
                <div className="cart-x-info">
                  <div className="cart-x-top">
                    <Link to={`/product/${item.productId}`} className="cart-x-name">
                      {item.name}
                    </Link>
                    <span className="cart-x-sum cart-x-money">{money(item.price * item.quantity)}</span>
                  </div>
                  {attrs.length > 0 && (
                    <ul className="cart-x-attrs">
                      {attrs.map(([k, v]) => (
                        <li key={k}>
                          {attrLabel(k)}: <b>{attrValue(v)}</b>
                        </li>
                      ))}
                    </ul>
                  )}
                  {item.quantity > 1 && (
                    <span className="cart-x-unit cart-x-money">{money(item.price)} за штуку</span>
                  )}
                </div>

                <div className="cart-x-controls">
                  <Stepper value={item.quantity} onChange={(q) => cart.setQuantity(item.variantId, q)} />
                  <button
                    type="button"
                    className="cart-x-remove"
                    onClick={() => cart.remove(item.variantId)}
                    aria-label={`Удалить «${item.name}» из корзины`}
                  >
                    Удалить
                  </button>
                </div>

                {item.requiresPhoto && (
                  <div className={`cart-x-photos ${missing ? 'is-missing' : ''}`}>
                    <div className="cart-x-photos__head">
                      <span className="cart-x-photos__title">Ваши фото для печати</span>
                      <span className="cart-x-photos__state">
                        {missing ? 'Фото пока не выбрано' : `Выбрано: ${item.photos.length}`}
                      </span>
                    </div>
                    <PhotoPicker compact files={item.photos} onChange={(f) => cart.setPhotos(item.variantId, f)} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        <aside className="site-surface cart-x-summary" aria-label="Итог">
          <h2>Итого</h2>
          <div className="cart-x-row cart-x-row--total">
            <span>Товары</span>
            <span className="cart-x-money">{money(cart.subtotal)}</span>
          </div>
          {combo && (
            <p className="cart-x-note cart-x-note--ok">
              Сработает комбо «{nameOf(combo)}»: {discountLabel(combo)} к сумме товаров.
            </p>
          )}
          {needsPhotos && (
            <p className="cart-x-note cart-x-note--warn">
              {isAuthenticated
                ? 'Для некоторых товаров не выбраны фото. Их можно добавить и позже, в личном кабинете.'
                : 'Для некоторых товаров нужны фото. Войдите, чтобы загрузить их с заказом, или менеджер попросит их после звонка.'}
            </p>
          )}
          <p className="cart-x-fine">Доставка и скидка по промокоду рассчитаются при оформлении.</p>
          {!isAuthenticated && (
            <p className="cart-x-login">
              Чтобы оформить заказ, войдите или зарегистрируйтесь — это займёт минуту. Корзина и фото сохранятся.
            </p>
          )}
          <Link
            to={isAuthenticated ? '/checkout' : '/login'}
            state={isAuthenticated ? undefined : { from: '/checkout' }}
            className="btn btn--primary btn--large btn--block cart-x-go"
          >
            {isAuthenticated ? 'Оформить заказ' : 'Войти и оформить заказ'}
          </Link>
          <Link to="/catalog" className="cart-x-more">
            Продолжить покупки
          </Link>
        </aside>
      </div>

      <div className="cart-x-bar">
        <div className="cart-x-bar__sum">
          <span className="cart-x-bar__label">{countLabel}</span>
          <span className="cart-x-bar__value cart-x-money">{money(cart.subtotal)}</span>
        </div>
        <Link
          to={isAuthenticated ? '/checkout' : '/login'}
          state={isAuthenticated ? undefined : { from: '/checkout' }}
          className="btn btn--primary btn--large"
        >
          {isAuthenticated ? 'Оформить заказ' : 'Войти и оформить'}
        </Link>
      </div>
    </div>
  );
}
