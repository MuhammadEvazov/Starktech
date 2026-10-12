# StarkTech: фронтенд

React 18 + Vite, без UI-библиотек. Витрина магазина (стикеры, брелки и чехлы с фото) и админ-панель поверх ASP.NET API из соседней папки `StarkTech/`.

## Запуск

1. Запустите бэкенд по инструкции из `StarkTech/README.md` (Postgres и Redis в Docker, секреты, миграции), затем:

   ```
   cd StarkTech
   dotnet run --project WebApi
   ```

   API поднимется на `http://localhost:5076`. Используйте профиль `http`: при `https` бэкенд редиректит запросы и dev-прокси их не пропустит.

2. Запустите фронтенд:

   ```
   cd frontend
   npm install
   npm run dev
   ```

   Откройте http://localhost:5173

Vite проксирует `/api`, `/uploads` и `/swagger` на бэкенд, поэтому CORS при локальной разработке не нужен. Другой адрес бэкенда задаётся через `.env` (см. `.env.example`).

Войти в админку можно под супер-админом `admin@starktech.tj` с паролем из `Seed:SuperAdminPassword`.

## Продакшен

```
npm run build
```

Готовые файлы лежат в `dist/`. Есть два варианта размещения:

- **Тот же домен, что и API.** Скопируйте `dist/` в `StarkTech/WebApi/wwwroot` и добавьте в `Program.cs` строку `app.MapFallbackToFile("index.html");`, чтобы роуты SPA открывались по прямой ссылке.
- **Отдельный домен.** Перед сборкой задайте `VITE_API_URL=https://api.example.tj` и добавьте домен фронтенда в `Cors:Origins` в `appsettings.json` бэкенда.

## Структура

```
src/
  api/client.js        fetch-обёртка: токен, разворачивание Result<T>, ошибки
  api/endpoints.js     все эндпоинты контроллеров WebApi
  context/             авторизация (JWT), корзина, уведомления
  lib/router.jsx       небольшой роутер на History API
  lib/format.js        деньги, даты, подписи enum'ов
  components/          общие UI-компоненты, лист стикеров, выбор фото
  pages/shop/          главная, каталог, товар, корзина, оформление
  pages/auth/          вход, регистрация, восстановление пароля
  pages/account/       заказы клиента с загрузкой фото, профиль, пароль
  pages/admin/         админ-панель (CrudPage — универсальная таблица с формой)
  styles/              base.css (токены), shop.css, admin.css
```

## Что связано с бэкендом

| Экран | Эндпоинты |
|---|---|
| Главная, каталог, товар | `categories`, `products`, `product-variants`, `reviews`, `portfolio-items`, `delivery-cities` |
| Оформление заказа | `POST /api/orders`, поиск промокода `GET /api/promo-codes?code=`, загрузка фото `POST /api/order-items/{id}/photos` |
| Вход и кабинет | `auth/*`, `profile`, `orders` (сервер сам ограничивает их заказами клиента) |
| Админка | все контроллеры, включая `User`, `role-permissions`, `coins-transactions`, `telegram-bindings`, `notifications` |

Права проверяет сервер. Пункты меню «Пользователи», «Монеты» и «Права ролей» показываются только роли SuperAdmin. Если права в БД изменены, сервер вернёт 403, и на странице появится понятное сообщение.

## Известные ограничения API

- Загрузка фото к заказу требует авторизации. Гость может оформить заказ, но фото к нему загрузит менеджер или сам клиент после регистрации.
- В `ProfileDto` нет баланса монет, поэтому списание монет при оформлении пока не выведено.
- `OrderItemDto` и `GetReviewDto` отдают только `ProductNameEn`, поэтому в заказах названия товаров на английском.
