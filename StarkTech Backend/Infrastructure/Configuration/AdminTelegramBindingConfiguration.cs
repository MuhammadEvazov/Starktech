using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Domain.Entities;

namespace Infrastructure.Configuration;

public class AdminTelegramBindingConfiguration : IEntityTypeConfiguration<AdminTelegramBinding>
{
    public void Configure(EntityTypeBuilder<AdminTelegramBinding> builder)
    {
        builder.Property(x => x.TelegramChatId).HasMaxLength(50).IsRequired();
        builder.HasIndex(x => x.TelegramChatId).IsUnique();
    }
}