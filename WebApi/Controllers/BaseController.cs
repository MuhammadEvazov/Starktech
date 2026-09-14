using Application.Result;
using Application.Results;
using Microsoft.AspNetCore.Mvc;

namespace WebApi.Controllers;

[ApiController]
public abstract class BaseController : ControllerBase
{
    protected IActionResult HandleResult<T>(Result<T> result)
    {
        if (result.IsSuccess)
            return Ok(result);

        return result.ErrorType switch
        {
            ErrorType.NotFound => NotFound(result.Errors),
            ErrorType.Validation => BadRequest(result.Errors),
            ErrorType.NoChange => BadRequest(result.Errors),
            ErrorType.Conflict => Conflict(result.Errors),
            ErrorType.Unauthorized => Unauthorized(result.Errors),
            ErrorType.Forbidden => Forbid(),
            _ => StatusCode(500, result.Errors)
        };
    }

    protected string? GetCurrentUserId()
        => User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;

}
