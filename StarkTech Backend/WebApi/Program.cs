using Microsoft.AspNetCore.HttpOverrides;
using Infrastructure.Data;
using Infrastructure.Seed;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Infrastructure.Identity;
using Serilog;
using Microsoft.IdentityModel.Tokens;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using System.Text;
using Microsoft.OpenApi.Models;
using WebApi.MiddleWares;
using WebApi.Authorization;
using WebApi.DevTools;
using Microsoft.AspNetCore.Authorization;
using Application.Interfaces.Services;
using Application.Interfaces.Repositories;
using Infrastructure.Services;
using Infrastructure.Repositories;
using Application.Services;
using Application.DTOs.Email;
using WebApi.Hubs;

var builder = WebApplication.CreateBuilder(args);

// ─── Dev: Docker (postgres, redis) поднимается сам, без окна Docker Desktop ──
await DockerBootstrapper.EnsureRunningAsync(builder.Environment, builder.Configuration);

// ─── Logging ────────────────────────────────────────────────────────────────
Log.Logger = new LoggerConfiguration()
    .MinimumLevel.Information()
    // Консоль — для хостинга (Render собирает stdout в раздел Logs); файл — для локальной разработки.
    .WriteTo.Console()
    .WriteTo.File(
        path: "Logs/log-.json",
        rollingInterval: RollingInterval.Day,
        retainedFileCountLimit: 7,
        rollOnFileSizeLimit: true,
        fileSizeLimitBytes: 10 * 1024 * 1024,
        outputTemplate: "{Timestamp:yyyy-MM-dd HH:mm:ss} [{Level}] {Message}{NewLine}{Exception}")
    .CreateLogger();

// Route every ILogger<T> in the app through the Serilog file sink configured above.
builder.Services.AddSerilog();


// ─── Controllers ────────────────────────────────────────────────────────────
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.Converters.Add(
            new System.Text.Json.Serialization.JsonStringEnumConverter());
    });

// Docker Desktop на Windows иногда «вешает» IPv6-проброс портов (::1): соединение открывается,
// но ответа нет, и запуск падает по таймауту. localhost сначала резолвится в ::1 — поэтому
// к локальным контейнерам подключаемся явно по IPv4 (меняется только хост, остальное как в секретах).
// Хостинги (Render, Neon) отдают строку подключения в виде URL postgres://user:pass@host:port/db —
// Npgsql такой формат не понимает, поэтому переводим его в «ключ=значение».
static string? PostgresPreferIPv4(string? connectionString)
{
    if (string.IsNullOrWhiteSpace(connectionString)) return connectionString;
    Npgsql.NpgsqlConnectionStringBuilder csb;
    if (connectionString.StartsWith("postgres://", StringComparison.OrdinalIgnoreCase) ||
        connectionString.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase))
    {
        var uri = new Uri(connectionString);
        var userInfo = uri.UserInfo.Split(':', 2);
        csb = new Npgsql.NpgsqlConnectionStringBuilder
        {
            Host = uri.Host,
            Port = uri.Port > 0 ? uri.Port : 5432,
            Database = Uri.UnescapeDataString(uri.AbsolutePath.TrimStart('/')),
            Username = Uri.UnescapeDataString(userInfo[0]),
            Password = userInfo.Length > 1 ? Uri.UnescapeDataString(userInfo[1]) : null,
            // Внутренняя сеть Render — без TLS, внешний адрес — с TLS: Prefer подходит обоим.
            SslMode = Npgsql.SslMode.Prefer
        };
        if (uri.Query.Contains("sslmode=require", StringComparison.OrdinalIgnoreCase))
            csb.SslMode = Npgsql.SslMode.Require;
    }
    else
    {
        csb = new Npgsql.NpgsqlConnectionStringBuilder(connectionString);
    }
    if (string.Equals(csb.Host, "localhost", StringComparison.OrdinalIgnoreCase))
        csb.Host = "127.0.0.1";
    return csb.ConnectionString;
}

// Redis/Key Value хостингов задаётся URL redis://[user:pass@]host:port (rediss:// — с TLS);
// StackExchange.Redis ждёт «host:port,password=…,ssl=true».
static string? RedisPreferIPv4(string? configuration)
{
    if (string.IsNullOrWhiteSpace(configuration)) return configuration;
    if (configuration.StartsWith("redis://", StringComparison.OrdinalIgnoreCase) ||
        configuration.StartsWith("rediss://", StringComparison.OrdinalIgnoreCase))
    {
        var uri = new Uri(configuration);
        var parts = new List<string> { $"{uri.Host}:{(uri.Port > 0 ? uri.Port : 6379)}", "abortConnect=false" };
        var userInfo = uri.UserInfo.Split(':', 2);
        if (userInfo.Length == 2)
        {
            if (!string.IsNullOrEmpty(userInfo[0]) && userInfo[0] != "default")
                parts.Add($"user={Uri.UnescapeDataString(userInfo[0])}");
            parts.Add($"password={Uri.UnescapeDataString(userInfo[1])}");
        }
        if (uri.Scheme.Equals("rediss", StringComparison.OrdinalIgnoreCase)) parts.Add("ssl=true");
        configuration = string.Join(',', parts);
    }
    return configuration.Replace("localhost:", "127.0.0.1:", StringComparison.OrdinalIgnoreCase);
}

// DbContext
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(PostgresPreferIPv4(builder.Configuration.GetConnectionString("DefaultConnection"))));

// Redis distributed cache
builder.Services.AddStackExchangeRedisCache(options =>
{
    options.Configuration = RedisPreferIPv4(builder.Configuration.GetConnectionString("Redis"));
    options.InstanceName = "starktech:";
});

// ─── Infrastructure Services ────────────────────────────────────────────────
// DIP: регистрируем интерфейс → реализацию
builder.Services.AddScoped<IIdentityService, IdentityService>();
builder.Services.AddScoped<IJwtService, JwtService>();
builder.Services.AddScoped<IEmailService, EmailService>();
builder.Services.AddScoped<IFileService, FileService>();
builder.Services.AddScoped<IUserService, UserService>();
builder.Services.AddScoped<IDashboardService, DashboardService>();
builder.Services.AddScoped<IProductMediaService, ProductMediaService>();
builder.Services.AddScoped<IOrderActivityService, OrderActivityService>();
builder.Services.AddScoped<IProductService, ProductService>();
builder.Services.AddScoped<ICategoryService, CategoryService>();
builder.Services.AddScoped<IProductVariantService, ProductVariantService>();
builder.Services.AddScoped<IDeliveryCityService, DeliveryCityService>();
builder.Services.AddScoped<IPromoCodeService, PromoCodeService>();
builder.Services.AddScoped<IComboOfferService, ComboOfferService>();
builder.Services.AddScoped<IOrderService, OrderService>();
builder.Services.AddScoped<IReviewService, ReviewService>();
builder.Services.AddScoped<ICoinsTransactionService, CoinsTransactionService>();
builder.Services.AddScoped<INotificationService, NotificationService>();
builder.Services.AddScoped<IAdminTelegramBindingService, AdminTelegramBindingService>();
builder.Services.AddScoped<IPortfolioItemService, PortfolioItemService>();
builder.Services.AddScoped<IOrderItemPhotoService, OrderItemPhotoService>();
builder.Services.AddScoped<IVariantAttributeOptionService, VariantAttributeOptionService>();
builder.Services.AddScoped<IRolePermissionService, RolePermissionService>();
builder.Services.AddScoped<IChatService, ChatService>();
builder.Services.AddScoped<ILayoutService, LayoutService>();
builder.Services.AddScoped<IPaymentService, PaymentService>();
builder.Services.AddScoped<ChatNotifier>();
builder.Services.Configure<EmailSettings>(builder.Configuration.GetSection("EmailSettings"));

// ─── Repositories ────────────────────────────────────────────────────────────
builder.Services.AddScoped<IUserRepository, UserRepository>();
builder.Services.AddScoped<IProductRepository, ProductRepository>();
builder.Services.AddScoped<ICategoryRepository, CategoryRepository>();
builder.Services.AddScoped<IProductVariantRepository, ProductVariantRepository>();
builder.Services.AddScoped<IOrderRepository, OrderRepository>();
builder.Services.AddScoped<IOrderItemRepository, OrderItemRepository>();
builder.Services.AddScoped<IReviewRepository, ReviewRepository>();
builder.Services.AddScoped<ICoinsTransactionRepository, CoinsTransactionRepository>();
builder.Services.AddScoped<INotificationRepository, NotificationRepository>();
builder.Services.AddScoped<IAdminTelegramBindingRepository, AdminTelegramBindingRepository>();
builder.Services.AddScoped<IPortfolioItemRepository, PortfolioItemRepository>();
builder.Services.AddScoped<IOrderItemPhotoRepository, OrderItemPhotoRepository>();
builder.Services.AddScoped<IVariantAttributeOptionRepository, VariantAttributeOptionRepository>();
builder.Services.AddScoped<IRolePermissionRepository, RolePermissionRepository>();
builder.Services.AddScoped<IDeliveryCityRepository, DeliveryCityRepository>();
builder.Services.AddScoped<IPromoCodeRepository, PromoCodeRepository>();
builder.Services.AddScoped<IComboOfferRepository, ComboOfferRepository>();
builder.Services.AddScoped<IUnitOfWork, UnitOfWork>();

// ─── Application Services ────────────────────────────────────────────────────
// DIP + OCP: зависимость через интерфейс, реализации взаимозаменяемы
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IProfileService, ProfileService>();

// Identity
builder.Services.AddIdentity<AppUser, IdentityRole>(options =>
    {
        options.Password.RequireDigit = true;
        options.Password.RequireLowercase = true;
        options.Password.RequireUppercase = true;
        options.Password.RequireNonAlphanumeric = true;
        options.Password.RequiredLength = 8;

        // Блокировка входа: 5 неверных паролей подряд → 15 минут (считается в IdentityService.LoginAsync).
        options.Lockout.AllowedForNewUsers = true;
        options.Lockout.MaxFailedAccessAttempts = 5;
        options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
    })
    .AddEntityFrameworkStores<AppDbContext>()
    .AddDefaultTokenProviders();


// ─── JWT Authentication ──────────────────────────────────────────────────────
var jwtKey = builder.Configuration["JWT:Key"];
if (string.IsNullOrWhiteSpace(jwtKey))
    throw new InvalidOperationException(
        "JWT:Key is not configured. Set it with 'dotnet user-secrets set \"JWT:Key\" <value>' or the JWT__Key environment variable.");

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = builder.Configuration["JWT:Issuer"],
        ValidAudience = builder.Configuration["JWT:Audience"],
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey))
    };

    // SignalR (WebSocket) не умеет слать заголовок Authorization — токен приходит в ?access_token=.
    options.Events = new JwtBearerEvents
    {
        OnMessageReceived = context =>
        {
            var token = context.Request.Query["access_token"];
            if (!string.IsNullOrEmpty(token) && context.HttpContext.Request.Path.StartsWithSegments("/hubs"))
                context.Token = token;
            return Task.CompletedTask;
        },

        // Токен действует, только пока аккаунт существует и его штамп безопасности не менялся:
        // удаление пользователя, смена пароля или роли сразу отзывают все выданные токены.
        OnTokenValidated = async context =>
        {
            var userId = context.Principal?.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            var tokenStamp = context.Principal?.FindFirst(IJwtService.SecurityStampClaim)?.Value;

            if (string.IsNullOrEmpty(userId) || string.IsNullOrEmpty(tokenStamp))
            {
                context.Fail("Token has no user or security stamp.");
                return;
            }

            var userManager = context.HttpContext.RequestServices.GetRequiredService<UserManager<AppUser>>();
            var user = await userManager.FindByIdAsync(userId);

            if (user == null || !string.Equals(user.SecurityStamp, tokenStamp, StringComparison.Ordinal))
                context.Fail("Token has been revoked.");
        }
    };
});

// ─── SignalR: чат «Написать нам» в реальном времени ─────────────────────────
builder.Services.AddSignalR()
    .AddJsonProtocol(options =>
        options.PayloadSerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter()));

// ─── Permission-based Authorization ─────────────────────────────────────────
builder.Services.AddSingleton<IAuthorizationPolicyProvider, PermissionPolicyProvider>();
builder.Services.AddScoped<IAuthorizationHandler, PermissionAuthorizationHandler>();


// ─── Swagger ─────────────────────────────────────────────────────────────────
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo { Title = "DomX CRM API", Version = "v1" });

    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header
    });

    options.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" }
            },
            Array.Empty<string>()
        }
    });
});

// OpenAPI
builder.Services.AddOpenApi();

// ─── CORS для фронтенда (папка frontend) ───────────────────────────────────
// В dev Vite проксирует /api, CORS нужен при запуске фронтенда на другом домене.
// Адреса переопределяются в appsettings: "Cors": { "Origins": [ "https://..." ] }
var corsOrigins = builder.Configuration.GetSection("Cors:Origins").Get<string[]>()
    ?? new[] { "http://localhost:5173", "http://127.0.0.1:5173" };
// Превью-деплои Vercel получают новый адрес на каждый коммит (starktech-git-…-team.vercel.app) —
// их разрешаем по окончанию домена: Cors:OriginSuffixes = ["-team.vercel.app"]. Только https.
var corsSuffixes = builder.Configuration.GetSection("Cors:OriginSuffixes").Get<string[]>() ?? Array.Empty<string>();
bool IsAllowedOrigin(string origin) =>
    corsOrigins.Contains(origin, StringComparer.OrdinalIgnoreCase) ||
    (origin.StartsWith("https://", StringComparison.OrdinalIgnoreCase) &&
     corsSuffixes.Any(s => !string.IsNullOrWhiteSpace(s) && origin.EndsWith(s.Trim(), StringComparison.OrdinalIgnoreCase)));
builder.Services.AddCors(options =>
    options.AddPolicy("Frontend", policy => policy
        .SetIsOriginAllowed(IsAllowedOrigin)
        .AllowAnyHeader()
        .AllowAnyMethod()
        .AllowCredentials())); // SignalR negotiate с другого домена

// ─── За прокси хостинга (Render) ─────────────────────────────────────────────
// TLS завершает прокси: без X-Forwarded-* приложение видит http и IP прокси —
// лимит запросов считался бы одним на всех, а редирект на https зацикливался бы.
var behindProxy = builder.Configuration.GetValue<bool>("Proxy:TrustForwardedHeaders");
if (behindProxy)
{
    builder.Services.Configure<ForwardedHeadersOptions>(options =>
    {
        options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
        // Адреса прокси Render заранее неизвестны — доверяем заголовкам (снаружи API доступен только через прокси).
        options.KnownNetworks.Clear();
        options.KnownProxies.Clear();
    });
}

// Проверка живости для хостинга (healthCheckPath: /health)
builder.Services.AddHealthChecks();

// ─── Ограничение частоты запросов (перебор паролей/кодов, флуд) ─────────────
builder.Services.AddStarkTechRateLimiting();

// HSTS (только вне Development): браузер год ходит к API только по HTTPS.
builder.Services.AddHsts(options =>
{
    options.MaxAge = TimeSpan.FromDays(365);
    options.IncludeSubDomains = true;
});

var app = builder.Build();

// На хостинге (Database:MigrateOnStartup=true) применяем миграции при старте — до сида, иначе сид упадёт.
// Локально миграции по-прежнему применяются вручную: dotnet ef database update.
if (app.Configuration.GetValue<bool>("Database:MigrateOnStartup"))
{
    using var scope = app.Services.CreateScope();
    await scope.ServiceProvider.GetRequiredService<AppDbContext>().Database.MigrateAsync();
}

// Seed (roles, permissions, super admin, categories, cities)
await DataSeed.SeedAsync(app.Services);

// Первым в конвейере: дальше все видят настоящий IP клиента и схему https.
if (behindProxy)
    app.UseForwardedHeaders();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c =>
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "Stark Tech API V1"));
}

if (!app.Environment.IsDevelopment())
    app.UseHsts();

// За прокси хостинга https уже принудительный (и проверка /health идёт изнутри по http) — свой редирект не нужен.
if (!behindProxy)
    app.UseHttpsRedirection();
app.UseMiddleware<SecurityHeadersMiddleware>();
// CORS до статики: фото из /uploads рисуются на canvas в редакторе макета на сайте.
app.UseCors("Frontend");
app.UseStaticFiles();
app.UseSerilogRequestLogging();
app.UseMiddleware<ExceptionMiddleWare>();
// После статики: лимит считает только запросы к API (429 с русским текстом — RateLimiting.cs).
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapHub<ChatHub>("/hubs/chat");
app.MapHealthChecks("/health").DisableRateLimiting();

app.Run();