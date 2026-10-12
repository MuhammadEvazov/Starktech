using Application.Result;

namespace Application.DTOs.Product;

public class GetProductFilterDto : PageRequest
{
    public string? Name { get; set; }
    public Guid? CategoryId { get; set; }
    public bool? IsActive { get; set; }

    /// <summary>true — только удалённые (корзина), false — только живые товары.
    /// Выставляется контроллером, а не из строки запроса.</summary>
    public bool Deleted { get; set; }
}
