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
import { Login, Register, ForgotPassword } from './pages/auth/Auth.jsx';
import Account from './pages/account/Account.jsx';
import AdminLayout from './pages/admin/AdminLayout.jsx';

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

export default function App() {
  return (
    <Router>
      <ToastProvider>
        <AuthProvider>
          <CartProvider>
            <Routes
              routes={[
                { path: '/', element: shop(<Home />) },
                { path: '/catalog', element: shop(<Catalog />) },
                { path: '/product/:id', element: shop(<Product />) },
                { path: '/portfolio', element: shop(<Portfolio />) },
                { path: '/prices', element: shop(<Prices />) },
                // Корзина и фото — только после входа; гость может смотреть каталог.
                { path: '/cart', element: <RequireAuth>{shop(<Cart />)}</RequireAuth> },
                // Заказ оформляет только вошедший покупатель: у заказа есть владелец, фото загружаются сами.
                { path: '/checkout', element: <RequireAuth>{shop(<Checkout />)}</RequireAuth> },
                { path: '/order/:number', element: shop(<OrderPlaced />) },
                { path: '/login', element: shop(<Login />) },
                { path: '/register', element: shop(<Register />) },
                { path: '/forgot-password', element: shop(<ForgotPassword />) },
                { path: '/account/*', element: <RequireAuth>{shop(<Account />)}</RequireAuth> },
                { path: '/account', element: <RequireAuth>{shop(<Account />)}</RequireAuth> },
                { path: '/admin/*', element: <RequireAuth admin><AdminLayout /></RequireAuth> },
                { path: '/admin', element: <RequireAuth admin><AdminLayout /></RequireAuth> },
              ]}
              fallback={shop(<NotFound />)}
            />
          </CartProvider>
        </AuthProvider>
      </ToastProvider>
    </Router>
  );
}
