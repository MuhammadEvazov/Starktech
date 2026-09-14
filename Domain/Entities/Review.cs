namespace Domain.Entities;

public class Review : BaseEntity
{
    public Guid? UserId { get; set; }
    public User? User { get; set; }

    public Guid? ProductId { get; set; }
    public Product? Product { get; set; }

    public Guid? OrderId { get; set; }
    public Order? Order { get; set; }

    public int Rating { get; set; } // 1-5
    public string? Comment { get; set; }
    public bool IsApproved { get; set; } = false;
}
