namespace Domain.Entities;

/// <summary>
/// Запись журнала заказа: что и кто изменил. Изменения клиента (ByClient) админ отмечает просмотренными.
/// </summary>
public class OrderActivity : BaseEntity
{
    public Guid OrderId { get; set; }
    public Order Order { get; set; } = default!;

    public string Message { get; set; } = default!;
    public bool ByClient { get; set; }
    public bool IsSeen { get; set; }
}
