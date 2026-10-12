using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Configurations;

public class ProductVariantConfiguration : IEntityTypeConfiguration<ProductVariant>
{
    public void Configure(EntityTypeBuilder<ProductVariant> builder)
    {
        builder.Property(x => x.Price).HasColumnType("decimal(18,2)");
        builder.Property(x => x.AttributesJson).HasColumnType("jsonb");
        builder.Property(x => x.SKU).HasMaxLength(50);

        builder.HasMany(x => x.OrderItems)
            .WithOne(x => x.ProductVariant)
            .HasForeignKey(x => x.ProductVariantId)
            .OnDelete(DeleteBehavior.Restrict); // нельзя удалить вариант, если по нему есть заказы
    }
}