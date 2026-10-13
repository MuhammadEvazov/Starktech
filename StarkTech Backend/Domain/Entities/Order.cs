using Domain.Enums;

namespace Domain.Entities;

public class Order : BaseEntity
{
     public string OrderNumber { get; set; } = default!; // напр. ST-2026-00123

    public Guid? UserId { get; set; }
    public User? User { get; set; }

    public OrderStatus Status { get; set; } = OrderStatus.New;

    public decimal TotalAmount { get; set; }
    public decimal DiscountAmount { get; set; }

    public Guid? PromoCodeId { get; set; }
    public PromoCode? PromoCode { get; set; }

    public Guid? ComboOfferId { get; set; }
    public ComboOffer? ComboOffer { get; set; }

    public Guid? DeliveryCityId { get; set; }
    public DeliveryCity? DeliveryCity { get; set; }
    public string? DeliveryAddress { get; set; }
    public decimal DeliveryCost { get; set; }

    public string ContactName { get; set; } = default!;
    public string ContactPhone { get; set; } = default!;
    public string? ContactEmail { get; set; }

    public PaymentMethod PaymentMethod { get; set; }
    public PaymentStatus PaymentStatus { get; set; } = PaymentStatus.Pending;

    public OrderSource Source { get; set; } = OrderSource.Website;

    public DateTime? UpdatedAt { get; set; }

    public int CoinsEarned { get; set; } = 0;
    public int CoinsUsed { get; set; } = 0;

    // Клиент что-то изменил (фото, кадр), а сотрудник ещё не отметил это просмотренным.
    public bool HasClientChanges { get; set; } = false;

    // Оплата переводом: процент предоплаты (запоминается при оформлении), сколько уже принято
    // по чекам и есть ли чек, который ждёт проверки.
    public int PrepaymentPercent { get; set; }
    public decimal PaidAmount { get; set; }
    public bool HasPendingPaymentProof { get; set; }

    // Когда фото клиента удалены (при переходе в «Готов к отправке» — заказ уже изготовлен).
    public DateTime? PhotosDeletedAt { get; set; }

    // Navigation
    public ICollection<OrderItem> Items { get; set; } = new List<OrderItem>();
    public ICollection<Review> Reviews { get; set; } = new List<Review>();
    public ICollection<CoinsTransaction> CoinsTransactions { get; set; } = new List<CoinsTransaction>();
    public ICollection<Notification> Notifications { get; set; } = new List<Notification>();
    public ICollection<OrderActivity> Activities { get; set; } = new List<OrderActivity>();
    public ICollection<OrderPaymentProof> PaymentProofs { get; set; } = new List<OrderPaymentProof>();
}
