using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Configurations;

public class ProductMediaConfiguration : IEntityTypeConfiguration<ProductMedia>
{
    public void Configure(EntityTypeBuilder<ProductMedia> builder)
    {
        builder.Property(x => x.Url).HasMaxLength(500).IsRequired();
        builder.HasIndex(x => new { x.ProductId, x.ProductVariantId, x.SortOrder });

        builder.HasOne(x => x.Product)
            .WithMany()
            .HasForeignKey(x => x.ProductId)
            .OnDelete(DeleteBehavior.Cascade);

        // Удаление варианта убирает и его галерею (файлы чистит сервис).
        builder.HasOne(x => x.ProductVariant)
            .WithMany()
            .HasForeignKey(x => x.ProductVariantId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
