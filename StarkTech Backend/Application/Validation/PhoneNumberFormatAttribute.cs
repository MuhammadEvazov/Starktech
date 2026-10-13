using System.ComponentModel.DataAnnotations;
using System.Text.RegularExpressions;

namespace Application.Validation;

/// <summary>
/// Номер телефона: 9–15 цифр, «+» только в начале; пробелы, дефисы и скобки допускаются
/// (например +992 111 22 32 67, 900-12-34-56). Пустое значение пропускается (обязательность задаёт [Required]).
/// </summary>
[AttributeUsage(AttributeTargets.Property | AttributeTargets.Parameter)]
public sealed partial class PhoneNumberFormatAttribute : ValidationAttribute
{
    [GeneratedRegex(@"^\+?[0-9 ()\-]+$")]
    private static partial Regex Allowed();

    public PhoneNumberFormatAttribute()
        : base("Укажите номер телефона цифрами, например +992 900 12 34 56") { }

    public override bool IsValid(object? value)
    {
        if (value is not string s || string.IsNullOrWhiteSpace(s))
            return true;

        var phone = s.Trim();
        if (phone.Length > 30 || !Allowed().IsMatch(phone))
            return false;

        var digits = phone.Count(char.IsAsciiDigit);
        return digits is >= 9 and <= 15;
    }
}
