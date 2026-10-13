using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Domain.Entities;

namespace Infrastructure.Configurations;

public class ReviewConfiguration : IEntityTypeConfiguration<Review>
{
    public void Configure(EntityTypeBuilder<Review> builder)
    {
        builder.Property(x => x.Comment).HasMaxLength(2000);
        // Один отзыв на товар от пользователя
        builder.HasIndex(x => new { x.UserId, x.ProductId }).IsUnique();
        builder.ToTable(t => t.HasCheckConstraint("CK_Review_Rating", "\"Rating\" >= 1 AND \"Rating\" <= 5"));
    }
}