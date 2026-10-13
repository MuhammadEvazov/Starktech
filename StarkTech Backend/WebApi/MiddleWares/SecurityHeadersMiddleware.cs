namespace WebApi.MiddleWares;

/// <summary>
/// Базовые заголовки безопасности для всех ответов API.
/// Фронтенд живёт на отдельном origin, поэтому API никогда не нужно встраивать во фрейм.
/// </summary>
public class SecurityHeadersMiddleware
{
    private readonly RequestDelegate _next;

    public SecurityHeadersMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public Task InvokeAsync(HttpContext context)
    {
        context.Response.OnStarting(() =>
        {
            var headers = context.Response.Headers;
            headers["X-Content-Type-Options"] = "nosniff";
            headers["X-Frame-Options"] = "DENY";
            headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
            return Task.CompletedTask;
        });

        return _next(context);
    }
}
