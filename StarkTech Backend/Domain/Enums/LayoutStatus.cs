namespace Domain.Enums;

/// <summary>Макет заказа: ждёт ответа клиента, одобрен или клиент просит правки.</summary>
public enum LayoutStatus
{
    Pending = 0,
    Approved = 1,
    ChangesRequested = 2
}
