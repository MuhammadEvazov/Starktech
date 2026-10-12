namespace Domain.Entities;

public class OrderItem : BaseEntity
{
    public Guid OrderId { get; set; }
    public Order Order { get; set; } = default!;

    public Guid ProductVariantId { get; set; }
    public ProductVariant ProductVariant { get; set; } = default!;

    public int Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal SubTotal { get; set; }

    // Navigation
    public ICollection<OrderItemPhoto> Photos { get; set; } = new List<OrderItemPhoto>();
}
