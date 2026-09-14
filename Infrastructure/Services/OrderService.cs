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
    private readonly ILogger<OrderService> _logger;

    private const decimal CoinsEarnRate = 0.05m;

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
        _logger = logger;
    }

    public async Task<Result<PageResult<GetOrderDto>>> GetAllAsync(GetOrderFilterDto filter)
    {
        var orders = await _orderRepository.GetAllAsync(filter);

        var items = orders.Items.Select(ToDto).ToList();

        var pageResult = new PageResult<GetOrderDto>(
            items,
            orders.TotalCount,
            orders.Page,
            orders.PageSize);

        return Result<PageResult<GetOrderDto>>.Ok(pageResult);
    }

    public async Task<Result<GetOrderDto>> GetByIdAsync(Guid id)
    {
        var order = await _orderRepository.GetByIdAsync(id);
        if (order == null)
            return Result<GetOrderDto>.Fail("Order not found", ErrorType.NotFound);

        return Result<GetOrderDto>.Ok(ToDto(order));
    }

    public async Task<Result<CreateOrderResponseDto>> CreateAsync(CreateOrderDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.ContactName) || string.IsNullOrWhiteSpace(dto.ContactPhone))
            return Result<CreateOrderResponseDto>.Fail("Contact name and phone are required", ErrorType.Validation);

        if (dto.Items.Count == 0)
            return Result<CreateOrderResponseDto>.Fail("Order must contain at least one item", ErrorType.Validation);

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
                || (promo.ValidTo.HasValue && now > promo.ValidTo.Value)
                || (promo.MaxUsages.HasValue && promo.UsedCount >= promo.MaxUsages.Value))
                return Result<CreateOrderResponseDto>.Fail("Promo code is not valid", ErrorType.Validation);

            discountAmount += ApplyDiscount(itemsSubtotal, promo.DiscountType, promo.DiscountValue);

            promo.UsedCount += 1;
            await _promoCodeRepository.UpdateAsync(promo);
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

        if (dto.CoinsUsed < 0)
            return Result<CreateOrderResponseDto>.Fail("Coins used cannot be negative", ErrorType.Validation);

        if (dto.CoinsUsed > 0)
        {
            if (!dto.UserId.HasValue)
                return Result<CreateOrderResponseDto>.Fail("Coins can only be used by a registered user", ErrorType.Validation);

            var user = await _userRepository.GetByGuidIdAsync(dto.UserId.Value);
            if (user == null)
                return Result<CreateOrderResponseDto>.Fail("User not found", ErrorType.NotFound);

            if (user.CoinsBalance < dto.CoinsUsed)
                return Result<CreateOrderResponseDto>.Fail("Insufficient coins balance", ErrorType.Validation);
        }

        var orderNumber = await GenerateOrderNumberAsync();

        var order = new Order
        {
            OrderNumber = orderNumber,
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

        _logger.LogInformation("Order created with ID: {Id}, Number: {Number}", order.Id, order.OrderNumber);

        if (dto.CoinsUsed > 0 && dto.UserId.HasValue)
        {
            var redeemResult = await _coinsTransactionService.RedeemAsync(
                dto.UserId.Value,
                dto.CoinsUsed,
                order.Id,
                $"Used on order {order.OrderNumber}");

            if (!redeemResult.IsSuccess)
                _logger.LogWarning("Failed to redeem coins for order {OrderId}: {Errors}", order.Id, string.Join(", ", redeemResult.Errors));
        }

        await _notificationService.NotifyOrderStatusChangeAsync(order.Id, order.OrderNumber, order.Status, order.ContactEmail);

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
    }

    public async Task<Result<GetOrderDto>> UpdateStatusAsync(Guid id, UpdateOrderStatusDto dto)
    {
        var order = await _orderRepository.GetByIdTrackedAsync(id);
        if (order == null)
            return Result<GetOrderDto>.Fail("Order not found", ErrorType.NotFound);

        if (order.Status == OrderStatus.Cancelled)
            return Result<GetOrderDto>.Fail("Cannot change status of a cancelled order", ErrorType.Validation);

        if (order.Status == OrderStatus.Delivered && dto.Status != OrderStatus.Delivered)
            return Result<GetOrderDto>.Fail("Cannot change status of a delivered order", ErrorType.Validation);

        var wasDelivered = order.Status == OrderStatus.Delivered;

        order.Status = dto.Status;

        if (dto.PaymentStatus.HasValue)
            order.PaymentStatus = dto.PaymentStatus.Value;

        var justDelivered = !wasDelivered && order.Status == OrderStatus.Delivered && order.UserId.HasValue;

        if (justDelivered)
            order.CoinsEarned = (int)Math.Floor(ComputePayable(order) * CoinsEarnRate);

        await _orderRepository.UpdateAsync(order);

        if (justDelivered && order.CoinsEarned > 0)
        {
            await _coinsTransactionService.EarnAsync(
                order.UserId!.Value,
                order.CoinsEarned,
                order.Id,
                $"Earned from order {order.OrderNumber}");
        }

        await _notificationService.NotifyOrderStatusChangeAsync(order.Id, order.OrderNumber, order.Status, order.ContactEmail);

        return Result<GetOrderDto>.Ok(ToDto(order));
    }

    public async Task<Result<bool>> CancelAsync(Guid id)
    {
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
            await _coinsTransactionService.EarnAsync(
                order.UserId.Value,
                order.CoinsUsed,
                order.Id,
                $"Refund for cancelled order {order.OrderNumber}");
        }

        if (order.PromoCodeId.HasValue)
        {
            var promo = await _promoCodeRepository.GetByIdAsync(order.PromoCodeId.Value);
            if (promo != null && promo.UsedCount > 0)
            {
                promo.UsedCount -= 1;
                await _promoCodeRepository.UpdateAsync(promo);
            }
        }

        await _notificationService.NotifyOrderStatusChangeAsync(order.Id, order.OrderNumber, order.Status, order.ContactEmail);

        return Result<bool>.Ok(true);
    }

    public async Task<Result<OrderItemResponseDto>> AddItemAsync(Guid orderId, AddOrderItemDto dto)
    {
        var order = await _orderRepository.GetByIdTrackedAsync(orderId);
        if (order == null)
            return Result<OrderItemResponseDto>.Fail("Order not found", ErrorType.NotFound);

        if (order.Status != OrderStatus.New)
            return Result<OrderItemResponseDto>.Fail("Items can only be added while the order is New", ErrorType.Validation);

        if (dto.Quantity <= 0)
            return Result<OrderItemResponseDto>.Fail("Item quantity must be greater than zero", ErrorType.Validation);

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
    }

    public async Task<Result<OrderItemResponseDto>> UpdateItemQuantityAsync(Guid orderId, Guid itemId, UpdateOrderItemDto dto)
    {
        var order = await _orderRepository.GetByIdTrackedAsync(orderId);
        if (order == null)
            return Result<OrderItemResponseDto>.Fail("Order not found", ErrorType.NotFound);

        if (order.Status != OrderStatus.New)
            return Result<OrderItemResponseDto>.Fail("Items can only be changed while the order is New", ErrorType.Validation);

        if (dto.Quantity <= 0)
            return Result<OrderItemResponseDto>.Fail("Item quantity must be greater than zero", ErrorType.Validation);

        var item = await _orderItemRepository.GetByIdAsync(itemId);
        if (item == null || item.OrderId != order.Id)
            return Result<OrderItemResponseDto>.Fail("Order item not found", ErrorType.NotFound);

        var oldSubTotal = item.SubTotal;

        item.Quantity = dto.Quantity;
        item.SubTotal = item.UnitPrice * dto.Quantity;

        await _orderItemRepository.UpdateAsync(item);

        order.TotalAmount += item.SubTotal - oldSubTotal;
        await _orderRepository.UpdateAsync(order);

        return Result<OrderItemResponseDto>.Ok(ToItemResponseDto(item, order));
    }

    public async Task<Result<bool>> RemoveItemAsync(Guid orderId, Guid itemId)
    {
        var order = await _orderRepository.GetByIdTrackedAsync(orderId);
        if (order == null)
            return Result<bool>.Fail("Order not found", ErrorType.NotFound);

        if (order.Status != OrderStatus.New)
            return Result<bool>.Fail("Items can only be removed while the order is New", ErrorType.Validation);

        var item = await _orderItemRepository.GetByIdAsync(itemId);
        if (item == null || item.OrderId != order.Id)
            return Result<bool>.Fail("Order item not found", ErrorType.NotFound);

        if (order.Items.Count <= 1)
            return Result<bool>.Fail("Order must have at least one item", ErrorType.Validation);

        await _orderItemRepository.DeleteAsync(item);

        order.TotalAmount -= item.SubTotal;
        await _orderRepository.UpdateAsync(order);

        return Result<bool>.Ok(true);
    }

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

    private static decimal ComputePayable(Order order)
        => Math.Max(0, order.TotalAmount - order.DiscountAmount + order.DeliveryCost);

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
