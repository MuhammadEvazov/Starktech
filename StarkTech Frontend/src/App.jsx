import { Router, Routes, Navigate, Link, useLocation } from './lib/router.jsx';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { CartProvider } from './context/CartContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import ShopLayout from './components/ShopLayout.jsx';
import Home from './pages/shop/Home.jsx';
import Catalog from './pages/shop/Catalog.jsx';
import Product from './pages/shop/Product.jsx';
import Cart from './pages/shop/Cart.jsx';
import Checkout from './pages/shop/Checkout.jsx';
import OrderPlaced from './pages/shop/OrderPlaced.jsx';
import Portfolio from './pages/shop/Portfolio.jsx';
import Prices from './pages/shop/Prices.jsx';
import Faq from './pages/shop/Faq.jsx';
import Privacy from './pages/shop/Privacy.jsx';
import Terms from './pages/shop/Terms.jsx';
import Refund from './pages/shop/Refund.jsx';
import { Login, Register, ForgotPassword } from './pages/auth/Auth.jsx';
import Account from './pages/account/Account.jsx';
import { lazy, Suspense } from 'react';

// Админка (и её стили) — отдельный чанк: покупателям она не нужна.
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout.jsx'));

function AdminApp() {
  return (
    <Suspense fallback={<p className="muted" style={{ padding: 24 }}>Загружаем админку…</p>}>
      <AdminLayout />
    </Suspense>
  );
}

function RequireAuth({ children, admin }) {
  const { isAuthenticated, isAdmin } = useAuth();
  const { pathname } = useLocation();
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: pathname }} />;
  if (admin && !isAdmin) {
    return (
      <ShopLayout>
        <div className="container narrow page-pad">
          <h1 className="page-title">Нет доступа</h1>
          <p className="lead">Админка доступна ролям «Администратор» и «Суперадмин».</p>
          <Link to="/" className="btn btn--primary">На главную</Link>
        </div>
      </ShopLayout>
    );
  }
  return children;
}

function NotFound() {
  return (
    <div className="container narrow page-pad">
      <h1 className="page-title">Страница не найдена</h1>
      <p className="lead">Возможно, ссылка устарела. Начните с каталога.</p>
      <Link to="/catalog" className="btn btn--primary">Открыть каталог</Link>
    </div>
  );
}

const shop = (el) => <ShopLayout>{el}</ShopLayout>;
const t = (page) => `${page} — StarkTech`;

export default function App() {
  return (
    <Router>
      <ToastProvider>
        <AuthProvider>
          <CartProvider>
            <Routes
              // title — заголовок вкладки; страница товара после загрузки ставит своё название сама.
              routes={[
                { path: '/', title: 'StarkTech — 3D-стикеры, брелки и чехлы с вашими фото', element: shop(<Home />) },
                { path: '/catalog', title: t('Каталог'), element: shop(<Catalog />) },
                { path: '/product/:id', title: t('Товар'), element: shop(<Product />) },
                { path: '/portfolio', title: t('Наши работы'), element: shop(<Portfolio />) },
                { path: '/prices', title: t('Цены'), element: shop(<Prices />) },
                { path: '/faq', title: t('Вопросы и ответы'), element: shop(<Faq />) },
                { path: '/privacy', title: t('Политика конфиденциальности'), element: shop(<Privacy />) },
                { path: '/terms', title: t('Публичная оферта'), element: shop(<Terms />) },
                { path: '/refund', title: t('Политика возврата'), element: shop(<Refund />) },
                // Корзина и фото — только после входа; гость может смотреть каталог.
                { path: '/cart', title: t('Корзина'), element: <RequireAuth>{shop(<Cart />)}</RequireAuth> },
                // Заказ оформляет только вошедший покупатель: у заказа есть владелец, фото загружаются сами.
                { path: '/checkout', title: t('Оформление заказа'), element: <RequireAuth>{shop(<Checkout />)}</RequireAuth> },
                { path: '/order/:number', title: t('Заказ оформлен'), element: shop(<OrderPlaced />) },
                { path: '/login', title: t('Вход'), element: shop(<Login />) },
                { path: '/register', title: t('Регистрация'), element: shop(<Register />) },
                { path: '/forgot-password', title: t('Восстановление пароля'), element: shop(<ForgotPassword />) },
                { path: '/account/*', title: t('Личный кабинет'), element: <RequireAuth>{shop(<Account />)}</RequireAuth> },
                { path: '/account', title: t('Личный кабинет'), element: <RequireAuth>{shop(<Account />)}</RequireAuth> },
                { path: '/admin/*', title: t('Админка'), element: <RequireAuth admin><AdminApp /></RequireAuth> },
                { path: '/admin', title: t('Админка'), element: <RequireAuth admin><AdminApp /></RequireAuth> },
              ]}
              fallback={shop(<NotFound />)}
              fallbackTitle={t('Страница не найдена')}
            />
          </CartProvider>
        </AuthProvider>
      </ToastProvider>
    </Router>
  );
}
