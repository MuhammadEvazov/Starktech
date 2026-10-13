using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Domain.Entities;

namespace Infrastructure.Configurations;

public class OrderItemPhotoConfiguration : IEntityTypeConfiguration<OrderItemPhoto>
{
    public void Configure(EntityTypeBuilder<OrderItemPhoto> builder)
    {
        builder.Property(x => x.OriginalPhotoUrl).HasMaxLength(1000).IsRequired();
        builder.Property(x => x.EditedPreviewUrl).HasMaxLength(1000);
        builder.Property(x => x.CropDataJson).HasColumnType("jsonb");
        // Значение по умолчанию в БД — существующие фото станут «1 копия»
        builder.Property(x => x.Copies).HasDefaultValue(1);
        builder.ToTable(t => t.HasCheckConstraint("CK_OrderItemPhotos_Copies_Positive", "\"Copies\" >= 1"));
    }
}