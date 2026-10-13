using System.Diagnostics;

namespace WebApi.MiddleWares;

/// <summary>
/// SRP: ExceptionMiddleWare отвечает только за перехват и логирование исключений.
/// OCP: Новые типы ошибок обрабатываются через расширение, не изменение.
/// Клиенту вне Development уходит только общий текст и traceId (по нему ищем запись в логах);
/// текст исключения и стек — только в лог и в Development.
/// </summary>
public class ExceptionMiddleWare
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionMiddleWare> _logger;
    private readonly IHostEnvironment _environment;

    public ExceptionMiddleWare(RequestDelegate next, ILogger<ExceptionMiddleWare> logger, IHostEnvironment environment)
    {
        _next = next;
        _logger = logger;
        _environment = environment;
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
        var traceId = Activity.Current?.Id ?? context.TraceIdentifier;

        _logger.LogError(ex, "Unhandled exception after {ElapsedMs}ms at {Method} {Path}, traceId {TraceId}",
            elapsedMs, context.Request.Method, context.Request.Path, traceId);

        // Ответ уже начал уходить — заголовки и статус не поменять, просто обрываем.
        if (context.Response.HasStarted)
            return;

        context.Response.Clear();
        context.Response.StatusCode = ex switch
        {
            ArgumentException      => StatusCodes.Status400BadRequest,
            InvalidOperationException => StatusCodes.Status422UnprocessableEntity,
            UnauthorizedAccessException => StatusCodes.Status401Unauthorized,
            OperationCanceledException when context.RequestAborted.IsCancellationRequested => 499,
            _                      => StatusCodes.Status500InternalServerError
        };

        context.Response.ContentType = "application/json";

        if (_environment.IsDevelopment())
        {
            await context.Response.WriteAsJsonAsync(new
            {
                Message    = "Ошибка при обработке запроса.",
                Error      = ex.Message,
                Details    = ex.ToString(),
                TraceId    = traceId,
                DurationMs = elapsedMs
            });
            return;
        }

        const string generic = "Что-то пошло не так. Попробуйте ещё раз; если ошибка повторится — напишите нам и укажите код ошибки.";

        await context.Response.WriteAsJsonAsync(new
        {
            Message = generic,
            Error   = $"{generic} Код ошибки: {traceId}",
            TraceId = traceId
        });
    }
}
