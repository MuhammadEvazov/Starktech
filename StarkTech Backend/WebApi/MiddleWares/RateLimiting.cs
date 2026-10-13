using System.Globalization;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;

namespace WebApi.MiddleWares;

/// <summary>Имена политик ограничения частоты запросов (атрибут [EnableRateLimiting]).</summary>
public static class RateLimitPolicies
{
    /// <summary>Вход, регистрация, сброс пароля: строгий лимит с одного IP против перебора паролей и кодов.</summary>
    public const string Auth = "auth";
}

public static class RateLimitingSetup
{
    private const string TooManyRequestsMessage = "Слишком много запросов. Подождите немного и попробуйте снова.";

    // Ключ — IP клиента. За обратным прокси нужно настроить ForwardedHeaders, иначе все клиенты получат один ключ.
    private static string ClientKey(HttpContext context)
        => context.Connection.RemoteIpAddress?.ToString() ?? "unknown";

    public static IServiceCollection AddStarkTechRateLimiting(this IServiceCollection services)
    {
        services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

            // Скользящее окно: 10 запросов в минуту с одного IP на каждый эндпоинт /api/auth/*.
            options.AddPolicy(RateLimitPolicies.Auth, context =>
                RateLimitPartition.GetSlidingWindowLimiter(
                    $"{ClientKey(context)}:{context.Request.Path.Value?.ToLowerInvariant()}",
                    _ => new SlidingWindowRateLimiterOptions
                    {
                        PermitLimit = 10,
                        Window = TimeSpan.FromMinutes(1),
                        SegmentsPerWindow = 6,
                        QueueLimit = 0
                    }));

            // Общий мягкий лимит на все запросы с одного IP (статика и SignalR-соединения сюда не входят).
            options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
                RateLimitPartition.GetFixedWindowLimiter(
                    ClientKey(context),
                    _ => new FixedWindowRateLimiterOptions
                    {
                        PermitLimit = 300,
                        Window = TimeSpan.FromMinutes(1),
                        QueueLimit = 0
                    }));

            options.OnRejected = async (context, cancellationToken) =>
            {
                if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
                {
                    context.HttpContext.Response.Headers.RetryAfter =
                        ((int)Math.Ceiling(retryAfter.TotalSeconds)).ToString(CultureInfo.InvariantCulture);
                }

                context.HttpContext.Response.ContentType = "application/json";
                // Формат как у HandleResult (массив ошибок) — фронтенд покажет текст как есть.
                await context.HttpContext.Response.WriteAsJsonAsync(
                    new { errors = new[] { TooManyRequestsMessage }, message = TooManyRequestsMessage },
                    cancellationToken);
            };
        });

        return services;
    }
}
