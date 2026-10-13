using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Infrastructure.Data;
using StarkTech.Domain.Constants;
using Domain.Entities;
using Domain.Enums;
using Infrastructure.Identity;

namespace Infrastructure.Seed;

public static class DataSeed
{
    public static async Task SeedAsync(IServiceProvider serviceProvider)
    {
        using var scope = serviceProvider.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>();
        var roleManager = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole>>();
        var configuration = scope.ServiceProvider.GetRequiredService<IConfiguration>();

        await SeedRolesAsync(roleManager);
        await SeedRolePermissionsAsync(context);
        await SeedDefaultSuperAdminAsync(context, userManager, configuration);
        await SeedProductCategoriesAsync(context);
        await SeedDeliveryCitiesAsync(context);
        await SeedPaymentSettingsAsync(context);
    }

    // Настройки оплаты — одна запись с постоянным Id. Если в базе осталась старая запись
    // со случайным Id, её значения переносятся в новую, а лишние записи удаляются.
    private static async Task SeedPaymentSettingsAsync(AppDbContext context)
    {
        var all = await context.Set<PaymentSettings>().OrderBy(s => s.CreatedAt).ToListAsync();
        if (all.Count == 1 && all[0].Id == PaymentSettings.SingletonId) return;

        var current = all.FirstOrDefault(s => s.Id == PaymentSettings.SingletonId);
        if (current == null)
        {
            var source = all.FirstOrDefault();
            current = new PaymentSettings { Id = PaymentSettings.SingletonId };
            if (source != null)
            {
                current.PrepaymentPercent = source.PrepaymentPercent;
                current.PrepaymentForCash = source.PrepaymentForCash;
                current.CashEnabled = source.CashEnabled;
                current.KortiMilliEnabled = source.KortiMilliEnabled;
                current.KortiMilliCard = source.KortiMilliCard;
                current.KortiMilliHolder = source.KortiMilliHolder;
                current.AlifPayEnabled = source.AlifPayEnabled;
                current.AlifPayPhone = source.AlifPayPhone;
                current.AlifPayHolder = source.AlifPayHolder;
                current.CardTransferEnabled = source.CardTransferEnabled;
                current.CardTransferNumber = source.CardTransferNumber;
                current.CardTransferHolder = source.CardTransferHolder;
                current.CardTransferBank = source.CardTransferBank;
                current.Instructions = source.Instructions;
                current.UpdatedAt = source.UpdatedAt;
            }
            current.PrepaymentPercent = Math.Clamp(current.PrepaymentPercent, 0, 100);
            context.Add(current);
        }

        context.RemoveRange(all.Where(s => s.Id != PaymentSettings.SingletonId));
        await context.SaveChangesAsync();
    }

    private static async Task SeedRolesAsync(RoleManager<IdentityRole> roleManager)
    {
        string[] roles = { nameof(UserRole.Client), nameof(UserRole.Admin), nameof(UserRole.SuperAdmin) };

        foreach (var role in roles)
        {
            if (!await roleManager.RoleExistsAsync(role))
                await roleManager.CreateAsync(new IdentityRole(role));
        }
    }

    private static async Task SeedRolePermissionsAsync(AppDbContext context)
    {
        var existing = (await context.RolePermissions
                .Select(p => new { p.Role, p.PermissionKey })
                .ToListAsync())
            .Select(p => (p.Role, p.PermissionKey))
            .ToHashSet();

        var permissions = new List<RolePermission>();

        var adminPermissions = new[]
        {
            UserPermissions.OrdersView, UserPermissions.OrdersEdit, UserPermissions.OrdersManualCreate,
            UserPermissions.ProductsView, UserPermissions.ProductsEdit,
            UserPermissions.ReviewsModerate,
            UserPermissions.PortfolioManage,
            UserPermissions.PromoCodesManage,
            UserPermissions.ComboOffersManage,
            UserPermissions.DeliveryCitiesManage
        };

        var superAdminOnlyPermissions = new[]
        {
            UserPermissions.ProductsDelete,
            UserPermissions.UsersManage,
            UserPermissions.UsersChangeRole,
            UserPermissions.RolesPermissionsManage,
            UserPermissions.FinanceView,
            UserPermissions.CoinsManage
        };

        foreach (var key in adminPermissions)
        {
            permissions.Add(new RolePermission { Role = UserRole.Admin, PermissionKey = key, IsGranted = true });
            permissions.Add(new RolePermission { Role = UserRole.SuperAdmin, PermissionKey = key, IsGranted = true });
        }

        foreach (var key in superAdminOnlyPermissions)
        {
            permissions.Add(new RolePermission { Role = UserRole.Admin, PermissionKey = key, IsGranted = false });
            permissions.Add(new RolePermission { Role = UserRole.SuperAdmin, PermissionKey = key, IsGranted = true });
        }

        // Only missing pairs are inserted, so new permission keys reach existing databases
        // without resetting grants an admin has already changed.
        var missing = permissions.Where(p => !existing.Contains((p.Role, p.PermissionKey))).ToList();
        if (missing.Count == 0)
            return;

        await context.RolePermissions.AddRangeAsync(missing);
        await context.SaveChangesAsync();
    }

    private static async Task SeedDefaultSuperAdminAsync(
        AppDbContext context,
        UserManager<AppUser> userManager,
        IConfiguration configuration)
    {
        var adminEmail = configuration["Seed:SuperAdminEmail"] ?? "admin@starktech.tj";

        var adminPassword = configuration["Seed:SuperAdminPassword"];

        if (string.IsNullOrWhiteSpace(adminPassword))
            throw new InvalidOperationException(
                "Seed:SuperAdminPassword is not configured. Set it with 'dotnet user-secrets set \"Seed:SuperAdminPassword\" <value>' or the Seed__SuperAdminPassword environment variable.");

        var appUser = await userManager.FindByEmailAsync(adminEmail);

        if (appUser == null)
        {
            appUser = new AppUser
            {
                UserName = adminEmail,
                Email = adminEmail,
                EmailConfirmed = true
            };

            var result = await userManager.CreateAsync(appUser, adminPassword);

            if (!result.Succeeded)
            {
                var errors = string.Join(", ", result.Errors.Select(e => e.Description));
                throw new Exception($"Failed to create default admin: {errors}");
            }
        }
        else if (configuration.GetValue<bool>("Seed:ResetSuperAdminPassword")
                 && !await userManager.CheckPasswordAsync(appUser, adminPassword))
        {
            // Аккаунт создаётся один раз, и смена Seed:SuperAdminPassword потом на него не влияет.
            // Флаг включают разово, чтобы вернуть пароль из конфигурации, затем удаляют.
            var token = await userManager.GeneratePasswordResetTokenAsync(appUser);
            var reset = await userManager.ResetPasswordAsync(appUser, token, adminPassword);

            if (!reset.Succeeded)
            {
                var errors = string.Join(", ", reset.Errors.Select(e => e.Description));
                throw new Exception($"Failed to reset default admin password: {errors}");
            }

            await userManager.ResetAccessFailedCountAsync(appUser);
            await userManager.SetLockoutEndDateAsync(appUser, null);
        }

        if (!await userManager.IsInRoleAsync(appUser, nameof(UserRole.SuperAdmin)))
            await userManager.AddToRoleAsync(appUser, nameof(UserRole.SuperAdmin));

        var clientExists = await context.Clients.AnyAsync(c => c.AppUserId == appUser.Id);
        if (clientExists) return;

        var client = new User
        {
            AppUserId = appUser.Id,
            FullName = "System Admin",
            Email = adminEmail,
            PhoneNumber = "+992111223267",
            Role = UserRole.SuperAdmin,
            PreferredLanguage = Language.Ru,
            EmailConfirmed = true,
            IsActive = true
        };

        await context.Clients.AddAsync(client);
        await context.SaveChangesAsync();
    }

    private static async Task SeedProductCategoriesAsync(AppDbContext context)
    {
        var hasAny = await context.Categories.AnyAsync();
        if (hasAny) return;

        var defaults = new Category[]
        {
            new() { NameRu = "3D стикеры с фото", NameTj = "Стикерҳои 3D бо расм", NameEn = "3D photo stickers", Slug = "3d-stickers", SortOrder = 1, IsActive = true },
            new() { NameRu = "Брелки с фото", NameTj = "Брелокҳо бо расм", NameEn = "Photo keychains", Slug = "keychains", SortOrder = 2, IsActive = true },
            new() { NameRu = "Прозрачные чехлы", NameTj = "Чехлҳои шаффоф", NameEn = "Clear phone cases", Slug = "clear-cases", SortOrder = 3, IsActive = true },
            new() { NameRu = "Чехлы с дизайном/фото", NameTj = "Чехлҳо бо тарҳ/расм", NameEn = "Custom design cases", Slug = "custom-cases", SortOrder = 4, IsActive = true },
            new() { NameRu = "Подарочные наборы", NameTj = "Дастаҳои тӯҳфа", NameEn = "Gift sets", Slug = "gift-sets", SortOrder = 5, IsActive = true },
        };

        await context.Categories.AddRangeAsync(defaults);
        await context.SaveChangesAsync();
    }

    private static async Task SeedDeliveryCitiesAsync(AppDbContext context)
    {
        var hasAny = await context.DeliveryCities.AnyAsync();
        if (hasAny) return;

        var defaults = new DeliveryCity[]
        {
            new() { NameRu = "Душанбе", NameTj = "Душанбе", NameEn = "Dushanbe", DeliveryCost = 0m, IsActive = true },
            new() { NameRu = "Худжанд", NameTj = "Хуҷанд", NameEn = "Khujand", DeliveryCost = 30m, IsActive = true },
            new() { NameRu = "Бохтар", NameTj = "Бохтар", NameEn = "Bokhtar", DeliveryCost = 25m, IsActive = true },
            new() { NameRu = "Куляб", NameTj = "Кӯлоб", NameEn = "Kulob", DeliveryCost = 25m, IsActive = true },
            new() { NameRu = "Истаравшан", NameTj = "Истаравшан", NameEn = "Istaravshan", DeliveryCost = 30m, IsActive = true },
        };

        await context.DeliveryCities.AddRangeAsync(defaults);
        await context.SaveChangesAsync();
    }
}