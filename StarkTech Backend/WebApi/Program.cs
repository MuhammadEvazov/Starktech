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

// DbContext
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

// Redis distributed cache
builder.Services.AddStackExchangeRedisCache(options =>
{
    options.Configuration = builder.Configuration.GetConnectionString("Redis");
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
        options.Password.RequiredLength = 6;
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
builder.Services.AddCors(options =>
    options.AddPolicy("Frontend", policy => policy
        .WithOrigins(corsOrigins)
        .AllowAnyHeader()
        .AllowAnyMethod()
        .AllowCredentials())); // SignalR negotiate с другого домена

var app = builder.Build();

// Seed (roles, permissions, super admin, categories, cities)
await DataSeed.SeedAsync(app.Services);

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c =>
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "Stark Tech API V1"));
}

app.UseHttpsRedirection();
// CORS до статики: фото из /uploads рисуются на canvas в редакторе макета на сайте.
app.UseCors("Frontend");
app.UseStaticFiles();
app.UseSerilogRequestLogging();
app.UseMiddleware<ExceptionMiddleWare>();
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapHub<ChatHub>("/hubs/chat");

app.Run();