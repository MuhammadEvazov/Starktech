namespace Application.DTOs.Email;

public class EmailSettings
{
    /// <summary>
    /// "smtp" (по умолчанию, локально — Gmail) или "brevo" — отправка через HTTPS API Brevo.
    /// Бесплатный Render блокирует SMTP-порты 25/465/587, поэтому на хостинге нужен "brevo".
    /// </summary>
    public string Provider { get; set; } = "smtp";

    public string SmtpServer { get; set; } = null!;
    public int Port { get; set; }

    /// <summary>Адрес отправителя (для Brevo — подтверждённый в Brevo sender).</summary>
    public string Email { get; set; } = null!;
    public string Password { get; set; } = null!;

    /// <summary>API-ключ Brevo (EmailSettings__ApiKey) — только для Provider = "brevo".</summary>
    public string? ApiKey { get; set; }

    /// <summary>Имя отправителя в письме.</summary>
    public string SenderName { get; set; } = "Stark Tech";
}
