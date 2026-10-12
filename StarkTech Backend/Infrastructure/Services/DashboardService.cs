using Application.DTOs.Dashboard;
using Application.Interfaces.Services;
using Application.Results;
using Domain.Enums;
using Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Services;

public class DashboardService : IDashboardService
{
    // Магазин работает по времени Душанбе (UTC+5, без перехода на летнее время):
    // «сегодня» и разбивка по дням считаются в местном времени.
    private static readonly TimeSpan LocalOffset = TimeSpan.FromHours(5);

    private readonly AppDbContext _context;

    public DashboardService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<Result<DashboardDto>> GetAsync(int days, bool includeFinance)
    {
        days = Math.Clamp(days, 1, 365);

        var nowUtc = DateTime.UtcNow;
        var todayLocal = (nowUtc + LocalOffset).Date;
        var periodStartLocal = todayLocal.AddDays(-(days - 1));
        var periodStartUtc = DateTime.SpecifyKind(periodStartLocal - LocalOffset, DateTimeKind.Utc);
        var todayStartUtc = DateTime.SpecifyKind(todayLocal - LocalOffset, DateTimeKind.Utc);
        var previousStartUtc = periodStartUtc.AddDays(-days);

        // Заказы текущего и предыдущего периода — их немного, агрегируем в памяти.
        var orders = await _context.Orders
            .AsNoTracking()
            .Where(o => o.CreatedAt >= previousStartUtc)
            .Select(o => new OrderRow
            {
                CreatedAt = o.CreatedAt,
                Status = o.Status,
                PaymentStatus = o.PaymentStatus,
                PaymentMethod = o.PaymentMethod,
                Source = o.Source,
                TotalAmount = o.TotalAmount,
                DiscountAmount = o.DiscountAmount,
                CoinsUsed = o.CoinsUsed,
                DeliveryCost = o.DeliveryCost,
                DeliveryCityId = o.DeliveryCityId,
                UserId = o.UserId,
                HasPromo = o.PromoCodeId != null,
                HasCombo = o.ComboOfferId != null
            })
            .ToListAsync();

        var current = orders.Where(o => o.CreatedAt >= periodStartUtc).ToList();
        var previous = orders.Where(o => o.CreatedAt < periodStartUtc).ToList();
        var currentValid = current.Where(o => o.Status != OrderStatus.Cancelled).ToList();
        var previousValid = previous.Where(o => o.Status != OrderStatus.Cancelled).ToList();

        var dto = new DashboardDto
        {
            Days = days,
            PeriodStart = periodStartUtc,
            GeneratedAt = nowUtc
        };

        // ─── Очередь и что требует внимания ─────────────────────────────────
        var pipeline = await _context.Orders
            .AsNoTracking()
            .GroupBy(o => o.Status)
            .Select(g => new { Status = g.Key, Count = g.Count() })
            .ToListAsync();
        foreach (var status in Enum.GetValues<OrderStatus>())
            dto.Pipeline[status.ToString()] = pipeline.FirstOrDefault(p => p.Status == status)?.Count ?? 0;

        var staleBefore = nowUtc.AddHours(-24);
        dto.Attention = new DashboardAttentionDto
        {
            StaleNewOrders = await _context.Orders
                .CountAsync(o => o.Status == OrderStatus.New && o.CreatedAt < staleBefore),
            OrdersAwaitingPhotos = await _context.OrderItems
                .Where(i => (i.Order.Status == OrderStatus.New || i.Order.Status == OrderStatus.Confirmed)
                            && i.ProductVariant.Product.RequiresPhotoUpload
                            && !i.Photos.Any(p => !p.IsDeleted))
                .Select(i => i.OrderId)
                .Distinct()
                .CountAsync(),
            UnpaidReadyOrders = await _context.Orders
                .CountAsync(o => (o.Status == OrderStatus.ReadyForDelivery || o.Status == OrderStatus.Delivered)
                                 && o.PaymentStatus != PaymentStatus.Paid
                                 && o.PaymentStatus != PaymentStatus.Refunded),
            PendingReviews = await _context.Reviews.CountAsync(r => !r.IsApproved)
        };

        // ─── Заказы за период ───────────────────────────────────────────────
        dto.Orders = new DashboardOrdersDto
        {
            Count = current.Count,
            PreviousCount = previous.Count,
            Cancelled = current.Count(o => o.Status == OrderStatus.Cancelled),
            Today = current.Count(o => o.CreatedAt >= todayStartUtc),
            BySource = current.GroupBy(o => o.Source).ToDictionary(g => g.Key.ToString(), g => g.Count()),
            ByPaymentMethod = currentValid.GroupBy(o => o.PaymentMethod).ToDictionary(g => g.Key.ToString(), g => g.Count()),
            WithPromoCode = currentValid.Count(o => o.HasPromo),
            WithComboOffer = currentValid.Count(o => o.HasCombo)
        };

        // ─── Деньги ─────────────────────────────────────────────────────────
        if (includeFinance)
        {
            var revenue = currentValid.Sum(Payable);
            dto.Finance = new DashboardFinanceDto
            {
                Revenue = revenue,
                PreviousRevenue = previousValid.Sum(Payable),
                Paid = currentValid.Where(o => o.PaymentStatus == PaymentStatus.Paid).Sum(Payable),
                AwaitingPayment = currentValid.Where(o => o.PaymentStatus == PaymentStatus.Pending).Sum(Payable),
                AverageCheck = currentValid.Count > 0 ? Math.Round(revenue / currentValid.Count, 2) : 0,
                Discounts = currentValid.Sum(o => o.DiscountAmount),
                DeliveryIncome = currentValid.Sum(o => o.DeliveryCost),
                CoinsRedeemed = currentValid.Sum(o => o.CoinsUsed),
                CoinsOutstanding = await _context.Clients.SumAsync(c => c.CoinsBalance),
                Refunded = current.Where(o => o.PaymentStatus == PaymentStatus.Refunded).Sum(Payable)
            };
        }

        // ─── По дням ────────────────────────────────────────────────────────
        var byDay = current
            .GroupBy(o => DateOnly.FromDateTime((o.CreatedAt + LocalOffset).Date))
            .ToDictionary(g => g.Key, g => g.ToList());
        for (var d = periodStartLocal; d <= todayLocal; d = d.AddDays(1))
        {
            var date = DateOnly.FromDateTime(d);
            byDay.TryGetValue(date, out var dayOrders);
            dto.Daily.Add(new DashboardDayDto
            {
                Date = date,
                Orders = dayOrders?.Count ?? 0,
                Revenue = includeFinance
                    ? dayOrders?.Where(o => o.Status != OrderStatus.Cancelled).Sum(Payable) ?? 0
                    : null
            });
        }

        // ─── Топ товаров и городов ──────────────────────────────────────────
        var topProducts = await _context.OrderItems
            .AsNoTracking()
            .Where(i => i.Order.CreatedAt >= periodStartUtc && i.Order.Status != OrderStatus.Cancelled)
            .GroupBy(i => new { i.ProductVariant.ProductId, i.ProductVariant.Product.NameRu })
            .Select(g => new
            {
                g.Key.ProductId,
                g.Key.NameRu,
                Quantity = g.Sum(i => i.Quantity),
                Revenue = g.Sum(i => i.SubTotal)
            })
            .OrderByDescending(x => x.Quantity)
            .Take(5)
            .ToListAsync();
        dto.TopProducts = topProducts.Select(p => new DashboardTopProductDto
        {
            ProductId = p.ProductId,
            NameRu = p.NameRu,
            Quantity = p.Quantity,
            Revenue = includeFinance ? p.Revenue : null
        }).ToList();

        var cityNames = await _context.DeliveryCities
            .AsNoTracking()
            .ToDictionaryAsync(c => c.Id, c => c.NameRu);
        dto.TopCities = currentValid
            .GroupBy(o => o.DeliveryCityId)
            .Select(g => new DashboardCityDto
            {
                CityId = g.Key,
                NameRu = g.Key.HasValue && cityNames.TryGetValue(g.Key.Value, out var name) ? name : null,
                Orders = g.Count()
            })
            .OrderByDescending(c => c.Orders)
            .Take(5)
            .ToList();

        // ─── Клиенты ────────────────────────────────────────────────────────
        var buyerIds = currentValid.Where(o => o.UserId.HasValue).Select(o => o.UserId!.Value).Distinct().ToList();
        var repeatBuyers = buyerIds.Count == 0
            ? 0
            : await _context.Orders
                .Where(o => o.UserId != null && buyerIds.Contains(o.UserId.Value) && o.Status != OrderStatus.Cancelled)
                .GroupBy(o => o.UserId)
                .Where(g => g.Count() > 1)
                .CountAsync();

        dto.Customers = new DashboardCustomersDto
        {
            TotalClients = await _context.Clients.CountAsync(c => c.Role == UserRole.Client),
            NewClients = await _context.Clients.CountAsync(c => c.Role == UserRole.Client && c.RegisterAt >= periodStartUtc),
            Buyers = buyerIds.Count,
            RepeatBuyers = repeatBuyers,
            GuestOrders = currentValid.Count(o => !o.UserId.HasValue)
        };

        // ─── Отзывы и каталог ───────────────────────────────────────────────
        dto.Reviews = new DashboardReviewsDto
        {
            Pending = dto.Attention.PendingReviews,
            Approved = await _context.Reviews.CountAsync(r => r.IsApproved),
            AverageRating = await _context.Reviews
                .Where(r => r.IsApproved)
                .Select(r => (double?)r.Rating)
                .AverageAsync()
        };

        dto.Catalog = new DashboardCatalogDto
        {
            ActiveProducts = await _context.Products.CountAsync(p => !p.IsDeleted && p.IsActive),
            InactiveProducts = await _context.Products.CountAsync(p => !p.IsDeleted && !p.IsActive),
            ProductsWithoutImage = await _context.Products.CountAsync(p => !p.IsDeleted && p.IsActive && (p.MainImageUrl == null || p.MainImageUrl == "")),
            ActivePromoCodes = await _context.PromoCodes.CountAsync(p =>
                p.IsActive
                && (p.ValidFrom == null || p.ValidFrom <= nowUtc)
                && (p.ValidTo == null || p.ValidTo >= nowUtc)
                && (p.MaxUsages == null || p.UsedCount < p.MaxUsages)),
            ActiveComboOffers = await _context.ComboOffers.CountAsync(c =>
                c.IsActive
                && (c.ValidFrom == null || c.ValidFrom <= nowUtc)
                && (c.ValidTo == null || c.ValidTo >= nowUtc)),
            ActiveDeliveryCities = await _context.DeliveryCities.CountAsync(c => c.IsActive)
        };

        return Result<DashboardDto>.Ok(dto);
    }

    // Совпадает с OrderService.ComputePayable.
    private static decimal Payable(OrderRow o)
        => Math.Max(0, o.TotalAmount - o.DiscountAmount - o.CoinsUsed + o.DeliveryCost);

    private sealed class OrderRow
    {
        public DateTime CreatedAt { get; init; }
        public OrderStatus Status { get; init; }
        public PaymentStatus PaymentStatus { get; init; }
        public PaymentMethod PaymentMethod { get; init; }
        public OrderSource Source { get; init; }
        public decimal TotalAmount { get; init; }
        public decimal DiscountAmount { get; init; }
        public int CoinsUsed { get; init; }
        public decimal DeliveryCost { get; init; }
        public Guid? DeliveryCityId { get; init; }
        public Guid? UserId { get; init; }
        public bool HasPromo { get; init; }
        public bool HasCombo { get; init; }
    }
}
