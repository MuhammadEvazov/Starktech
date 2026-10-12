# StarkTech

Backend API: ASP.NET Core 9, EF Core, PostgreSQL 17, Redis.

## Требования

- .NET 9 SDK
- Docker Desktop
- EF Core CLI: `dotnet tool install --global dotnet-ef`

## Локальный запуск

1. Поднять Postgres (`localhost:5434`) и Redis (`localhost:6380`):

   ```
   docker compose up -d
   ```

2. Задать секреты. В репозитории их нет, они хранятся в `dotnet user-secrets` на вашей машине:

   ```
   dotnet user-secrets set "ConnectionStrings:DefaultConnection" "Host=localhost;Port=5434;Database=starktech;Username=postgres;Password=<POSTGRES_PASSWORD из docker-compose.yml>" --project WebApi
   dotnet user-secrets set "JWT:Key" "<случайная строка, минимум 64 символа>" --project WebApi
   dotnet user-secrets set "EmailSettings:Password" "<app password Gmail>" --project WebApi
   ```

   Сгенерировать JWT-ключ: `openssl rand -base64 64`

3. Применить миграции:

   ```
   dotnet ef database update --project Infrastructure --startup-project WebApi
   ```

4. Запустить API:

   ```
   dotnet run --project WebApi
   ```

   Swagger: http://localhost:5076/swagger

При старте создаются роли, права, супер-админ `admin@starktech.tj` (пароль по умолчанию — в `Infrastructure/Identity/DataSeed.cs`, смените его после первого входа), категории и города доставки.

## Продакшен

`user-secrets` работают только в окружении `Development`. В других окружениях секреты задаются переменными окружения:

- `ConnectionStrings__DefaultConnection`
- `JWT__Key`
- `EmailSettings__Password`

Если `JWT:Key` не задан, приложение не запустится.
