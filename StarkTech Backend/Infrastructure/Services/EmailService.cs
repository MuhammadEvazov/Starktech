using System.Net;
using System.Net.Http.Json;
using System.Net.Mail;
using Application.DTOs.Email;
using Application.Interfaces.Services;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Infrastructure.Services;

/// <summary>
/// Отправка писем. EmailSettings:Provider = "smtp" (локально, Gmail) или "brevo" (HTTPS API —
/// на бесплатном Render исходящие SMTP-порты закрыты, поэтому там письма идут через Brevo).
/// </summary>
public class EmailService : IEmailService
{
    private const string BrevoEndpoint = "https://api.brevo.com/v3/smtp/email";

    private readonly IOptions<EmailSettings> _options;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<EmailService> _logger;

    public EmailService(IOptions<EmailSettings> options, IHttpClientFactory httpClientFactory, ILogger<EmailService> logger)
    {
        _options = options;
        _httpClientFactory = httpClientFactory;
        _logger = logger;
    }

    public async Task<bool> SendEmailAsync(string to, string subject, string body)
    {
        try
        {
            if (string.Equals(_options.Value.Provider, "brevo", StringComparison.OrdinalIgnoreCase))
                await SendViaBrevoAsync(to, subject, body);
            else
                await SendViaSmtpAsync(to, subject, body);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error sending email to {Recipient}. Exception: {Message}", to, ex.Message);
            throw;
        }
    }

    private async Task SendViaSmtpAsync(string to, string subject, string body)
    {
        var s = _options.Value;
        using var smtpClient = new SmtpClient(s.SmtpServer, s.Port);
        smtpClient.Credentials = new NetworkCredential(s.Email, s.Password);
        smtpClient.EnableSsl = true;

        using var mail = new MailMessage(new MailAddress(s.Email, s.SenderName), new MailAddress(to))
        {
            Subject = subject,
            Body = body,
            IsBodyHtml = true
        };

        await smtpClient.SendMailAsync(mail);
    }

    private async Task SendViaBrevoAsync(string to, string subject, string body)
    {
        var s = _options.Value;
        if (string.IsNullOrWhiteSpace(s.ApiKey))
            throw new InvalidOperationException("EmailSettings:ApiKey is not configured (environment variable EmailSettings__ApiKey).");

        var client = _httpClientFactory.CreateClient(nameof(EmailService));
        using var request = new HttpRequestMessage(HttpMethod.Post, BrevoEndpoint)
        {
            Content = JsonContent.Create(new
            {
                sender = new { name = s.SenderName, email = s.Email },
                to = new[] { new { email = to } },
                subject,
                htmlContent = body
            })
        };
        request.Headers.Add("api-key", s.ApiKey);
        request.Headers.Accept.ParseAdd("application/json");

        using var response = await client.SendAsync(request);
        if (!response.IsSuccessStatusCode)
        {
            // Текст ошибки Brevo (без ключа), обрезанный, чтобы не раздувать лог
            var details = await response.Content.ReadAsStringAsync();
            throw new HttpRequestException(
                $"Brevo responded {(int)response.StatusCode}: {details[..Math.Min(details.Length, 300)]}");
        }
    }
}
