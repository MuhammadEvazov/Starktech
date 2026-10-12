using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Domain.Entities;

namespace Infrastructure.Configurations;

public class CoinsTransactionConfiguration : IEntityTypeConfiguration<CoinsTransaction>
{
    public void Configure(EntityTypeBuilder<CoinsTransaction> builder)
    {
        builder.Property(x => x.Description).HasMaxLength(500);
    }
}