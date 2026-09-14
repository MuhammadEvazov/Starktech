using Application.DTOs.CoinsTransaction;
using Application.Interfaces.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StarkTech.Domain.Constants;
using WebApi.Authorization;

namespace WebApi.Controllers;

[ApiController]
[Route("api/coins-transactions")]
[Authorize(Policy = PermissionPolicy.Prefix + UserPermissions.CoinsManage)]
public class CoinsTransactionController : BaseController
{
    private readonly ICoinsTransactionService _coinsTransactionService;

    public CoinsTransactionController(ICoinsTransactionService coinsTransactionService)
    {
        _coinsTransactionService = coinsTransactionService;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] GetCoinsTransactionFilterDto filter)
    {
        var result = await _coinsTransactionService.GetAllAsync(filter);
        return HandleResult(result);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var result = await _coinsTransactionService.GetByIdAsync(id);
        return HandleResult(result);
    }

    [HttpPost("adjust")]
    public async Task<IActionResult> Adjust(ManualAdjustCoinsDto dto)
    {
        var result = await _coinsTransactionService.ManualAdjustmentAsync(dto);
        return HandleResult(result);
    }
}
