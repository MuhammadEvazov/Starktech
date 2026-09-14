using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Configurations;

public class RolePermissionConfiguration : IEntityTypeConfiguration<RolePermission>
{
    public void Configure(EntityTypeBuilder<RolePermission> builder)
    {
        builder.Property(x => x.PermissionKey).HasMaxLength(100).IsRequired();

        builder.HasIndex(x => new { x.Role, x.PermissionKey }).IsUnique();
    }
}