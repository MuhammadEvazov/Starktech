namespace Domain.Entities;

public class ProductVariant : BaseEntity
{
    public Guid ProductId { get; set; }
    public Product Product { get; set; } = default!;

    public string AttributesJson { get; set; } = "{}"; // напр. {"size":"5x5","shape":"heart"}
    public decimal Price { get; set; }
    public bool StockUnlimited { get; set; } = true;
    public string? SKU { get; set; }
    public bool IsActive { get; set; } = true;

    // Navigation
    public ICollection<OrderItem> OrderItems { get; set; } = new List<OrderItem>();
}
