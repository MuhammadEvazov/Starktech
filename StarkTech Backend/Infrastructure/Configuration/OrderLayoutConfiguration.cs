using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Configurations;

public class OrderLayoutConfiguration : IEntityTypeConfiguration<OrderLayout>
{
    public void Configure(EntityTypeBuilder<OrderLayout> builder)
    {
        builder.Property(x => x.ImageUrl).HasMaxLength(1000).IsRequired();
        builder.Property(x => x.Note).HasMaxLength(500);
        builder.Property(x => x.CustomerComment).HasMaxLength(500);
        builder.Property(x => x.UploadedBy).HasMaxLength(200).IsRequired();
        builder.HasIndex(x => new { x.OrderId, x.CreatedAt });

        // Коллекции у Order нет — связь только со стороны макета.
        builder.HasOne(x => x.Order)
            .WithMany()
            .HasForeignKey(x => x.OrderId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
