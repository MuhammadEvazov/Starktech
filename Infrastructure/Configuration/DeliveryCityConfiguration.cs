using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Domain.Entities;

namespace Infrastructure.Configurations;

public class DeliveryCityConfiguration : IEntityTypeConfiguration<DeliveryCity>
{
    public void Configure(EntityTypeBuilder<DeliveryCity> builder)
    {
        builder.Property(x => x.DeliveryCost).HasColumnType("decimal(18,2)");
        builder.Property(x => x.NameRu).HasMaxLength(100);
        builder.Property(x => x.NameTj).HasMaxLength(100);
        builder.Property(x => x.NameEn).HasMaxLength(100);
    }
}