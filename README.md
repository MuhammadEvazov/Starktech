# StarkTech

Интернет-магазин печати фото на 3D-стикерах, брелках и чехлах: сайт для покупателей, личный кабинет,
админка и чат с менеджером в реальном времени.

| Папка | Что внутри |
|---|---|
| [`StarkTech Backend`](StarkTech%20Backend) | ASP.NET Core 9 Web API, EF Core + PostgreSQL, Redis, Identity + JWT, SignalR (чат) |
| [`StarkTech Frontend`](StarkTech%20Frontend) | React 18 + Vite: сайт, личный кабинет и админка |

## Запуск для разработки

1. **Бэкенд** — Docker (PostgreSQL и Redis) поднимается сам при старте:
   ```bash
   cd "StarkTech Backend"
   dotnet run --project WebApi
   ```
   Секреты (JWT-ключ, пароль администратора, почта) хранятся в `dotnet user-secrets`, не в репозитории —
   подробности в [README бэкенда](StarkTech%20Backend/README.md).

2. **Фронтенд** — запросы `/api`, `/uploads` и `/hubs` Vite проксирует на бэкенд:
   ```bash
   cd "StarkTech Frontend"
   npm install
   npm run dev
   ```
   Сайт откроется на http://localhost:5173, админка — на `/admin`.
