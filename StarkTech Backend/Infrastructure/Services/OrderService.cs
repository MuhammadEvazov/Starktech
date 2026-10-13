using Application.DTOs.Order;
using Application.Interfaces.Repositories;
using Application.Interfaces.Services;
using Application.Result;
using Application.Results;
using Domain.Common;
using Domain.Entities;
using Domain.Enums;
using Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Npgsql;

namespace Infrastructure.Services;

public class OrderService : IOrderService
{
    private readonly IOrderRepository _orderRepository;
    private readonly IOrderItemRepository _orderItemRepository;
    private readonly IProductVariantRepository _variantRepository;
    private readonly IProductRepository _productRepository;
    private readonly IDeliveryCityRepository _deliveryCityRepository;
    private readonly IPromoCodeRepository _promoCodeRepository;
    private readonly IComboOfferRepository _comboOfferRepository;
    private readonly IUserRepository _userRepository;
    private readonly ICoinsTransactionService _coinsTransactionService;
    private readonly INotificationService _notificationService;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IOrderActivityService _activity;
    private readonly AppDbContext _context;
    private readonly ILogger<OrderService> _logger;

    private const decimal CoinsEarnRate = 0.05m;

    private const string PaidEditBlockedMessage = "Заказ уже оплачен — изменить состав можно через менеджера в чате";

    // Cancellation is intentionally absent: it goes through CancelAsync so coins and promo usage are returned.
    // Согласование макета — необязательный шаг: из «Подтверждён» можно сразу в производство.
    private static readonly Dictionary<OrderStatus, OrderStatus[]> NextStatuses = new()
    {
        [OrderStatus.New] = new[] { OrderStatus.Confirmed },
        [OrderStatus.Confirmed] = new[] { OrderStatus.AwaitingLayoutApproval, OrderStatus.InProduction },
        [OrderStatus.AwaitingLayoutApproval] = new[] { OrderStatus.InProduction },
        [OrderStatus.InProduction] = new[] { OrderStatus.ReadyForDelivery },
        [OrderStatus.ReadyForDelivery] = new[] { OrderStatus.Delivered }
    };

    // Отменить можно, пока заказ не ушёл в производство.
    private static readonly OrderStatus[] CancellableStatuses =
        { OrderStatus.New, OrderStatus.Confirmed, OrderStatus.AwaitingLayoutApproval };

    // Перед этими статусами проверяем, что фото загружены на все штуки.
    private static readonly OrderStatus[] PhotoCheckedStatuses =
        { OrderStatus.AwaitingLayoutApproval, OrderStatus.InProduction };

    public OrderService(
        IOrderRepository orderRepository,
        IOrderItemRepository orderItemRepository,
        IProductVariantRepository variantRepository,
        IProductRepository productRepository,
        IDeliveryCityRepository deliveryCityRepository,
        IPromoCodeRepository promoCodeRepository,
        IComboOfferRepository comboOfferRepository,
        IUserRepository userRepository,
        ICoinsTransactionService coinsTransactionService,
        INotificationService notificationService,
        IUnitOfWork unitOfWork,
        IOrderActivityService activity,
        AppDbContext context,
        ILogger<OrderService> logger)
    {
        _orderRepository = orderRepository;
        _orderItemRepository = orderItemRepository;
        _variantRepository = variantRepository;
        _productRepository = productRepository;
        _deliveryCityRepository = deliveryCityRepository;
        _promoCodeRepository = promoCodeRepository;
        _comboOfferRepository = comboOfferRepository;
        _userRepository = userRepository;
        _coinsTransactionService = coinsTransactionService;
        _notificationService = notificationService;
        _unitOfWork = unitOfWork;
        _activity = activity;
        _context = context;
        _logger = logger;
    }

    public async Task<Result<PageResult<GetOrderDto>>> GetAllAsync(GetOrderFilterDto filter, Guid? restrictToUserId)
    {
        if (restrictToUserId.HasValue)
            filter.UserId = restrictToUserId.Value;

        var orders = await _orderRepository.GetAllAsync(filter);

        var items = orders.Items.Select(ToDto).ToList();

        var pageResult = new PageResult<GetOrderDto>(
            items,
            orders.TotalCount,
            orders.Page,
            orders.PageSize);

        return Result<PageResult<GetOrderDto>>.Ok(pageResult);
    }

    public async Task<Result<GetOrderDto>> GetByIdAsync(Guid id, Guid? restrictToUserId)
    {
        var order = await _orderRepository.GetByIdAsync(id);
        if (order == null || (restrictToUserId.HasValue && order.UserId != restrictToUserId.Value))
            return Result<GetOrderDto>.Fail("Order not found", ErrorType.NotFound);

        return Result<GetOrderDto>.Ok(ToDto(order));
    }

    public async Task<Result<CreateOrderResponseDto>> CreateAsync(CreateOrderDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.ContactName) || string.IsNullOrWhiteSpace(dto.ContactPhone))
            return Result<CreateOrderResponseDto>.Fail("Contact name and phone are required", ErrorType.Validation);

        if (dto.Items.Count == 0)
            return Result<CreateOrderResponseDto>.Fail("Order must contain at least one item", ErrorType.Validation);

        if (dto.CoinsUsed < 0)
            return Result<CreateOrderResponseDto>.Fail("Coins used cannot be negative", ErrorType.Validation);

        if (dto.CoinsUsed > 0 && !dto.UserId.HasValue)
            return Result<CreateOrderResponseDto>.Fail("Coins can only be used by a registered user", ErrorType.Validation);

        if (!Enum.IsDefined(dto.PaymentMethod))
            return Result<CreateOrderResponseDto>.Fail("Выберите способ оплаты", ErrorType.Validation);

        if (!Enum.IsDefined(dto.Source))
            return Result<CreateOrderResponseDto>.Fail("Unknown order source", ErrorType.Validation);

        if (dto.Items.Any(i => i.Quantity <= 0))
            return Result<CreateOrderResponseDto>.Fail("Item quantity must be greater than zero", ErrorType.Validation);

        // Номер заказа уникален; при редком совпадении (параллельное оформление) пробуем ещё раз.
        for (var attempt = 0; ; attempt++)
        {
            Order? createdOrder = null;
            Result<CreateOrderResponseDto> result;
            try
            {
                result = await _unitOfWork.ExecuteInTransactionAsync(async () =>
                {
                    var created = await CreateCoreAsync(dto);
                    createdOrder = created.Order;
                    return created.Result;
                });
            }
            catch (DbUpdateException ex) when (attempt == 0 && IsOrderNumberConflict(ex))
            {
                _logger.LogWarning("Order number collision, retrying order creation");
                continue;
            }

            if (result.IsSuccess && createdOrder != null)
            {
                _logger.LogInformation("Order created with ID: {Id}, Number: {Number}", createdOrder.Id, createdOrder.OrderNumber);
                await NotifyStatusAsync(createdOrder);
            }

            return result;
        }
    }

    private static bool IsOrderNumberConflict(DbUpdateException ex)
        => ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation } pg
           && (pg.ConstraintName?.Contains("OrderNumber", StringComparison.OrdinalIgnoreCase) ?? false);

    private async Task<(Result<CreateOrderResponseDto> Result, Order? Order)> CreateCoreAsync(CreateOrderDto dto)
    {
        static (Result<CreateOrderResponseDto>, Order?) Fail(string error, ErrorType type)
            => (Result<CreateOrderResponseDto>.Fail(error, type), null);

        if (dto.UserId.HasValue && !await _userRepository.ExistsAsync(dto.UserId.Value))
            return Fail("User not found", ErrorType.NotFound);

        var settings = await PaymentService.ReadSettingsAsync(_context);
        if (!PaymentService.IsMethodEnabled(settings, dto.PaymentMethod))
            return Fail("Этот способ оплаты сейчас недоступен — выберите другой", ErrorType.Validation);

        decimal deliveryCost = 0;
        if (dto.DeliveryCityId.HasValue)
        {
            var city = await _deliveryCityRepository.GetByIdAsync(dto.DeliveryCityId.Value);
            if (city == null)
                return Fail("Delivery city not found", ErrorType.NotFound);
            if (!city.IsActive)
                return Fail("Доставка в этот город сейчас недоступна", ErrorType.Validation);

            deliveryCost = city.DeliveryCost;
        }

        // Одинаковые варианты складываем в одну позицию — скидка за количество считается от общего числа штук.
        var lines = dto.Items
            .GroupBy(i => i.ProductVariantId)
            .Select(g => (VariantId: g.Key, Quantity: g.Sum(i => i.Quantity)))
            .ToList();

        var orderItems = new List<OrderItem>();
        var pricedItems = new List<(Guid ProductId, decimal SubTotal)>();

        foreach (var line in lines)
        {
            var variant = await _variantRepository.GetByIdAsync(line.VariantId);
            if (variant == null)
                return Fail($"Product variant {line.VariantId} not found", ErrorType.NotFound);

            var product = await _productRepository.GetByIdAsync(variant.ProductId);
            if (!variant.IsActive || product == null || !product.IsActive)
                return Fail($"Product variant {line.VariantId} is not active", ErrorType.Validation);

            var item = new OrderItem { ProductVariantId = variant.Id, Quantity = line.Quantity };
            PriceItem(item, variant.Price, product.QuantityTiersJson);

            orderItems.Add(item);
            pricedItems.Add((variant.ProductId, item.SubTotal));
        }

        var itemsSubtotal = orderItems.Sum(i => i.SubTotal);
        var now = DateTime.UtcNow;

        decimal? promoDiscount = null;
        PromoCode? promo = null;
        if (dto.PromoCodeId.HasValue)
        {
            promo = await _promoCodeRepository.GetByIdAsync(dto.PromoCodeId.Value);
            if (promo == null)
                return Fail("Promo code not found", ErrorType.NotFound);

            // Сроки промокода хранятся в UTC (из админки переводятся через ShopClock.FromLocal).
            if (!promo.IsActive
                || (promo.ValidFrom.HasValue && now < promo.ValidFrom.Value)
                || (promo.ValidTo.HasValue && now > promo.ValidTo.Value))
                return Fail("Promo code is not valid", ErrorType.Validation);

            if (promo.MaxUsages.HasValue && promo.UsedCount >= promo.MaxUsages.Value)
                return Fail("Promo code usage limit has been reached", ErrorType.Validation);

            if (promo.MaxUsagesPerUser.HasValue && dto.UserId.HasValue)
            {
                // Блокировка на пару «клиент + промокод», чтобы два параллельных заказа не обошли лимит.
                var lockKey = $"promo:{promo.Id}:{dto.UserId.Value}";
                await _context.Database.ExecuteSqlInterpolatedAsync($"SELECT pg_advisory_xact_lock(hashtext({lockKey}))");

                var userId = dto.UserId.Value;
                var promoId = promo.Id;
                var usedByUser = await _context.Orders.CountAsync(o =>
                    o.UserId == userId && o.PromoCodeId == promoId && o.Status != OrderStatus.Cancelled);

                if (usedByUser >= promo.MaxUsagesPerUser.Value)
                    return Fail("Вы уже использовали этот промокод", ErrorType.Validation);
            }

            promoDiscount = PromoDiscount(promo, itemsSubtotal);
        }

        decimal? comboDiscount = null;
        if (dto.ComboOfferId.HasValue)
        {
            var combo = await _comboOfferRepository.GetByIdAsync(dto.ComboOfferId.Value);
            if (combo == null)
                return Fail("Combo offer not found", ErrorType.NotFound);

            if (!combo.IsActive
                || (combo.ValidFrom.HasValue && now < combo.ValidFrom.Value)
                || (combo.ValidTo.HasValue && now > combo.ValidTo.Value))
                return Fail("Combo offer is not valid", ErrorType.Validation);

            // Скидка комбо действует, только если в заказе есть все товары набора.
            comboDiscount = ComboDiscount(combo, pricedItems);
            if (comboDiscount == null)
                return Fail("Order does not contain all products of the combo offer", ErrorType.Validation);
        }

        // Промокод и комбо не суммируются — применяется более выгодная скидка, вторая не сохраняется.
        var usePromo = promoDiscount.HasValue && (!comboDiscount.HasValue || promoDiscount.Value >= comboDiscount.Value);
        var discountAmount = usePromo ? promoDiscount!.Value : comboDiscount ?? 0;
        discountAmount = Math.Clamp(discountAmount, 0, itemsSubtotal);

        if (usePromo && !await _promoCodeRepository.TryIncrementUsageAsync(promo!.Id))
            return Fail("Promo code usage limit has been reached", ErrorType.Validation);

        if (dto.CoinsUsed > itemsSubtotal - discountAmount)
            return Fail("Coins used cannot exceed the order amount after discounts", ErrorType.Validation);

        var order = new Order
        {
            OrderNumber = await GenerateOrderNumberAsync(),
            UserId = dto.UserId,
            Status = OrderStatus.New,
            TotalAmount = itemsSubtotal,
            DiscountAmount = discountAmount,
            PromoCodeId = usePromo ? dto.PromoCodeId : null,
            ComboOfferId = !usePromo && comboDiscount.HasValue ? dto.ComboOfferId : null,
            DeliveryCityId = dto.DeliveryCityId,
            DeliveryAddress = dto.DeliveryAddress,
            DeliveryCost = deliveryCost,
            ContactName = dto.ContactName,
            ContactPhone = dto.ContactPhone,
            ContactEmail = dto.ContactEmail,
            PaymentMethod = dto.PaymentMethod,
            PaymentStatus = PaymentStatus.Pending,
            // Процент предоплаты запоминается по правилам магазина на момент оформления.
            PrepaymentPercent = PaymentService.PrepaymentPercentFor(settings, dto.PaymentMethod),
            Source = dto.Source,
            CoinsUsed = dto.CoinsUsed,
            Items = orderItems
        };

        // Платить нечего (всё покрыли скидка и монеты, доставка бесплатная) — заказ сразу оплачен.
        RecalcPaymentStatus(order);

        await _orderRepository.AddAsync(order);

        if (dto.CoinsUsed > 0)
        {
            var redeemResult = await _coinsTransactionService.RedeemAsync(
                dto.UserId!.Value,
                dto.CoinsUsed,
                order.Id,
                $"Used on order {order.OrderNumber}");

            if (!redeemResult.IsSuccess)
                return (Result<CreateOrderResponseDto>.Fail(redeemResult.Errors, redeemResult.ErrorType), null);
        }

        return (Result<CreateOrderResponseDto>.Ok(new CreateOrderResponseDto
        {
            Id = order.Id,
            OrderNumber = order.OrderNumber,
            Status = order.Status,
            TotalAmount = order.TotalAmount,
            DiscountAmount = order.DiscountAmount,
            DeliveryCost = order.DeliveryCost,
            PayableAmount = ComputePayable(order)
        }), order);
    }

    public async Task<Result<GetOrderDto>> UpdateStatusAsync(Guid id, UpdateOrderStatusDto dto)
    {
        if (!Enum.IsDefined(dto.Status))
            return Result<GetOrderDto>.Fail("Unknown order status", ErrorType.Validation);

        if (dto.PaymentStatus.HasValue && !Enum.IsDefined(dto.PaymentStatus.Value))
            return Result<GetOrderDto>.Fail("Unknown payment status", ErrorType.Validation);

        Order? orderWithNewStatus = null;

        var result = await _unitOfWork.ExecuteInTransactionAsync(async () =>
        {
            await _orderRepository.LockForUpdateAsync(id);

            var order = await _orderRepository.GetByIdTrackedAsync(id);
            if (order == null)
                return Result<GetOrderDto>.Fail("Order not found", ErrorType.NotFound);

            // Для уже отменённого заказа статус не меняется, но можно отметить возврат оплаты.
            if (dto.Status == OrderStatus.Cancelled && order.Status != OrderStatus.Cancelled)
                return Result<GetOrderDto>.Fail("Use the cancel endpoint to cancel an order", ErrorType.Validation);

            var statusChanges = order.Status != dto.Status;

            if (statusChanges && !IsTransitionAllowed(order.Status, dto.Status))
                return Result<GetOrderDto>.Fail($"Cannot change order status from {order.Status} to {dto.Status}", ErrorType.Validation);

            if (statusChanges && PhotoCheckedStatuses.Contains(dto.Status) && !dto.IgnoreMissingPhotos)
            {
                var missing = await MissingPhotosAsync(order);
                if (missing.Count > 0)
                {
                    var errors = new List<string> { "Не у всех позиций загружены фото на каждую штуку:" };
                    errors.AddRange(missing);
                    return Result<GetOrderDto>.Fail(errors, ErrorType.Validation);
                }
            }

            string? paymentNote = null;
            if (dto.PaymentStatus.HasValue && dto.PaymentStatus.Value != order.PaymentStatus)
            {
                var paymentError = ApplyManualPaymentStatus(order, dto.PaymentStatus.Value, out paymentNote);
                if (paymentError != null)
                    return Result<GetOrderDto>.Fail(paymentError, ErrorType.Validation);
            }

            order.Status = dto.Status;

            // Кэшбэк — от суммы товаров после скидки и списанных монет, без доставки.
            var earnsCoins = statusChanges && order.Status == OrderStatus.Delivered && order.UserId.HasValue;
            if (earnsCoins)
                order.CoinsEarned = (int)Math.Floor(CashbackBase(order) * CoinsEarnRate);

            await _orderRepository.UpdateAsync(order);

            if (paymentNote != null)
                await _activity.LogAsync(order.Id, paymentNote, byClient: false);

            if (earnsCoins && order.CoinsEarned > 0)
            {
                var earnResult = await _coinsTransactionService.EarnAsync(
                    order.UserId!.Value,
                    order.CoinsEarned,
                    order.Id,
                    $"Earned from order {order.OrderNumber}");

                if (!earnResult.IsSuccess)
                    return Result<GetOrderDto>.Fail(earnResult.Errors, earnResult.ErrorType);
            }

            if (statusChanges)
                orderWithNewStatus = order;

            return Result<GetOrderDto>.Ok(ToDto(order));
        });

        if (result.IsSuccess && orderWithNewStatus != null)
            await NotifyStatusAsync(orderWithNewStatus);

        return result;
    }

    // Ручная смена статуса оплаты сотрудником. Возвращает текст ошибки или null.
    private static string? ApplyManualPaymentStatus(Order order, PaymentStatus requested, out string? note)
    {
        note = null;

        if (order.Status == OrderStatus.Cancelled && requested != PaymentStatus.Refunded)
            return "Для отменённого заказа можно отметить только возврат оплаты";

        switch (requested)
        {
            case PaymentStatus.Paid:
            {
                // Оплата получена наличными или вне сайта — считаем, что внесена вся сумма к оплате.
                var payable = ComputePayable(order);
                var added = Math.Max(0, payable - order.PaidAmount);
                order.PaidAmount = Math.Max(order.PaidAmount, payable);
                order.PaymentStatus = PaymentStatus.Paid;
                note = $"Оплата отмечена сотрудником (вне сайта, {Money(added)}; всего оплачено {Money(order.PaidAmount)})";
                return null;
            }
            case PaymentStatus.Refunded:
                if (order.PaidAmount <= 0)
                    return "Возврат можно отметить, только если оплата была принята";
                order.PaymentStatus = PaymentStatus.Refunded;
                note = $"Сотрудник отметил возврат оплаты ({Money(order.PaidAmount)})";
                return null;
            case PaymentStatus.Failed:
                order.PaymentStatus = PaymentStatus.Failed;
                note = "Сотрудник отметил оплату как неуспешную";
                return null;
            case PaymentStatus.Pending:
                if (order.PaidAmount > 0)
                    return "Оплата уже принята — статус «Ожидает оплаты» поставить нельзя";
                order.PaymentStatus = PaymentStatus.Pending;
                note = "Сотрудник вернул статус оплаты «Ожидает оплаты»";
                return null;
            case PaymentStatus.PartiallyPaid:
                return "«Частично оплачен» ставится автоматически по принятым чекам";
            default:
                return "Unknown payment status";
        }
    }

    // Позиции товаров, требующих фото, где стикеров по фото (сумма Copies) меньше, чем штук
    // (удалённые фото не считаются).
    private async Task<List<string>> MissingPhotosAsync(Order order)
    {
        var counts = await _context.OrderItemPhotos
            .Where(p => !p.IsDeleted && p.OrderItem.OrderId == order.Id)
            .GroupBy(p => p.OrderItemId)
            .Select(g => new { ItemId = g.Key, Count = g.Sum(p => p.Copies) })
            .ToDictionaryAsync(x => x.ItemId, x => x.Count);

        return order.Items
            .Where(i => i.ProductVariant.Product.RequiresPhotoUpload)
            .Select(i => (Item: i, Count: counts.GetValueOrDefault(i.Id)))
            .Where(x => x.Count < x.Item.Quantity)
            .Select(x => $"«{x.Item.ProductVariant.Product.NameRu}» — загружено {x.Count} из {x.Item.Quantity}")
            .ToList();
    }

    public async Task<Result<bool>> CancelAsync(Guid id)
    {
        Order? cancelledOrder = null;

        var result = await _unitOfWork.ExecuteInTransactionAsync(async () =>
        {
            await _orderRepository.LockForUpdateAsync(id);

            var order = await _orderRepository.GetByIdTrackedAsync(id);
            if (order == null)
                return Result<bool>.Fail("Order not found", ErrorType.NotFound);

            if (order.Status == OrderStatus.Cancelled)
                return Result<bool>.Ok(true);

            if (!CancellableStatuses.Contains(order.Status))
                return Result<bool>.Fail("Отменить можно только заказ в статусе «Новый», «Подтверждён» или «Согласование макета»", ErrorType.Validation);

            order.Status = OrderStatus.Cancelled;

            // Чеки «на проверке» больше не нужны; принятая сумма остаётся (видна как «к возврату»).
            var pendingProofs = await _context.Set<OrderPaymentProof>()
                .Where(p => p.OrderId == order.Id && p.Status == PaymentProofStatus.Pending)
                .ToListAsync();
            foreach (var proof in pendingProofs)
            {
                proof.Status = PaymentProofStatus.Rejected;
                proof.RejectReason = "Заказ отменён";
                proof.ReviewedAt = DateTime.UtcNow;
                proof.ReviewedBy = "Система";
            }
            order.HasPendingPaymentProof = false;
            RecalcPaymentStatus(order);

            await _orderRepository.UpdateAsync(order);

            if (order.CoinsUsed > 0 && order.UserId.HasValue)
            {
                var refundResult = await _coinsTransactionService.RefundAsync(
                    order.UserId.Value,
                    order.CoinsUsed,
                    order.Id,
                    $"Refund for cancelled order {order.OrderNumber}");

                if (!refundResult.IsSuccess)
                    return Result<bool>.Fail(refundResult.Errors, refundResult.ErrorType);
            }

            if (order.PromoCodeId.HasValue)
                await _promoCodeRepository.DecrementUsageAsync(order.PromoCodeId.Value);

            var note = "Заказ отменён";
            if (pendingProofs.Count > 0)
                note += $"; чеков на проверке отклонено: {pendingProofs.Count}";
            if (order.PaidAmount > 0)
                note += $"; к возврату {Money(order.PaidAmount)}";
            await _activity.LogAsync(order.Id, note, byClient: false);

            cancelledOrder = order;

            return Result<bool>.Ok(true);
        });

        if (result.IsSuccess && cancelledOrder != null)
            await NotifyStatusAsync(cancelledOrder);

        return result;
    }

    public Task<Result<OrderItemResponseDto>> AddItemAsync(Guid orderId, AddOrderItemDto dto, Guid? restrictToUserId = null)
    {
        if (dto.Quantity <= 0)
            return Task.FromResult(Result<OrderItemResponseDto>.Fail("Item quantity must be greater than zero", ErrorType.Validation));

        return _unitOfWork.ExecuteInTransactionAsync(async () =>
        {
            await _orderRepository.LockForUpdateAsync(orderId);

            var order = await _orderRepository.GetByIdTrackedAsync(orderId);
            if (order == null || (restrictToUserId.HasValue && order.UserId != restrictToUserId))
                return Result<OrderItemResponseDto>.Fail("Order not found", ErrorType.NotFound);

            var editError = EditBlockReason(order, restrictToUserId);
            if (editError != null)
                return Result<OrderItemResponseDto>.Fail(editError, ErrorType.Validation);

            var variant = await _variantRepository.GetByIdAsync(dto.ProductVariantId);
            if (variant == null)
                return Result<OrderItemResponseDto>.Fail("Product variant not found", ErrorType.NotFound);

            var product = await _productRepository.GetByIdAsync(variant.ProductId);
            if (!variant.IsActive || product == null || !product.IsActive)
                return Result<OrderItemResponseDto>.Fail("Product variant is not active", ErrorType.Validation);

            var existingItems = order.Items.ToList();

            var newItem = new OrderItem
            {
                OrderId = order.Id,
                ProductVariantId = variant.Id,
                Quantity = dto.Quantity
            };
            PriceItem(newItem, variant.Price, product.QuantityTiersJson);

            await _orderItemRepository.AddAsync(newItem);

            var priced = existingItems.Select(i => (i.ProductVariant.ProductId, i.SubTotal)).ToList();
            priced.Add((variant.ProductId, newItem.SubTotal));

            var recalcError = await RecalculateTotalsAsync(order, priced, restrictToUserId);
            if (recalcError != null)
                return Result<OrderItemResponseDto>.Fail(recalcError, ErrorType.Validation);

            await _orderRepository.UpdateAsync(order);

            await _activity.LogAsync(order.Id,
                $"{Who(restrictToUserId)} добавил «{product.NameRu}» × {dto.Quantity}",
                restrictToUserId.HasValue);

            return Result<OrderItemResponseDto>.Ok(ToItemResponseDto(newItem, order));
        });
    }

    public Task<Result<OrderItemResponseDto>> UpdateItemQuantityAsync(Guid orderId, Guid itemId, UpdateOrderItemDto dto, Guid? restrictToUserId = null)
    {
        if (dto.Quantity <= 0)
            return Task.FromResult(Result<OrderItemResponseDto>.Fail("Item quantity must be greater than zero", ErrorType.Validation));

        return _unitOfWork.ExecuteInTransactionAsync(async () =>
        {
            await _orderRepository.LockForUpdateAsync(orderId);

            var order = await _orderRepository.GetByIdTrackedAsync(orderId);
            if (order == null || (restrictToUserId.HasValue && order.UserId != restrictToUserId))
                return Result<OrderItemResponseDto>.Fail("Order not found", ErrorType.NotFound);

            var editError = EditBlockReason(order, restrictToUserId);
            if (editError != null)
                return Result<OrderItemResponseDto>.Fail(editError, ErrorType.Validation);

            var item = order.Items.FirstOrDefault(i => i.Id == itemId);
            if (item == null)
                return Result<OrderItemResponseDto>.Fail("Order item not found", ErrorType.NotFound);

            var oldQuantity = item.Quantity;

            // Клиент не может сделать штук меньше, чем уже распределено стикеров по фото
            if (restrictToUserId.HasValue && dto.Quantity < oldQuantity)
            {
                var photoCopies = await _context.OrderItemPhotos
                    .Where(p => p.OrderItemId == item.Id && !p.IsDeleted)
                    .SumAsync(p => (int?)p.Copies) ?? 0;
                if (dto.Quantity < photoCopies)
                    return Result<OrderItemResponseDto>.Fail(
                        $"Нельзя меньше, чем стикеров по фото ({photoCopies}) — уменьшите количество у фото",
                        ErrorType.Validation);
            }

            // Цена за штуку пересчитывается: от количества зависит ступень скидки.
            item.Quantity = dto.Quantity;
            PriceItem(item, item.ProductVariant.Price, item.ProductVariant.Product.QuantityTiersJson);

            var priced = order.Items.Select(i => (i.ProductVariant.ProductId, i.SubTotal)).ToList();
            var recalcError = await RecalculateTotalsAsync(order, priced, restrictToUserId);
            if (recalcError != null)
                return Result<OrderItemResponseDto>.Fail(recalcError, ErrorType.Validation);

            await _orderRepository.UpdateAsync(order);

            if (oldQuantity != dto.Quantity)
            {
                await _activity.LogAsync(order.Id,
                    $"{Who(restrictToUserId)} изменил количество «{item.ProductVariant.Product.NameRu}»: {oldQuantity} → {dto.Quantity}",
                    restrictToUserId.HasValue);
            }

            return Result<OrderItemResponseDto>.Ok(ToItemResponseDto(item, order));
        });
    }

    public Task<Result<bool>> RemoveItemAsync(Guid orderId, Guid itemId, Guid? restrictToUserId = null)
    {
        return _unitOfWork.ExecuteInTransactionAsync(async () =>
        {
            await _orderRepository.LockForUpdateAsync(orderId);

            var order = await _orderRepository.GetByIdTrackedAsync(orderId);
            if (order == null || (restrictToUserId.HasValue && order.UserId != restrictToUserId))
                return Result<bool>.Fail("Order not found", ErrorType.NotFound);

            var editError = EditBlockReason(order, restrictToUserId);
            if (editError != null)
                return Result<bool>.Fail(editError, ErrorType.Validation);

            var item = order.Items.FirstOrDefault(i => i.Id == itemId);
            if (item == null)
                return Result<bool>.Fail("Order item not found", ErrorType.NotFound);

            if (order.Items.Count <= 1)
                return Result<bool>.Fail("Order must have at least one item", ErrorType.Validation);

            var removedName = item.ProductVariant.Product.NameRu;
            var priced = order.Items
                .Where(i => i.Id != item.Id)
                .Select(i => (i.ProductVariant.ProductId, i.SubTotal))
                .ToList();

            await _orderItemRepository.DeleteAsync(item);

            var recalcError = await RecalculateTotalsAsync(order, priced, restrictToUserId);
            if (recalcError != null)
                return Result<bool>.Fail(recalcError, ErrorType.Validation);

            await _orderRepository.UpdateAsync(order);

            await _activity.LogAsync(order.Id, $"{Who(restrictToUserId)} убрал «{removedName}» из заказа", restrictToUserId.HasValue);

            return Result<bool>.Ok(true);
        });
    }

    // Состав заказа меняется, пока он не ушёл в производство — как и фото клиента.
    private static readonly OrderStatus[] ItemEditableStatuses = { OrderStatus.New, OrderStatus.Confirmed };

    // Клиент меняет состав сам, только пока ничего не оплачено и нет чека на проверке.
    private static bool CustomerMayEdit(Order order)
        => ItemEditableStatuses.Contains(order.Status) && order.PaidAmount == 0 && !order.HasPendingPaymentProof;

    private static string? EditBlockReason(Order order, Guid? restrictToUserId)
    {
        if (!ItemEditableStatuses.Contains(order.Status))
            return "Состав заказа можно менять, пока он «Новый» или «Подтверждён»";

        if (restrictToUserId.HasValue && !CustomerMayEdit(order))
            return PaidEditBlockedMessage;

        return null;
    }

    /// <summary>
    /// Пересчёт суммы товаров и скидки после изменения состава (C5): промокод и комбо не суммируются,
    /// комбо снимается, если в заказе больше нет всех его товаров. Затем пересчитывается статус оплаты.
    /// Возвращает текст ошибки или null.
    /// </summary>
    private async Task<string?> RecalculateTotalsAsync(Order order, List<(Guid ProductId, decimal SubTotal)> items, Guid? restrictToUserId)
    {
        var subtotal = items.Sum(i => i.SubTotal);
        order.TotalAmount = subtotal;

        decimal? promoDiscount = null;
        if (order.PromoCodeId.HasValue)
        {
            var promo = await _promoCodeRepository.GetByIdAsync(order.PromoCodeId.Value);
            // Промокод уже был принят при оформлении — его срок и активность здесь не проверяем.
            promoDiscount = promo != null
                ? PromoDiscount(promo, subtotal)
                : Math.Clamp(order.DiscountAmount, 0, subtotal);
        }

        decimal? comboDiscount = null;
        var comboRemoved = false;
        if (order.ComboOfferId.HasValue)
        {
            var combo = await _comboOfferRepository.GetByIdAsync(order.ComboOfferId.Value);
            comboDiscount = combo == null ? null : ComboDiscount(combo, items);
            if (comboDiscount == null)
            {
                order.ComboOfferId = null;
                comboRemoved = true;
            }
        }

        decimal discount;
        if (promoDiscount.HasValue && comboDiscount.HasValue)
        {
            if (comboDiscount.Value > promoDiscount.Value)
            {
                await _promoCodeRepository.DecrementUsageAsync(order.PromoCodeId!.Value);
                order.PromoCodeId = null;
                discount = comboDiscount.Value;
            }
            else
            {
                order.ComboOfferId = null;
                discount = promoDiscount.Value;
            }
        }
        else
        {
            discount = promoDiscount ?? comboDiscount ?? 0;
        }

        order.DiscountAmount = Math.Clamp(discount, 0, subtotal);

        if (order.TotalAmount - order.DiscountAmount < order.CoinsUsed)
            return "Order total cannot drop below the discount and coins already applied";

        RecalcPaymentStatus(order);

        if (comboRemoved)
        {
            await _activity.LogAsync(order.Id,
                "Комбо-скидка снята: в заказе больше нет всех товаров набора",
                restrictToUserId.HasValue);
        }

        return null;
    }

    private static string Who(Guid? restrictToUserId) => restrictToUserId.HasValue ? "Клиент" : "Сотрудник";

    private static string Money(decimal value) => $"{value:0.##} смн";

    private static decimal Round2(decimal value) => Math.Round(value, 2, MidpointRounding.AwayFromZero);

    /// <summary>Разрешён ли переход статуса (кроме отмены — она идёт через CancelAsync).</summary>
    public static bool IsTransitionAllowed(OrderStatus current, OrderStatus requested)
        => NextStatuses.TryGetValue(current, out var next) && next.Contains(requested);

    // Уведомление — после коммита; его сбой не должен превращать успешную операцию в ошибку 500.
    private async Task NotifyStatusAsync(Order order)
    {
        try
        {
            await _notificationService.NotifyOrderStatusChangeAsync(order.Id, order.OrderNumber, order.Status, order.ContactEmail);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send status notification for order {OrderId}", order.Id);
        }
    }

    private static List<Guid> ParseGuids(string? json)
    {
        try
        {
            return System.Text.Json.JsonSerializer.Deserialize<List<Guid>>(json ?? "[]") ?? new List<Guid>();
        }
        catch (System.Text.Json.JsonException)
        {
            return new List<Guid>();
        }
    }

    // Скидка от базы: процент ограничен 0..100, фиксированная сумма — не больше базы; округление до 2 знаков.
    private static decimal DiscountFrom(decimal baseAmount, DiscountType type, decimal value)
    {
        if (baseAmount <= 0) return 0;
        value = Math.Max(0, value);
        var amount = type == DiscountType.Percent
            ? baseAmount * Math.Min(value, 100m) / 100m
            : value;
        return Round2(Math.Clamp(amount, 0, baseAmount));
    }

    private static decimal PromoDiscount(PromoCode promo, decimal itemsSubtotal)
        => DiscountFrom(itemsSubtotal, promo.DiscountType, promo.DiscountValue);

    // Скидка комбо — только от суммы товаров набора; null, если в заказе нет всех товаров набора.
    private static decimal? ComboDiscount(ComboOffer combo, IReadOnlyCollection<(Guid ProductId, decimal SubTotal)> items)
    {
        var comboProductIds = ParseGuids(combo.ProductIdsJson);
        if (comboProductIds.Count == 0 || !comboProductIds.All(id => items.Any(i => i.ProductId == id)))
            return null;

        var comboBase = items.Where(i => comboProductIds.Contains(i.ProductId)).Sum(i => i.SubTotal);
        return DiscountFrom(comboBase, combo.DiscountType, combo.DiscountValue);
    }

    // Цена позиции с учётом скидки за количество (C3).
    private static void PriceItem(OrderItem item, decimal variantPrice, string? quantityTiersJson)
    {
        item.UnitPrice = QuantityTiers.UnitPrice(variantPrice, quantityTiersJson, item.Quantity);
        item.SubTotal = Round2(item.UnitPrice * item.Quantity);
    }

    private async Task<string> GenerateOrderNumberAsync()
    {
        // Дата в номере — по времени магазина (Душанбе), а не UTC.
        var date = ShopClock.LocalNow;
        for (var attempt = 0; attempt < 5; attempt++)
        {
            var candidate = $"ST-{date:yyyyMMdd}-{Guid.NewGuid().ToString("N")[..6].ToUpperInvariant()}";

            if (!await _orderRepository.IsOrderNumberTakenAsync(candidate))
                return candidate;
        }

        throw new InvalidOperationException("Could not generate a unique order number");
    }

    // One coin is worth one currency unit, matching the 5% cashback in CoinsEarnRate.
    internal static decimal ComputePayable(Order order)
        => Math.Max(0, order.TotalAmount - order.DiscountAmount - order.CoinsUsed + order.DeliveryCost);

    // База кэшбэка: товары − скидка − списанные монеты, без доставки (C9).
    private static decimal CashbackBase(Order order)
        => Math.Max(0, order.TotalAmount - order.DiscountAmount - order.CoinsUsed);

    /// <summary>
    /// Статус оплаты по принятой сумме (C7): ничего не оплачено — «Ожидает» (ручной «Неуспешно» сохраняется),
    /// часть — «Частично», всё (или платить нечего) — «Оплачен». Отмеченный возврат не трогаем.
    /// </summary>
    internal static void RecalcPaymentStatus(Order order)
    {
        if (order.PaymentStatus == PaymentStatus.Refunded)
            return;

        var payable = ComputePayable(order);

        // Старые заказы, отмеченные «Оплачен» вручную до учёта PaidAmount, не сбрасываем.
        if (order.PaymentStatus == PaymentStatus.Paid && order.PaidAmount == 0 && payable > 0)
            return;

        if (order.PaidAmount > 0 || payable == 0)
            order.PaymentStatus = order.PaidAmount >= payable ? PaymentStatus.Paid : PaymentStatus.PartiallyPaid;
        else if (order.PaymentStatus != PaymentStatus.Failed)
            order.PaymentStatus = PaymentStatus.Pending;
    }

    private static OrderItemResponseDto ToItemResponseDto(OrderItem item, Order order) => new()
    {
        Id = item.Id,
        OrderId = order.Id,
        ProductVariantId = item.ProductVariantId,
        Quantity = item.Quantity,
        UnitPrice = item.UnitPrice,
        SubTotal = item.SubTotal,
        OrderTotalAmount = order.TotalAmount,
        OrderPayableAmount = ComputePayable(order)
    };

    private static GetOrderDto ToDto(Order order)
    {
        var dto = ToDtoCore(order);
        // Оплата переводом: предоплата округляется вверх до целого сомони; «Оплачен» — ничего не осталось.
        var payable = dto.PayableAmount;
        var cancelled = order.Status == OrderStatus.Cancelled;
        var prepayment = order.PrepaymentPercent > 0 ? Math.Ceiling(payable * order.PrepaymentPercent / 100m) : 0;
        var remaining = cancelled || order.PaymentStatus is PaymentStatus.Paid or PaymentStatus.Refunded
            ? 0
            : Math.Max(0, payable - order.PaidAmount);
        dto.PrepaymentPercent = order.PrepaymentPercent;
        dto.PrepaymentAmount = Math.Min(prepayment, payable);
        dto.PaidAmount = order.PaidAmount;
        dto.RemainingAmount = remaining;
        dto.DueNowAmount = Math.Min(remaining, Math.Max(0, dto.PrepaymentAmount - order.PaidAmount));
        dto.HasPendingPaymentProof = order.HasPendingPaymentProof;
        dto.CanCustomerEdit = CustomerMayEdit(order);
        dto.OverpaidAmount = !cancelled && order.PaymentStatus != PaymentStatus.Refunded
            ? Math.Max(0, order.PaidAmount - payable)
            : 0;
        dto.RefundDueAmount = cancelled && order.PaidAmount > 0 && order.PaymentStatus != PaymentStatus.Refunded
            ? order.PaidAmount
            : 0;
        return dto;
    }

    private static GetOrderDto ToDtoCore(Order order) => new()
    {
        Id = order.Id,
        HasClientChanges = order.HasClientChanges,
        OrderNumber = order.OrderNumber,
        UserId = order.UserId,
        Status = order.Status,
        TotalAmount = order.TotalAmount,
        DiscountAmount = order.DiscountAmount,
        DeliveryCost = order.DeliveryCost,
        PayableAmount = ComputePayable(order),
        PromoCodeId = order.PromoCodeId,
        ComboOfferId = order.ComboOfferId,
        DeliveryCityId = order.DeliveryCityId,
        DeliveryAddress = order.DeliveryAddress,
        ContactName = order.ContactName,
        ContactPhone = order.ContactPhone,
        ContactEmail = order.ContactEmail,
        PaymentMethod = order.PaymentMethod,
        PaymentStatus = order.PaymentStatus,
        Source = order.Source,
        CoinsEarned = order.CoinsEarned,
        CoinsUsed = order.CoinsUsed,
        CreatedAt = order.CreatedAt,
        UpdatedAt = order.UpdatedAt,
        Items = order.Items.Select(i => new OrderItemDto
        {
            Id = i.Id,
            ProductVariantId = i.ProductVariantId,
            ProductId = i.ProductVariant.ProductId,
            ProductNameEn = i.ProductVariant.Product.NameEn,
            ProductNameRu = i.ProductVariant.Product.NameRu,
            SKU = i.ProductVariant.SKU,
            Quantity = i.Quantity,
            UnitPrice = i.UnitPrice,
            SubTotal = i.SubTotal
        }).ToList()
    };
}
