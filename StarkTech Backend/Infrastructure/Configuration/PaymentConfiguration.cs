using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Configurations;

public class PaymentSettingsConfiguration : IEntityTypeConfiguration<PaymentSettings>
{
    public void Configure(EntityTypeBuilder<PaymentSettings> builder)
    {
        builder.ToTable(t => t.HasCheckConstraint(
            "CK_PaymentSettings_PrepaymentPercent", "\"PrepaymentPercent\" BETWEEN 0 AND 100"));
        builder.Property(x => x.KortiMilliCard).HasMaxLength(40);
        builder.Property(x => x.KortiMilliHolder).HasMaxLength(120);
        builder.Property(x => x.AlifPayPhone).HasMaxLength(40);
        builder.Property(x => x.AlifPayHolder).HasMaxLength(120);
        builder.Property(x => x.CardTransferNumber).HasMaxLength(40);
        builder.Property(x => x.CardTransferHolder).HasMaxLength(120);
        builder.Property(x => x.CardTransferBank).HasMaxLength(120);
        builder.Property(x => x.Instructions).HasMaxLength(1000);
    }
}

public class OrderPaymentProofConfiguration : IEntityTypeConfiguration<OrderPaymentProof>
{
    public void Configure(EntityTypeBuilder<OrderPaymentProof> builder)
    {
        builder.Property(x => x.ImageUrl).HasMaxLength(1000).IsRequired();
        builder.Property(x => x.Amount).HasColumnType("decimal(18,2)");
        builder.Property(x => x.ApprovedAmount).HasColumnType("decimal(18,2)");
        builder.Property(x => x.Comment).HasMaxLength(500);
        builder.Property(x => x.RejectReason).HasMaxLength(300);
        builder.Property(x => x.ReviewedBy).HasMaxLength(200);
        builder.HasIndex(x => new { x.OrderId, x.CreatedAt });
        // Очередь чеков «на проверке» — частичный индекс только по Pending (= 0).
        builder.HasIndex(x => x.CreatedAt)
            .HasDatabaseName("IX_OrderPaymentProof_Pending")
            .HasFilter("\"Status\" = 0");

        builder.HasOne(x => x.Order)
            .WithMany(o => o.PaymentProofs)
            .HasForeignKey(x => x.OrderId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
