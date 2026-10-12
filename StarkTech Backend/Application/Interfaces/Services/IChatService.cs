using Application.DTOs.Chat;
using Application.Result;
using Application.Results;

namespace Application.Interfaces.Services;

public interface IChatService
{
    /// <summary>Переписка клиента; создаётся при первом обращении.</summary>
    Task<Result<ChatConversationDto>> GetOrCreateForCustomerAsync(Guid customerId);
    /// <summary>Список переписок для сотрудников (пустые, без сообщений, не показываем).</summary>
    Task<Result<PageResult<ChatConversationDto>>> GetConversationsAsync(string? search, string? filter, int page, int pageSize);
    Task<Result<ChatConversationDto>> GetConversationAsync(Guid conversationId);
    /// <summary>Роль пользователя в переписке или null, если доступа нет.</summary>
    Task<ChatRole?> GetRoleAsync(Guid conversationId, Guid profileId, bool isStaff);

    /// <summary>Сообщения от старых к новым; before — для подгрузки истории вверх.</summary>
    Task<Result<List<ChatMessageDto>>> GetMessagesAsync(Guid conversationId, DateTime? before, int take);
    Task<Result<ChatMessageDto>> SendAsync(Guid conversationId, Guid senderId, bool fromStaff, string? text, string? attachmentUrl, Guid? replyToId);
    Task<Result<ChatMessageDto>> EditAsync(Guid messageId, Guid senderId, string? text);
    Task<Result<ChatMessageDto>> DeleteAsync(Guid messageId, Guid senderId);
    /// <summary>Отметить прочитанными сообщения собеседника. Data = null, если читать было нечего.</summary>
    Task<Result<ChatReadDto?>> MarkReadAsync(Guid conversationId, bool byStaff);
    Task<Result<ChatConversationDto>> SetClosedAsync(Guid conversationId, bool closed);

    Task<int> GetStaffUnreadAsync();
    Task<int> GetCustomerUnreadAsync(Guid customerId);
}
