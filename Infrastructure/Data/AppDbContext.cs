using Domain.Entities;
using Infrastructure.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Data;

public class AppDbContext : IdentityDbContext<AppUser>
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<User> Clients { get; set; } = default!;
    public DbSet<RolePermission> RolePermissions { get; set; } = default!;

    public DbSet<Category> Categories { get; set; } = default!;
    public DbSet<Product> Products { get; set; } = default!;
    public DbSet<ProductVariant> ProductVariants { get; set; } = default!;
    public DbSet<VariantAttributeOption> VariantAttributeOptions { get; set; } = default!;

    public DbSet<ComboOffer> ComboOffers { get; set; } = default!;
    public DbSet<PromoCode> PromoCodes { get; set; } = default!;
    public DbSet<DeliveryCity> DeliveryCities { get; set; } = default!;

    public DbSet<Order> Orders { get; set; } = default!;
    public DbSet<OrderItem> OrderItems { get; set; } = default!;
    public DbSet<OrderItemPhoto> OrderItemPhotos { get; set; } = default!;

    public DbSet<Review> Reviews { get; set; } = default!;
    public DbSet<PortfolioItem> PortfolioItems { get; set; } = default!;
    public DbSet<CoinsTransaction> CoinsTransactions { get; set; } = default!;
    public DbSet<Notification> Notifications { get; set; } = default!;
    public DbSet<AdminTelegramBinding> AdminTelegramBindings { get; set; } = default!;

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);
        builder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
    }
}