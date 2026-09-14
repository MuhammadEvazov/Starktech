using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Domain.Entities;

namespace Infrastructure.Configurations;

public class PortfolioItemConfiguration : IEntityTypeConfiguration<PortfolioItem>
{
    public void Configure(EntityTypeBuilder<PortfolioItem> builder)
    {
        builder.Property(x => x.ImageUrl).HasMaxLength(1000).IsRequired();
        builder.Property(x => x.DescriptionRu).HasMaxLength(500);
        builder.Property(x => x.DescriptionTj).HasMaxLength(500);
        builder.Property(x => x.DescriptionEn).HasMaxLength(500);
    }
}