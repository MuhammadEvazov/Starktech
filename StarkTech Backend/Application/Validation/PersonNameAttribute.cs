using System.ComponentModel.DataAnnotations;
using System.Text.RegularExpressions;

namespace Application.Validation;

/// <summary>
/// Имя человека: 2–100 символов — буквы любого алфавита, пробелы, дефис, апостроф и точка.
/// Пустое значение пропускается (обязательность задаёт [Required]).
/// </summary>
[AttributeUsage(AttributeTargets.Property | AttributeTargets.Parameter)]
public sealed partial class PersonNameAttribute : ValidationAttribute
{
    public const int MinLength = 2;
    public const int MaxLength = 100;

    [GeneratedRegex(@"^[\p{L}\p{M}]+(?:[ .'’\-]+[\p{L}\p{M}]+)*\.?$")]
    private static partial Regex Pattern();

    public PersonNameAttribute()
        : base("Имя может содержать только буквы, пробелы, дефис и апостроф (от 2 до 100 символов)") { }

    public override bool IsValid(object? value)
    {
        if (value is not string s || string.IsNullOrWhiteSpace(s))
            return true;

        var name = s.Trim();
        return name.Length is >= MinLength and <= MaxLength && Pattern().IsMatch(name);
    }
}
