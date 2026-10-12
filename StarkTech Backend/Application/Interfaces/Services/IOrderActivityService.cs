using Application.DTOs.Order;
using Application.Results;

namespace Application.Interfaces.Services;

public interface IOrderActivityService
{
    /// <summary>Записать изменение. Изменение клиента включает у заказа пометку «Изменён клиентом».</summary>
    Task LogAsync(Guid orderId, string message, bool byClient);
    Task<Result<List<OrderActivityDto>>> GetByOrderAsync(Guid orderId);
    /// <summary>Сотрудник просмотрел изменения клиента — снимаем пометку.</summary>
    Task<Result<bool>> MarkSeenAsync(Guid orderId);
}
