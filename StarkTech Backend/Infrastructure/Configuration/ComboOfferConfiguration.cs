using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Domain.Entities;

namespace Infrastructure.Configurations;

public class ComboOfferConfiguration : IEntityTypeConfiguration<ComboOffer>
{
    public void Configure(EntityTypeBuilder<ComboOffer> builder)
    {
        builder.ToTable(t =>
            t.HasCheckConstraint("CK_ComboOffers_DiscountValue_NonNegative", "\"DiscountValue\" >= 0"));

        builder.Property(x => x.DiscountValue).HasColumnType("decimal(18,2)");
        builder.Property(x => x.ProductIdsJson).HasColumnType("jsonb");

        builder.HasMany(x => x.Orders)
            .WithOne(x => x.ComboOffer)
            .HasForeignKey(x => x.ComboOfferId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}