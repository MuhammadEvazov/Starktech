using Application.DTOs.DeliveryCity;
using Application.Interfaces.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StarkTech.Domain.Constants;
using WebApi.Authorization;

namespace WebApi.Controllers;

[ApiController]
[Route("api/delivery-cities")]
public class DeliveryCityController : BaseController
{
    private readonly IDeliveryCityService _cityService;

    public DeliveryCityController(IDeliveryCityService cityService)
    {
        _cityService = cityService;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] GetDeliveryCityFilterDto filter)
    {
        var result = await _cityService.GetAllAsync(filter);
        return HandleResult(result);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var result = await _cityService.GetByIdAsync(id);
        return HandleResult(result);
    }

    [HttpPost]
    [Authorize(Policy = PermissionPolicy.Prefix + UserPermissions.DeliveryCitiesManage)]
    public async Task<IActionResult> Create(CreateDeliveryCityDto dto)
    {
        var result = await _cityService.CreateAsync(dto);
        return HandleResult(result);
    }

    [HttpPut("{id}")]
    [Authorize(Policy = PermissionPolicy.Prefix + UserPermissions.DeliveryCitiesManage)]
    public async Task<IActionResult> Update(Guid id, UpdateDeliveryCityDto dto)
    {
        var result = await _cityService.UpdateAsync(id, dto);
        return HandleResult(result);
    }

    [HttpDelete("{id}")]
    [Authorize(Policy = PermissionPolicy.Prefix + UserPermissions.DeliveryCitiesManage)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var result = await _cityService.DeleteAsync(id);
        return HandleResult(result);
    }
}
