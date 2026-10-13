using Domain.Enums;

namespace Application.DTOs.Order;

public class GetOrderDto
{
    public Guid Id { get; set; }
    public string OrderNumber { get; set; } = default!;
    public Guid? UserId { get; set; }
    public OrderStatus Status { get; set; }

    public decimal TotalAmount { get; set; }
    public decimal DiscountAmount { get; set; }
    public decimal DeliveryCost { get; set; }
    public decimal PayableAmount { get; set; }

    public Guid? PromoCodeId { get; set; }
    public Guid? ComboOfferId { get; set; }

    public Guid? DeliveryCityId { get; set; }
    public string? DeliveryAddress { get; set; }

    public string ContactName { get; set; } = default!;
    public string ContactPhone { get; set; } = default!;
    public string? ContactEmail { get; set; }

    public PaymentMethod PaymentMethod { get; set; }
    public PaymentStatus PaymentStatus { get; set; }
    public OrderSource Source { get; set; }

    public int CoinsEarned { get; set; }
    public int CoinsUsed { get; set; }

    /// <summary>Клиент изменил заказ, а сотрудник ещё не отметил это просмотренным.</summary>
    public bool HasClientChanges { get; set; }

    // Оплата переводом
    /// <summary>Процент предоплаты, запомненный при оформлении (0 — без предоплаты).</summary>
    public int PrepaymentPercent { get; set; }
    /// <summary>Сумма предоплаты (округлена вверх до сомони).</summary>
    public decimal PrepaymentAmount { get; set; }
    /// <summary>Принято по чекам.</summary>
    public decimal PaidAmount { get; set; }
    /// <summary>Осталось оплатить всего.</summary>
    public decimal RemainingAmount { get; set; }
    /// <summary>Нужно оплатить сейчас (недостающая часть предоплаты).</summary>
    public decimal DueNowAmount { get; set; }
    /// <summary>Есть чек, который ждёт проверки сотрудником.</summary>
    public bool HasPendingPaymentProof { get; set; }
    /// <summary>Клиент может сам менять состав: статус «Новый»/«Подтверждён», ничего не оплачено и нет чека на проверке.</summary>
    public bool CanCustomerEdit { get; set; }
    /// <summary>Переплата: принято больше, чем к оплате (например, после правки состава сотрудником).</summary>
    public decimal OverpaidAmount { get; set; }
    /// <summary>Заказ отменён, деньги приняты и ещё не возвращены.</summary>
    public decimal RefundDueAmount { get; set; }

    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }

    public List<OrderItemDto> Items { get; set; } = new();
}
