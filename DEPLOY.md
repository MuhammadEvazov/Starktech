# Деплой StarkTech (бесплатные тарифы): сайт — Vercel, API — Render, файлы — Supabase Storage

```
Покупатель ──► https://….vercel.app (Vercel Hobby: React-сайт)
                    │  запросы /api, чат /hubs
                    ▼
               https://starktech-api.onrender.com (Render Free: ASP.NET Core API, Docker)
                    ├── PostgreSQL (Render Free — 30 дней, или Neon Free — без срока)
                    ├── Key Value / Redis (Render Free)
                    └── Файлы: фото, чеки, макеты → Supabase Storage (S3, Free 1 ГБ)
```

Почему так: Vercel не запускает .NET; у бесплатного Render нет постоянного диска (файлы пропадали бы
при каждом перезапуске) — поэтому фото и чеки хранятся во внешнем бесплатном хранилище.

> **Ограничения бесплатных тарифов** — см. раздел в конце. Главное: API «засыпает» через 15 минут без
> запросов (первое открытие после сна ~1 минута), бесплатная база Render удаляется через 30 дней.

---

## Шаг 0. Хранилище файлов — Supabase Storage (бесплатно, без карты)

1. Зарегистрируйтесь на <https://supabase.com> → **New project** (регион — ближайший, например Frankfurt / `eu-central-1`).
2. **Storage → New bucket** → имя `starktech`, включите **Public bucket**.
3. **Project Settings → Storage → S3 Connection** (или **Storage → Settings**):
   - включите **S3 protocol** (если выключен);
   - скопируйте **Endpoint** и **Region**;
   - **New access key** → сохраните **Access key ID** и **Secret access key** (секрет показывается один раз).
4. Публичный адрес бакета: `https://<project-ref>.supabase.co/storage/v1/object/public/starktech`
   (`<project-ref>` — из адреса проекта).

Подойдёт и любое другое S3-хранилище (Cloudflare R2, Backblaze B2) — те же 6 переменных.
У R2/B2 настройте CORS бакета: разрешите `GET` с адреса сайта (фото рисуются в редакторе кадра).

## Шаг 1. API на Render

1. Зарегистрируйтесь на <https://render.com>, подключите GitHub-репозиторий `MuhammadEvazov/Starktech`.
2. **New → Blueprint** → выберите репозиторий. Render прочитает `render.yaml` и создаст (всё на Free):
   `starktech-api` (Docker), `starktech-db` (PostgreSQL), `starktech-redis` (Key Value).
3. Заполните секреты:

   | Переменная | Что указать |
   |---|---|
   | `Cors__Origins__0` | адрес сайта на Vercel, например `https://starktech.vercel.app` (без `/` в конце) |
   | `Cors__OriginSuffixes__0` | окончание адресов превью Vercel, например `-muhammadevazovs-projects.vercel.app` (можно пусто) |
   | `Seed__SuperAdminEmail` | email суперадмина |
   | `Seed__SuperAdminPassword` | надёжный пароль (≥ 8 символов: заглавная, строчная, цифра, символ) |
   | `EmailSettings__Password` | пароль приложения Gmail (письма для сброса пароля) |
   | `Storage__S3__ServiceUrl` | Endpoint из шага 0, например `https://<project-ref>.supabase.co/storage/v1/s3` |
   | `Storage__S3__Region` | Region из шага 0, например `eu-central-1` |
   | `Storage__S3__Bucket` | `starktech` |
   | `Storage__S3__AccessKey` / `Storage__S3__SecretKey` | ключи из шага 0 |
   | `Storage__S3__PublicBaseUrl` | `https://<project-ref>.supabase.co/storage/v1/object/public/starktech` |

   `JWT__Key` Render сгенерирует сам; база и Redis подключатся автоматически.
4. Дождитесь деплоя (первая сборка Docker — 5–10 минут). API сам применит миграции и создаст суперадмина.
5. Проверка: `https://starktech-api.onrender.com/health` → `Healthy`.

### База без срока годности — Neon (рекомендуется вместо бесплатной базы Render)
1. <https://neon.tech> → New project (регион Frankfurt) → скопируйте **connection string** (`postgresql://…?sslmode=require`).
2. В Render у `starktech-api` замените переменную `ConnectionStrings__DefaultConnection` на эту строку
   (API понимает формат `postgresql://…`). Базу `starktech-db` в Render после этого можно удалить.

## Шаг 2. Сайт на Vercel

1. <https://vercel.com> → **Add New → Project** → импортируйте тот же репозиторий.
2. **Root Directory**: `StarkTech Frontend` (настройки сборки — в `StarkTech Frontend/vercel.json`).
3. **Environment Variables** (Production и Preview): `VITE_API_URL` = `https://starktech-api.onrender.com`
   (без `/` в конце). Значение зашивается при сборке — после изменения нажмите **Redeploy**.
4. **Deploy** → получите адрес `https://….vercel.app` и впишите его в `Cors__Origins__0` на Render.

## Шаг 3. Проверка

- Прямые ссылки `/catalog`, `/product/…`, `/account`, `/admin` открываются (без 404).
- Вход суперадмином → **Админка → Оплата**: реквизиты; добавьте города доставки и товары.
- Заказ с фото → фото видно в заказе; адрес картинки начинается с `https://<project-ref>.supabase.co/…`.
- Чат «Написать нам» работает (DevTools → Network → WS → `…/hubs/chat`).

## Ограничения бесплатных тарифов (важно)

| Что | Ограничение | Что делать |
|---|---|---|
| Render Free (API) | засыпает через 15 мин простоя, просыпается ~1 мин; 750 часов в месяц | для магазина «в бою» — план Starter (~$7/мес) |
| Render Free (PostgreSQL) | удаляется через 30 дней | Neon Free или платный план Render до истечения срока |
| Render Free (Key Value) | без сохранения на диск | это только кэш — данные не теряются |
| Supabase Free | 1 ГБ файлов, проект ставится на паузу после 7 дней без активности | заходить в панель / платный план при росте |
| Vercel Hobby | только для **некоммерческого** использования по правилам Vercel | для работающего магазина — Vercel Pro или Cloudflare Pages / Netlify (бесплатно и для коммерции) |

Переход на платные тарифы код не меняет — только план в Render/Vercel и переменные окружения.

## Локальная разработка — без изменений

`dotnet run --project WebApi` + `npm run dev`; файлы хранятся локально в `wwwroot/uploads`
(хранилище S3 включается только переменной `Storage__Provider=s3`).
