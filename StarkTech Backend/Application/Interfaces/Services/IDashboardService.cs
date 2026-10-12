using Application.DTOs.Dashboard;
using Application.Results;

namespace Application.Interfaces.Services;

public interface IDashboardService
{
    /// <param name="days">Длина периода в днях (1–365), включая сегодня.</param>
    /// <param name="includeFinance">Добавлять ли суммы денег (право finance.view).</param>
    Task<Result<DashboardDto>> GetAsync(int days, bool includeFinance);
}
