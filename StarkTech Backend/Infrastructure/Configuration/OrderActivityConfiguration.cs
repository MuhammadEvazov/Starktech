using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Configurations;

public class OrderActivityConfiguration : IEntityTypeConfiguration<OrderActivity>
{
    public void Configure(EntityTypeBuilder<OrderActivity> builder)
    {
        builder.Property(x => x.Message).HasMaxLength(300).IsRequired();
        builder.HasIndex(x => new { x.OrderId, x.CreatedAt });

        builder.HasOne(x => x.Order)
            .WithMany(o => o.Activities)
            .HasForeignKey(x => x.OrderId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
