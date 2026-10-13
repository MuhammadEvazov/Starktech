using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Domain.Entities;

namespace Infrastructure.Configuration;

public class PromoCodeConfiguration : IEntityTypeConfiguration<PromoCode>
{
    public void Configure(EntityTypeBuilder<PromoCode> builder)
    {
        builder.ToTable(t =>
        {
            t.HasCheckConstraint("CK_PromoCodes_DiscountValue_NonNegative", "\"DiscountValue\" >= 0");
            t.HasCheckConstraint("CK_PromoCodes_MaxUsages_Positive", "\"MaxUsages\" IS NULL OR \"MaxUsages\" >= 1");
            t.HasCheckConstraint("CK_PromoCodes_MaxUsagesPerUser_Positive", "\"MaxUsagesPerUser\" IS NULL OR \"MaxUsagesPerUser\" >= 1");
        });

        // Код хранится в верхнем регистре (PromoCodeService.NormalizeCode) — обычный уникальный индекс
        // даёт уникальность без учёта регистра.
        builder.HasIndex(x => x.Code).IsUnique();
        builder.Property(x => x.Code).HasMaxLength(50);
        builder.Property(x => x.DiscountValue).HasColumnType("decimal(18,2)");

        builder.HasMany(x => x.Orders)
            .WithOne(x => x.PromoCode)
            .HasForeignKey(x => x.PromoCodeId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
