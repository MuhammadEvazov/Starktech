namespace StarkTech.Domain.Constants;

public static class UserPermissions
{
    // Orders
    public const string OrdersView = "orders.view";
    public const string OrdersEdit = "orders.edit";
    public const string OrdersManualCreate = "orders.manual-create";

    // Products
    public const string ProductsView = "products.view";
    public const string ProductsEdit = "products.edit";
    public const string ProductsDelete = "products.delete";

    // Reviews
    public const string ReviewsModerate = "reviews.moderate";

    // Portfolio
    public const string PortfolioManage = "portfolio.manage";

    // Promo & Combo
    public const string PromoCodesManage = "promo-codes.manage";
    public const string ComboOffersManage = "combo-offers.manage";

    // Delivery
    public const string DeliveryCitiesManage = "delivery-cities.manage";

    // Users & Roles
    public const string UsersManage = "users.manage";
    public const string UsersChangeRole = "users.change-role";
    public const string RolesPermissionsManage = "roles-permissions.manage";

    // Finance
    public const string FinanceView = "finance.view";
    public const string CoinsManage = "coins.manage";

    public static readonly string[] All =
    {
        OrdersView, OrdersEdit, OrdersManualCreate,
        ProductsView, ProductsEdit, ProductsDelete,
        ReviewsModerate,
        PortfolioManage,
        PromoCodesManage, ComboOffersManage,
        DeliveryCitiesManage,
        UsersManage, UsersChangeRole, RolesPermissionsManage,
        FinanceView, CoinsManage
    };

    public static readonly string[] AdminDefault =
    {
        OrdersView, OrdersEdit, OrdersManualCreate,
        ProductsView, ProductsEdit,
        ReviewsModerate,
        PortfolioManage,
        PromoCodesManage, ComboOffersManage,
        DeliveryCitiesManage
    };

    public static readonly string[] SuperAdminOnly =
    {
        ProductsDelete,
        UsersManage, UsersChangeRole, RolesPermissionsManage,
        FinanceView, CoinsManage
    };
}