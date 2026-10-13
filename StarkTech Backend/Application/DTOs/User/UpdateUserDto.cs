using Application.Validation;

namespace Application.DTOs.User;

public class UpdateUserDto
{
    public string Id { get; set; } = string.Empty;
    [PersonName]
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    [PhoneNumberFormat]
    public string PhoneNumber { get; set; } = string.Empty;
    public string PhotoPath { get; set; } = string.Empty;
}
