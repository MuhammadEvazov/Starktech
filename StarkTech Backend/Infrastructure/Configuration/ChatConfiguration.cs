using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Configurations;

public class ChatConversationConfiguration : IEntityTypeConfiguration<ChatConversation>
{
    public void Configure(EntityTypeBuilder<ChatConversation> builder)
    {
        builder.HasIndex(x => x.CustomerId).IsUnique();
        builder.HasIndex(x => x.LastMessageAt);
        builder.Property(x => x.LastMessagePreview).HasMaxLength(200);

        builder.HasOne(x => x.Customer)
            .WithMany()
            .HasForeignKey(x => x.CustomerId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public class ChatMessageConfiguration : IEntityTypeConfiguration<ChatMessage>
{
    public void Configure(EntityTypeBuilder<ChatMessage> builder)
    {
        builder.Property(x => x.Text).HasMaxLength(4000);
        builder.Property(x => x.SenderName).HasMaxLength(100).IsRequired();
        builder.Property(x => x.AttachmentUrl).HasMaxLength(1000);
        builder.HasIndex(x => new { x.ConversationId, x.CreatedAt });

        builder.HasOne(x => x.Conversation)
            .WithMany(c => c.Messages)
            .HasForeignKey(x => x.ConversationId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(x => x.ReplyTo)
            .WithMany()
            .HasForeignKey(x => x.ReplyToId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
