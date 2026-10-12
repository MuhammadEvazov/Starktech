using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Configurations;

public class ProductConfiguration : IEntityTypeConfiguration<Product>
{
    public void Configure(EntityTypeBuilder<Product> builder)
    {
        builder.Property(x => x.BasePrice).HasColumnType("decimal(18,2)");
        builder.Property(x => x.NameRu).HasMaxLength(200);
        builder.Property(x => x.NameTj).HasMaxLength(200);
        builder.Property(x => x.NameEn).HasMaxLength(200);

        builder.HasMany(x => x.Variants)
            .WithOne(x => x.Product)
            .HasForeignKey(x => x.ProductId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(x => x.Reviews)
            .WithOne(x => x.Product)
            .HasForeignKey(x => x.ProductId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}