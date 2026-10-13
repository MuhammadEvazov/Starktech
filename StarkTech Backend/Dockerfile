# API StarkTech (ASP.NET Core 9) — образ для Render и любого Docker-хостинга.
# Сборка из папки «StarkTech Backend»:  docker build -t starktech-api .

# ── Сборка ──
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

# Сначала только проекты — restore кэшируется, пока не поменялись зависимости
COPY StarkTech.sln ./
COPY Domain/Domain.csproj Domain/
COPY Application/Application.csproj Application/
COPY Infrastructure/Infrastructure.csproj Infrastructure/
COPY WebApi/WebApi.csproj WebApi/
RUN dotnet restore WebApi/WebApi.csproj

COPY . .
RUN dotnet publish WebApi/WebApi.csproj -c Release -o /app/publish /p:UseAppHost=false

# ── Запуск ──
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS final
WORKDIR /app

# Render по умолчанию ждёт приложение на порту 10000 (переменная PORT).
ENV ASPNETCORE_ENVIRONMENT=Production \
    ASPNETCORE_HTTP_PORTS=10000 \
    DOTNET_RUNNING_IN_CONTAINER=true

COPY --from=build /app/publish .

# wwwroot должен существовать, иначе WebRootPath = null и загрузка файлов падает.
# На Render сюда монтируется постоянный диск: /app/wwwroot/uploads (см. render.yaml).
RUN mkdir -p /app/wwwroot/uploads /app/Logs

EXPOSE 10000
ENTRYPOINT ["dotnet", "WebApi.dll"]
