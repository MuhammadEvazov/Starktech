namespace Application.DTOs.Dashboard;

/// <summary>Сводка для главной страницы админки за период из N дней (включая сегодня).</summary>
public class DashboardDto
{
    public int Days { get; set; }
    public DateTime PeriodStart { get; set; }
    public DateTime GeneratedAt { get; set; }

    /// <summary>Заказы по статусам за всё время — очередь работы.</summary>
    public Dictionary<string, int> Pipeline { get; set; } = new();

    public DashboardAttentionDto Attention { get; set; } = new();
    public DashboardOrdersDto Orders { get; set; } = new();

    /// <summary>Деньги. null, если у пользователя нет права finance.view.</summary>
    public DashboardFinanceDto? Finance { get; set; }

    public List<DashboardDayDto> Daily { get; set; } = new();
    public List<DashboardTopProductDto> TopProducts { get; set; } = new();
    public List<DashboardCityDto> TopCities { get; set; } = new();
    public DashboardCustomersDto Customers { get; set; } = new();
    public DashboardReviewsDto Reviews { get; set; } = new();
    public DashboardCatalogDto Catalog { get; set; } = new();
}

public class DashboardAttentionDto
{
    /// <summary>Новые заказы, которым больше суток и по которым ещё не позвонили.</summary>
    public int StaleNewOrders { get; set; }
    /// <summary>Заказы New/Confirmed, где товару нужно фото, а его нет.</summary>
    public int OrdersAwaitingPhotos { get; set; }
    /// <summary>Готовы к доставке или доставлены, но не оплачены.</summary>
    public int UnpaidReadyOrders { get; set; }
    public int PendingReviews { get; set; }
}

public class DashboardOrdersDto
{
    public int Count { get; set; }
    public int PreviousCount { get; set; }
    public int Cancelled { get; set; }
    public int Today { get; set; }
    public Dictionary<string, int> BySource { get; set; } = new();
    public Dictionary<string, int> ByPaymentMethod { get; set; } = new();
    public int WithPromoCode { get; set; }
    public int WithComboOffer { get; set; }
}

public class DashboardFinanceDto
{
    /// <summary>Сумма к оплате по неотменённым заказам периода.</summary>
    public decimal Revenue { get; set; }
    public decimal PreviousRevenue { get; set; }
    public decimal Paid { get; set; }
    public decimal AwaitingPayment { get; set; }
    public decimal AverageCheck { get; set; }
    public decimal Discounts { get; set; }
    public decimal DeliveryIncome { get; set; }
    public int CoinsRedeemed { get; set; }
    /// <summary>Монеты на счетах всех клиентов — обязательства магазина.</summary>
    public int CoinsOutstanding { get; set; }
    public decimal Refunded { get; set; }
}

public class DashboardDayDto
{
    public DateOnly Date { get; set; }
    public int Orders { get; set; }
    public decimal? Revenue { get; set; }
}

public class DashboardTopProductDto
{
    public Guid ProductId { get; set; }
    public string NameRu { get; set; } = default!;
    public int Quantity { get; set; }
    public decimal? Revenue { get; set; }
}

public class DashboardCityDto
{
    public Guid? CityId { get; set; }
    /// <summary>null — самовывоз.</summary>
    public string? NameRu { get; set; }
    public int Orders { get; set; }
}

public class DashboardCustomersDto
{
    public int TotalClients { get; set; }
    public int NewClients { get; set; }
    /// <summary>Разные зарегистрированные покупатели за период.</summary>
    public int Buyers { get; set; }
    /// <summary>Покупатели периода, у которых больше одного заказа за всё время.</summary>
    public int RepeatBuyers { get; set; }
    public int GuestOrders { get; set; }
}

public class DashboardReviewsDto
{
    public int Pending { get; set; }
    public int Approved { get; set; }
    public double? AverageRating { get; set; }
}

public class DashboardCatalogDto
{
    public int ActiveProducts { get; set; }
    public int InactiveProducts { get; set; }
    public int ProductsWithoutImage { get; set; }
    public int ActivePromoCodes { get; set; }
    public int ActiveComboOffers { get; set; }
    public int ActiveDeliveryCities { get; set; }
}
