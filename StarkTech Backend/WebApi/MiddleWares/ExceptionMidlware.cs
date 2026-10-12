using System.Diagnostics;

namespace WebApi.MiddleWares;

/// <summary>
/// SRP: ExceptionMiddleWare отвечает только за перехват и логирование исключений.
/// OCP: Новые типы ошибок обрабатываются через расширение, не изменение.
/// </summary>
public class ExceptionMiddleWare
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionMiddleWare> _logger;

    public ExceptionMiddleWare(RequestDelegate next, ILogger<ExceptionMiddleWare> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var stopwatch = Stopwatch.StartNew();

        try
        {
            await _next(context);
        }
        catch (Exception ex)
        {
            stopwatch.Stop();
            await HandleExceptionAsync(context, ex, stopwatch.ElapsedMilliseconds);
        }
    }

    private async Task HandleExceptionAsync(HttpContext context, Exception ex, long elapsedMs)
    {
        _logger.LogError(ex, "Unhandled exception after {ElapsedMs}ms at {Path}", elapsedMs, context.Request.Path);

        context.Response.StatusCode = ex switch
        {
            ArgumentException      => StatusCodes.Status400BadRequest,
            InvalidOperationException => StatusCodes.Status422UnprocessableEntity,
            UnauthorizedAccessException => StatusCodes.Status401Unauthorized,
            _                      => StatusCodes.Status500InternalServerError
        };

        context.Response.ContentType = "application/json";

        await context.Response.WriteAsJsonAsync(new
        {
            Message    = "An error occurred while processing your request.",
            Error      = ex.Message,
            DurationMs = elapsedMs
        });
    }
}
