using Application.DTOs.Chat;
using Application.Interfaces.Services;
using Application.Results;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StarkTech.Domain.Constants;
using WebApi.Authorization;
using WebApi.Hubs;

namespace WebApi.Controllers;

/// <summary>
/// REST-часть чата: открыть свою переписку, список переписок для сотрудников, история, фото.
/// Сами сообщения в реальном времени идут через SignalR (WebApi/Hubs/ChatHub.cs).
/// </summary>
[Route("api/chat")]
[Authorize]
public class ChatController : BaseController
{
    private readonly IChatService _chat;
    private readonly IFileService _files;
    private readonly ChatNotifier _notifier;

    public ChatController(IChatService chat, IFileService files, ChatNotifier notifier)
    {
        _chat = chat;
        _files = files;
        _notifier = notifier;
    }

    private async Task<(Guid ProfileId, ChatRole? Role)> AccessAsync(Guid conversationId)
    {
        var profileId = await GetCurrentProfileIdAsync() ?? Guid.Empty;
        var isStaff = await HasPermissionAsync(UserPermissions.OrdersView);
        return (profileId, await _chat.GetRoleAsync(conversationId, profileId, isStaff));
    }

    private IActionResult NoAccess() => StatusCode(403, new[] { "Нет доступа к переписке" });

    /// <summary>Своя переписка с магазином (создаётся при первом открытии).</summary>
    [HttpGet("my")]
    public async Task<IActionResult> My()
    {
        var profileId = await GetCurrentProfileIdAsync();
        if (profileId == null)
            return Unauthorized(new[] { "Нужно войти в аккаунт" });
        return HandleResult(await _chat.GetOrCreateForCustomerAsync(profileId.Value));
    }

    [HttpGet("unread")]
    public async Task<IActionResult> Unread()
    {
        var profileId = await GetCurrentProfileIdAsync();
        var dto = new ChatUnreadDto
        {
            Mine = profileId == null ? 0 : await _chat.GetCustomerUnreadAsync(profileId.Value),
            Staff = await HasPermissionAsync(UserPermissions.OrdersView) ? await _chat.GetStaffUnreadAsync() : null
        };
        return HandleResult(Result<ChatUnreadDto>.Ok(dto));
    }

    [HttpGet("conversations")]
    [Authorize(Policy = PermissionPolicy.Prefix + UserPermissions.OrdersView)]
    public async Task<IActionResult> Conversations([FromQuery] string? search, [FromQuery] string? filter,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 30)
        => HandleResult(await _chat.GetConversationsAsync(search, filter, page, pageSize));

    /// <summary>Сотрудник начинает переписку с клиентом (например, со страницы заказа).</summary>
    [HttpPost("conversations/for-customer/{customerId:guid}")]
    [Authorize(Policy = PermissionPolicy.Prefix + UserPermissions.OrdersView)]
    public async Task<IActionResult> ForCustomer(Guid customerId)
        => HandleResult(await _chat.GetOrCreateForCustomerAsync(customerId));

    [HttpGet("conversations/{id:guid}")]
    public async Task<IActionResult> Conversation(Guid id)
    {
        var (_, role) = await AccessAsync(id);
        if (role == null) return NoAccess();
        return HandleResult(await _chat.GetConversationAsync(id));
    }

    [HttpGet("conversations/{id:guid}/messages")]
    public async Task<IActionResult> Messages(Guid id, [FromQuery] DateTime? before, [FromQuery] int take = 40)
    {
        var (_, role) = await AccessAsync(id);
        if (role == null) return NoAccess();
        return HandleResult(await _chat.GetMessagesAsync(id, before, take));
    }

    /// <summary>Фото в чат (с подписью и ответом). Остальные участники получают его через SignalR.</summary>
    [HttpPost("conversations/{id:guid}/attachments")]
    [RequestSizeLimit(6 * 1024 * 1024)]
    public async Task<IActionResult> Attachment(Guid id, IFormFile? file, [FromForm] string? text, [FromForm] Guid? replyToId)
    {
        var (profileId, role) = await AccessAsync(id);
        if (role == null) return NoAccess();

        var error = _files.ValidateImage(file);
        if (error != null)
            return BadRequest(new[] { error });

        var url = await _files.UploadAsync(file!, "chat");
        if (url == null)
            return StatusCode(500, new[] { "Не удалось сохранить фото" });

        var result = await _chat.SendAsync(id, profileId, role == ChatRole.Staff, text, url, replyToId);
        if (result.IsSuccess && result.Data != null)
            await _notifier.MessageCreatedAsync(result.Data);
        return HandleResult(result);
    }

    [HttpPut("conversations/{id:guid}/closed")]
    [Authorize(Policy = PermissionPolicy.Prefix + UserPermissions.OrdersView)]
    public async Task<IActionResult> SetClosed(Guid id, SetChatClosedDto dto)
    {
        var result = await _chat.SetClosedAsync(id, dto.Closed);
        if (result.IsSuccess && result.Data != null)
            await _notifier.ConversationChangedAsync(result.Data);
        return HandleResult(result);
    }
}
