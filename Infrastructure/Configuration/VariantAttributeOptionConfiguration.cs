using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Configurations;

public class VariantAttributeOptionConfiguration : IEntityTypeConfiguration<VariantAttributeOption>
{
    public void Configure(EntityTypeBuilder<VariantAttributeOption> builder)
    {
        builder.Property(x => x.AttributeKey).HasMaxLength(50).IsRequired();
        builder.Property(x => x.AttributeValue).HasMaxLength(100).IsRequired();
        builder.Property(x => x.PriceModifier).HasColumnType("decimal(18,2)");

        builder.HasIndex(x => new { x.CategoryId, x.AttributeKey, x.AttributeValue }).IsUnique();
    }
}