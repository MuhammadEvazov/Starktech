using System.Net;
using System.Net.Mail;
using Application.DTOs.Email;
using Application.Interfaces.Services;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Infrastructure.Services;

public class EmailService : IEmailService
{

    private readonly IOptions<EmailSettings> _options;
    private readonly ILogger<EmailService> _logger;

    public EmailService(IOptions<EmailSettings> options, ILogger<EmailService> logger)
    {
        _options = options;
        _logger = logger;
    }
    public async Task<bool> SendEmailAsync(string to, string subject, string body)
    {
        try
        {
            using var smtpClient = new SmtpClient(_options.Value.SmtpServer, _options.Value.Port);
            smtpClient.Credentials = new NetworkCredential(_options.Value.Email, _options.Value.Password);
            smtpClient.EnableSsl = true;

            var mail = new MailMessage(_options.Value.Email, to, subject, body);
            mail.IsBodyHtml = true;

            await smtpClient.SendMailAsync(mail);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error sending email to {Recipient}. Exception: {Message}", to, ex.Message);
            throw;
        }
    }

}
