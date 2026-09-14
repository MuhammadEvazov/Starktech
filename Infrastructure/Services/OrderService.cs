using Application.DTOs.Order;
using Application.Interfaces.Repositories;
using Application.Interfaces.Services;
using Application.Result;
using Application.Results;
using Domain.Entities;
using Domain.Enums;
using Microsoft.Extensions.Logging;

namespace Infrastructure.Services;

public class OrderService : IOrderService
{
    private readonly IOrderRepository _orderRepository;
    private readonly IOrderItemRepository _orderItemRepository;
    private readonly IProductVariantRepository _variantRepository;
    private readonly IDeliveryCityRepository _deliveryCityRepository;
    private readonly IPromoCodeRepository _promoCodeRepository;
    private readonly IComboOfferRepository _comboOfferRepository;
    private readonly IUserRepository _userRepository;
    private readonly ICoinsTransactionService _coinsTransactionService;
    private readonly INotificationService _notificationService;
    private readonly IUnitOfWork _unitOfWork;
    private readonly ILogger<OrderService> _logger;

    private const decimal CoinsEarnRate = 0.05m;

    // Cancellation is intentionally absent: it goes through CancelAsync so coins and promo usage are returned.
    private static readonly Dictionary<OrderStatus, OrderStatus> NextStatus = new()
    {
        [OrderStatus.New] = OrderStatus.Confirmed,
        [OrderStatus.Confirmed] = OrderStatus.InProduction,
        [OrderStatus.InProduction] = OrderStatus.ReadyForDelivery,
        [OrderStatus.ReadyForDelivery] = OrderStatus.Delivered
    };

    public OrderService(
        IOrderRepository orderRepository,
        IOrderItemRepository orderItemRepository,
        IProductVariantRepository variantRepository,
        IDeliveryCityRepository deliveryCityRepository,
        IPromoCodeRepository promoCodeRepository,
        IComboOfferRepository comboOfferRepository,
        IUserRepository userRepository,
        ICoinsTransactionService coinsTransactionService,
        INotificationService notificationService,
        IUnitOfWork unitOfWork,
        ILogger<OrderService> logger)
    {
        _orderRepository = orderRepository;
        _orderItemRepository = orderItemRepository;
        _variantRepository = variantRepository;
        _deliveryCityRepository = deliveryCityRepository;
        _promoCodeRepository = promoCodeRepository;
        _comboOfferRepository = comboOfferRepository;
        _userRepository = userRepository;
        _coinsTransactionService = coinsTransactionService;
        _notificationService = notificationService;
        _unitOfWork = unitOfWork;
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

        Order? createdOrder = null;

        var result = await _unitOfWork.ExecuteInTransactionAsync(async () =>
        {
            if (dto.UserId.HasValue && !await _userRepository.ExistsAsync(dto.UserId.Value))
                return Result<CreateOrderResponseDto>.Fail("User not found", ErrorType.NotFound);

            decimal deliveryCost = 0;
            if (dto.DeliveryCityId.HasValue)
            {
                var city = await _deliveryCityRepository.GetByIdAsync(dto.DeliveryCityId.Value);
                if (city == null)
                    return Result<CreateOrderResponseDto>.Fail("Delivery city not found", ErrorType.NotFound);

                deliveryCost = city.DeliveryCost;
            }

            var orderItems = new List<OrderItem>();

            foreach (var itemDto in dto.Items)
            {
                if (itemDto.Quantity <= 0)
                    return Result<CreateOrderResponseDto>.Fail("Item quantity must be greater than zero", ErrorType.Validation);

                var variant = await _variantRepository.GetByIdAsync(itemDto.ProductVariantId);
                if (variant == null)
                    return Result<CreateOrderResponseDto>.Fail($"Product variant {itemDto.ProductVariantId} not found", ErrorType.NotFound);

                if (!variant.IsActive)
                    return Result<CreateOrderResponseDto>.Fail($"Product variant {itemDto.ProductVariantId} is not active", ErrorType.Validation);

                orderItems.Add(new OrderItem
                {
                    ProductVariantId = variant.Id,
                    Quantity = itemDto.Quantity,
                    UnitPrice = variant.Price,
                    SubTotal = variant.Price * itemDto.Quantity
                });
            }

            var itemsSubtotal = orderItems.Sum(i => i.SubTotal);
            var now = DateTime.UtcNow;
            decimal discountAmount = 0;

            if (dto.PromoCodeId.HasValue)
            {
                var promo = await _promoCodeRepository.GetByIdAsync(dto.PromoCodeId.Value);
                if (promo == null)
                    return Result<CreateOrderResponseDto>.Fail("Promo code not found", ErrorType.NotFound);

                if (!promo.IsActive
                    || (promo.ValidFrom.HasValue && now < promo.ValidFrom.Value)
                    || (promo.ValidTo.HasValue && now > promo.ValidTo.Value))
                    return Result<CreateOrderResponseDto>.Fail("Promo code is not valid", ErrorType.Validation);

                if (!await _promoCodeRepository.TryIncrementUsageAsync(promo.Id))
                    return Result<CreateOrderResponseDto>.Fail("Promo code usage limit has been reached", ErrorType.Validation);

                discountAmount += ApplyDiscount(itemsSubtotal, promo.DiscountType, promo.DiscountValue);
            }

            if (dto.ComboOfferId.HasValue)
            {
                var combo = await _comboOfferRepository.GetByIdAsync(dto.ComboOfferId.Value);
                if (combo == null)
                    return Result<CreateOrderResponseDto>.Fail("Combo offer not found", ErrorType.NotFound);

                if (!combo.IsActive
                    || (combo.ValidFrom.HasValue && now < combo.ValidFrom.Value)
                    || (combo.ValidTo.HasValue && now > combo.ValidTo.Value))
                    return Result<CreateOrderResponseDto>.Fail("Combo offer is not valid", ErrorType.Validation);

                discountAmount += ApplyDiscount(itemsSubtotal, combo.DiscountType, combo.DiscountValue);
            }

            discountAmount = Math.Min(discountAmount, itemsSubtotal);

            if (dto.CoinsUsed > itemsSubtotal - discountAmount)
                return Result<CreateOrderResponseDto>.Fail("Coins used cannot exceed the order amount after discounts", ErrorType.Validation);

            var order = new Order
            {
                OrderNumber = await GenerateOrderNumberAsync(),
                UserId = dto.UserId,
                Status = OrderStatus.New,
                TotalAmount = itemsSubtotal,
                DiscountAmount = discountAmount,
                PromoCodeId = dto.PromoCodeId,
                ComboOfferId = dto.ComboOfferId,
                DeliveryCityId = dto.DeliveryCityId,
                DeliveryAddress = dto.DeliveryAddress,
                DeliveryCost = deliveryCost,
                ContactName = dto.ContactName,
                ContactPhone = dto.ContactPhone,
                ContactEmail = dto.ContactEmail,
                PaymentMethod = dto.PaymentMethod,
                PaymentStatus = PaymentStatus.Pending,
                Source = dto.Source,
                CoinsUsed = dto.CoinsUsed,
                Items = orderItems
            };

            await _orderRepository.AddAsync(order);

            if (dto.CoinsUsed > 0)
            {
                var redeemResult = await _coinsTransactionService.RedeemAsync(
                    dto.UserId!.Value,
                    dto.CoinsUsed,
                    order.Id,
                    $"Used on order {order.OrderNumber}");

                if (!redeemResult.IsSuccess)
                    return Result<CreateOrderResponseDto>.Fail(redeemResult.Errors, redeemResult.ErrorType);
            }

            createdOrder = order;

            return Result<CreateOrderResponseDto>.Ok(new CreateOrderResponseDto
            {
                Id = order.Id,
                OrderNumber = order.OrderNumber,
                Status = order.Status,
                TotalAmount = order.TotalAmount,
                DiscountAmount = order.DiscountAmount,
                DeliveryCost = order.DeliveryCost,
                PayableAmount = ComputePayable(order)
            });
        });

        if (result.IsSuccess && createdOrder != null)
        {
            _logger.LogInformation("Order created with ID: {Id}, Number: {Number}", createdOrder.Id, createdOrder.OrderNumber);
            await NotifyStatusAsync(createdOrder);
        }

        return result;
    }

    public async Task<Result<GetOrderDto>> UpdateStatusAsync(Guid id, UpdateOrderStatusDto dto)
    {
        if (dto.Status == OrderStatus.Cancelled)
            return Result<GetOrderDto>.Fail("Use the cancel endpoint to cancel an order", ErrorType.Validation);

        Order? orderWithNewStatus = null;

        var result = await _unitOfWork.ExecuteInTransactionAsync(async () =>
        {
            await _orderRepository.LockForUpdateAsync(id);

            var order = await _orderRepository.GetByIdTrackedAsync(id);
            if (order == null)
                return Result<GetOrderDto>.Fail("Order not found", ErrorType.NotFound);

            var statusChanges = order.Status != dto.Status;

            if (statusChanges && !IsTransitionAllowed(order.Status, dto.Status))
                return Result<GetOrderDto>.Fail($"Cannot change order status from {order.Status} to {dto.Status}", ErrorType.Validation);

            order.Status = dto.Status;

            if (dto.PaymentStatus.HasValue)
                order.PaymentStatus = dto.PaymentStatus.Value;

            var earnsCoins = statusChanges && order.Status == OrderStatus.Delivered && order.UserId.HasValue;
            if (earnsCoins)
                order.CoinsEarned = (int)Math.Floor(ComputePayable(order) * CoinsEarnRate);

            await _orderRepository.UpdateAsync(order);

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

            if (order.Status == OrderStatus.Delivered)
                return Result<bool>.Fail("Cannot cancel a delivered order", ErrorType.Validation);

            order.Status = OrderStatus.Cancelled;
            await _orderRepository.UpdateAsync(order);

            if (order.CoinsUsed > 0 && order.UserId.HasValue)
            {
                var refundResult = await _coinsTransactionService.EarnAsync(
                    order.UserId.Value,
                    order.CoinsUsed,
                    order.Id,
                    $"Refund for cancelled order {order.OrderNumber}");

                if (!refundResult.IsSuccess)
                    return Result<bool>.Fail(refundResult.Errors, refundResult.ErrorType);
            }

            if (order.PromoCodeId.HasValue)
                await _promoCodeRepository.DecrementUsageAsync(order.PromoCodeId.Value);

            cancelledOrder = order;

            return Result<bool>.Ok(true);
        });

        if (result.IsSuccess && cancelledOrder != null)
            await NotifyStatusAsync(cancelledOrder);

        return result;
    }

    public Task<Result<OrderItemResponseDto>> AddItemAsync(Guid orderId, AddOrderItemDto dto)
    {
        if (dto.Quantity <= 0)
            return Task.FromResult(Result<OrderItemResponseDto>.Fail("Item quantity must be greater than zero", ErrorType.Validation));

        return _unitOfWork.ExecuteInTransactionAsync(async () =>
        {
            await _orderRepository.LockForUpdateAsync(orderId);

            var order = await _orderRepository.GetByIdTrackedAsync(orderId);
            if (order == null)
                return Result<OrderItemResponseDto>.Fail("Order not found", ErrorType.NotFound);

            if (order.Status != OrderStatus.New)
                return Result<OrderItemResponseDto>.Fail("Items can only be added while the order is New", ErrorType.Validation);

            var variant = await _variantRepository.GetByIdAsync(dto.ProductVariantId);
            if (variant == null)
                return Result<OrderItemResponseDto>.Fail("Product variant not found", ErrorType.NotFound);

            if (!variant.IsActive)
                return Result<OrderItemResponseDto>.Fail("Product variant is not active", ErrorType.Validation);

            var newItem = new OrderItem
            {
                OrderId = order.Id,
                ProductVariantId = variant.Id,
                Quantity = dto.Quantity,
                UnitPrice = variant.Price,
                SubTotal = variant.Price * dto.Quantity
            };

            await _orderItemRepository.AddAsync(newItem);

            order.TotalAmount += newItem.SubTotal;
            await _orderRepository.UpdateAsync(order);

            return Result<OrderItemResponseDto>.Ok(ToItemResponseDto(newItem, order));
        });
    }

    public Task<Result<OrderItemResponseDto>> UpdateItemQuantityAsync(Guid orderId, Guid itemId, UpdateOrderItemDto dto)
    {
        if (dto.Quantity <= 0)
            return Task.FromResult(Result<OrderItemResponseDto>.Fail("Item quantity must be greater than zero", ErrorType.Validation));

        return _unitOfWork.ExecuteInTransactionAsync(async () =>
        {
            await _orderRepository.LockForUpdateAsync(orderId);

            var order = await _orderRepository.GetByIdTrackedAsync(orderId);
            if (order == null)
                return Result<OrderItemResponseDto>.Fail("Order not found", ErrorType.NotFound);

            if (order.Status != OrderStatus.New)
                return Result<OrderItemResponseDto>.Fail("Items can only be changed while the order is New", ErrorType.Validation);

            var item = order.Items.FirstOrDefault(i => i.Id == itemId);
            if (item == null)
                return Result<OrderItemResponseDto>.Fail("Order item not found", ErrorType.NotFound);

            var oldSubTotal = item.SubTotal;

            item.Quantity = dto.Quantity;
            item.SubTotal = item.UnitPrice * dto.Quantity;
            order.TotalAmount += item.SubTotal - oldSubTotal;

            if (order.TotalAmount < order.DiscountAmount + order.CoinsUsed)
                return Result<OrderItemResponseDto>.Fail("Order total cannot drop below the discount and coins already applied", ErrorType.Validation);

            await _orderRepository.UpdateAsync(order);

            return Result<OrderItemResponseDto>.Ok(ToItemResponseDto(item, order));
        });
    }

    public Task<Result<bool>> RemoveItemAsync(Guid orderId, Guid itemId)
    {
        return _unitOfWork.ExecuteInTransactionAsync(async () =>
        {
            await _orderRepository.LockForUpdateAsync(orderId);

            var order = await _orderRepository.GetByIdTrackedAsync(orderId);
            if (order == null)
                return Result<bool>.Fail("Order not found", ErrorType.NotFound);

            if (order.Status != OrderStatus.New)
                return Result<bool>.Fail("Items can only be removed while the order is New", ErrorType.Validation);

            var item = order.Items.FirstOrDefault(i => i.Id == itemId);
            if (item == null)
                return Result<bool>.Fail("Order item not found", ErrorType.NotFound);

            if (order.Items.Count <= 1)
                return Result<bool>.Fail("Order must have at least one item", ErrorType.Validation);

            if (order.TotalAmount - item.SubTotal < order.DiscountAmount + order.CoinsUsed)
                return Result<bool>.Fail("Order total cannot drop below the discount and coins already applied", ErrorType.Validation);

            await _orderItemRepository.DeleteAsync(item);

            order.TotalAmount -= item.SubTotal;
            await _orderRepository.UpdateAsync(order);

            return Result<bool>.Ok(true);
        });
    }

    private static bool IsTransitionAllowed(OrderStatus current, OrderStatus requested)
        => NextStatus.TryGetValue(current, out var next) && next == requested;

    private Task NotifyStatusAsync(Order order)
        => _notificationService.NotifyOrderStatusChangeAsync(order.Id, order.OrderNumber, order.Status, order.ContactEmail);

    private static decimal ApplyDiscount(decimal baseAmount, DiscountType type, decimal value)
    {
        return type == DiscountType.Percent
            ? baseAmount * (value / 100m)
            : value;
    }

    private async Task<string> GenerateOrderNumberAsync()
    {
        for (var attempt = 0; attempt < 5; attempt++)
        {
            var candidate = $"ST-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString("N")[..6].ToUpperInvariant()}";

            if (!await _orderRepository.IsOrderNumberTakenAsync(candidate))
                return candidate;
        }

        throw new InvalidOperationException("Could not generate a unique order number");
    }

    // One coin is worth one currency unit, matching the 5% cashback in CoinsEarnRate.
    private static decimal ComputePayable(Order order)
        => Math.Max(0, order.TotalAmount - order.DiscountAmount - order.CoinsUsed + order.DeliveryCost);

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

    private static GetOrderDto ToDto(Order order) => new()
    {
        Id = order.Id,
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
            SKU = i.ProductVariant.SKU,
            Quantity = i.Quantity,
            UnitPrice = i.UnitPrice,
            SubTotal = i.SubTotal
        }).ToList()
    };
}
