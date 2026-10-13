using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Domain.Entities;

namespace Infrastructure.Configurations;

public class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> builder)
    {
        builder.HasIndex(x => x.Email).IsUnique();
        builder.HasIndex(x => x.AppUserId).IsUnique();

        builder.Property(x => x.AppUserId).IsRequired();
        builder.Property(x => x.FullName).HasMaxLength(200);
        builder.Property(x => x.Email).HasMaxLength(200);
        builder.Property(x => x.PhoneNumber).HasMaxLength(30);

        builder.HasMany(x => x.Orders)
            .WithOne(x => x.User)
            .HasForeignKey(x => x.UserId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasMany(x => x.Reviews)
            .WithOne(x => x.User)
            .HasForeignKey(x => x.UserId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasMany(x => x.CoinsTransactions)
            .WithOne(x => x.User)
            .HasForeignKey(x => x.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        // Город доставки по умолчанию: удаление города обнуляет ссылку у клиентов
        builder.HasOne<DeliveryCity>()
            .WithMany()
            .HasForeignKey(x => x.DefaultDeliveryCityId)
            .OnDelete(DeleteBehavior.SetNull);
        builder.HasIndex(x => x.DefaultDeliveryCityId);

        builder.HasOne(x => x.TelegramBinding)
            .WithOne(x => x.User)
            .HasForeignKey<AdminTelegramBinding>(x => x.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}