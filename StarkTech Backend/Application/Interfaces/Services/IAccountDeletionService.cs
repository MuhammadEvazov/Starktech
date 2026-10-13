using Application.Results;

namespace Application.Interfaces.Services;

public interface IAccountDeletionService
{
    /// <summary>
    /// Удаляет аккаунт по запросу владельца: личные данные стираются, записи для учёта
    /// (заказы, оплаты, монеты) остаются обезличенными, вход и выданные токены отзываются.
    /// </summary>
    Task<Result<string>> DeleteOwnAccountAsync(string appUserId, string password);
}
