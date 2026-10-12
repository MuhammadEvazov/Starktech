using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Domain.Entities;

namespace Infrastructure.Configuration;

public class PromoCodeConfiguration : IEntityTypeConfiguration<PromoCode>
{
    public void Configure(EntityTypeBuilder<PromoCode> builder)
    {
        builder.HasIndex(x => x.Code).IsUnique();
        builder.Property(x => x.Code).HasMaxLength(50);
        builder.Property(x => x.DiscountValue).HasColumnType("decimal(18,2)");

        builder.HasMany(x => x.Orders)
            .WithOne(x => x.PromoCode)
            .HasForeignKey(x => x.PromoCodeId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}