using Application.Interfaces.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StarkTech.Domain.Constants;
using WebApi.Authorization;

namespace WebApi.Controllers;

[Route("api/dashboard")]
[Authorize(Policy = PermissionPolicy.Prefix + UserPermissions.OrdersView)]
public class DashboardController : BaseController
{
    private readonly IDashboardService _dashboardService;

    public DashboardController(IDashboardService dashboardService)
    {
        _dashboardService = dashboardService;
    }

    // GET /api/dashboard?days=30 — суммы денег только при праве finance.view
    [HttpGet]
    public async Task<IActionResult> Get([FromQuery] int days = 30)
    {
        var includeFinance = await HasPermissionAsync(UserPermissions.FinanceView);
        var result = await _dashboardService.GetAsync(days, includeFinance);
        return HandleResult(result);
    }
}
