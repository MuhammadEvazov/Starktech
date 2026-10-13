using System.Security.Claims;
using Application.DTOs.CoinsTransaction;
using Application.DTOs.Profile;
using Application.Interfaces.Services;
using Application.Results;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using WebApi.MiddleWares;

namespace WebApi.Controllers;

[ApiController]
[Route("api/profile")]
[Authorize]
public class ProfileController : BaseController
{

    private readonly IProfileService _profileService;
    private readonly ICoinsTransactionService _coinsTransactionService;
    private readonly IAccountDeletionService _accountDeletionService;

    public ProfileController(
        IProfileService profileService,
        ICoinsTransactionService coinsTransactionService,
        IAccountDeletionService accountDeletionService)
    {
        _profileService = profileService;
        _coinsTransactionService = coinsTransactionService;
        _accountDeletionService = accountDeletionService;
    }


    // GET /api/profile
    [HttpGet]
    public async Task<IActionResult> GetProfile()
    {
        var userId = GetUserId();

        if (userId is null)
            return Unauthorized();

        var result = await _profileService.GetProfileAsync(userId);

        return result.IsSuccess
            ? Ok(result)
            : HandleResult(result);
    }



    // PUT /api/profile
    [HttpPut]
    public async Task<IActionResult> UpdateProfile([FromBody] UpdateProfileDto dto)
    {
        var userId = GetUserId();

        if (userId is null)
            return Unauthorized();

        var result = await _profileService.UpdateProfileAsync(userId, dto);

        return result.IsSuccess
            ? Ok(result)
            : HandleResult(result);
    }


    // PUT /api/profile/avatar
    [HttpPut("avatar")]
    [Consumes("multipart/form-data")]
    public async Task<IActionResult> UpdateAvatar([FromForm] UpdateProfileAvatarDto dto)
    {
        var userId = GetUserId();

        if (userId is null)
            return Unauthorized();

        if (dto.File == null || dto.File.Length == 0)
            return BadRequest("Файл обязателен");

        var success = await _profileService.UpdateUserProfileAsync(userId, dto.File);

        if (!success)
            return BadRequest("Не удалось обновить фото профиля");

        return Ok(Result<bool>.Ok(true));
    }


    // GET /api/profile/coins — история монет текущего пользователя
    [HttpGet("coins")]
    public async Task<IActionResult> GetMyCoins([FromQuery] GetCoinsTransactionFilterDto filter)
    {
        var profileId = await GetCurrentProfileIdAsync();

        if (profileId is null)
            return Unauthorized();

        // Владелец всегда берётся из токена, а не из запроса.
        filter.UserId = profileId;

        var result = await _coinsTransactionService.GetAllAsync(filter);
        return HandleResult(result);
    }

    // DELETE /api/profile — удаление своего аккаунта: личные данные стираются, заказы обезличиваются
    [HttpDelete]
    [EnableRateLimiting(RateLimitPolicies.Auth)]
    public async Task<IActionResult> DeleteAccount([FromBody] DeleteAccountDto dto)
    {
        var userId = GetUserId();

        if (userId is null)
            return Unauthorized();

        var result = await _accountDeletionService.DeleteOwnAccountAsync(userId, dto.Password);
        return HandleResult(result);
    }

    private string? GetUserId()
    {
        return User.FindFirstValue(ClaimTypes.NameIdentifier);
    }


}
