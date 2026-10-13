using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Domain.Entities;

namespace Infrastructure.Configuration;

public class OrderConfiguration : IEntityTypeConfiguration<Order>
{
    public void Configure(EntityTypeBuilder<Order> builder)
    {
        builder.HasIndex(x => x.OrderNumber).IsUnique();
        // Личный кабинет (заказы клиента по дате), списки админки по статусу и фильтр по оплате.
        builder.HasIndex(x => new { x.UserId, x.CreatedAt });
        builder.HasIndex(x => new { x.Status, x.CreatedAt });
        builder.HasIndex(x => x.PaymentStatus);
        builder.Property(x => x.OrderNumber).HasMaxLength(30);
        builder.Property(x => x.TotalAmount).HasColumnType("decimal(18,2)");
        builder.Property(x => x.DiscountAmount).HasColumnType("decimal(18,2)");
        builder.Property(x => x.DeliveryCost).HasColumnType("decimal(18,2)");
        builder.Property(x => x.PaidAmount).HasColumnType("decimal(18,2)");
        builder.Property(x => x.ContactName).HasMaxLength(200);
        builder.Property(x => x.ContactPhone).HasMaxLength(30);
        builder.Property(x => x.ContactEmail).HasMaxLength(200);
        builder.Property(x => x.DeliveryAddress).HasMaxLength(500);

        builder.HasOne(x => x.DeliveryCity)
            .WithMany(x => x.Orders)
            .HasForeignKey(x => x.DeliveryCityId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasMany(x => x.Items)
            .WithOne(x => x.Order)
            .HasForeignKey(x => x.OrderId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(x => x.Reviews)
            .WithOne(x => x.Order)
            .HasForeignKey(x => x.OrderId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasMany(x => x.CoinsTransactions)
            .WithOne(x => x.Order)
            .HasForeignKey(x => x.OrderId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasMany(x => x.Notifications)
            .WithOne(x => x.Order)
            .HasForeignKey(x => x.OrderId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}