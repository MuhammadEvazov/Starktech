using System.Linq.Expressions;
using Application.DTOs.Chat;
using Application.Interfaces.Services;
using Application.Result;
using Application.Results;
using Domain.Entities;
using Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Npgsql;

namespace Infrastructure.Services;

public class ChatService : IChatService
{
    private const int MaxTextLength = 4000;
    private readonly AppDbContext _context;
    private readonly IFileService _fileService;
    private readonly ILogger<ChatService> _logger;

    public ChatService(AppDbContext context, IFileService fileService, ILogger<ChatService> logger)
    {
        _context = context;
        _fileService = fileService;
        _logger = logger;
    }

    // Нарушение уникального индекса PostgreSQL (23505)
    private static bool IsUniqueViolation(DbUpdateException ex)
        => ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation };

    // Экранирует спецсимволы шаблона LIKE (\ % _), экранирующий символ — обратный слэш
    private static string EscapeLike(string value)
        => value.Replace("\\", "\\\\").Replace("%", "\\%").Replace("_", "\\_");

    private static readonly Expression<Func<ChatConversation, ChatConversationDto>> ToConversationDto = c => new ChatConversationDto
    {
        Id = c.Id,
        CustomerId = c.CustomerId,
        CustomerName = c.Customer.FullName,
        CustomerEmail = c.Customer.Email,
        CustomerPhone = c.Customer.PhoneNumber,
        CustomerAvatarUrl = c.Customer.AvatarUrl,
        CustomerAppUserId = c.Customer.AppUserId,
        CreatedAt = c.CreatedAt,
        LastMessageAt = c.LastMessageAt,
        LastMessagePreview = c.LastMessagePreview,
        UnreadByStaff = c.UnreadByStaff,
        UnreadByCustomer = c.UnreadByCustomer,
        IsClosed = c.IsClosed
    };

    private static readonly Expression<Func<ChatMessage, ChatMessageDto>> ToMessageDto = m => new ChatMessageDto
    {
        Id = m.Id,
        ConversationId = m.ConversationId,
        SenderId = m.SenderId,
        SenderName = m.SenderName,
        IsFromStaff = m.IsFromStaff,
        Text = m.IsDeleted ? null : m.Text,
        AttachmentUrl = m.IsDeleted ? null : m.AttachmentUrl,
        ReplyTo = m.ReplyTo == null
            ? null
            : new ChatReplyDto
            {
                Id = m.ReplyTo.Id,
                SenderName = m.ReplyTo.SenderName,
                Text = m.ReplyTo.IsDeleted ? null : m.ReplyTo.Text,
                HasAttachment = m.ReplyTo.AttachmentUrl != null,
                IsDeleted = m.ReplyTo.IsDeleted
            },
        CreatedAt = m.CreatedAt,
        EditedAt = m.EditedAt,
        IsDeleted = m.IsDeleted,
        ReadAt = m.ReadAt
    };

    private Task<ChatMessageDto> LoadMessageAsync(Guid id)
        => _context.Set<ChatMessage>().AsNoTracking().Where(m => m.Id == id).Select(ToMessageDto).FirstAsync();

    private static string? Normalize(string? text)
    {
        var t = text?.Trim();
        return string.IsNullOrEmpty(t) ? null : t;
    }

    private static string Preview(string? text, bool hasAttachment, bool deleted)
    {
        if (deleted) return "Сообщение удалено";
        var t = (text ?? string.Empty).ReplaceLineEndings(" ");
        if (hasAttachment) t = string.IsNullOrEmpty(t) ? "📷 Фото" : "📷 " + t;
        return t.Length > 200 ? t[..197] + "…" : t;
    }

    public async Task<Result<ChatConversationDto>> GetOrCreateForCustomerAsync(Guid customerId)
    {
        var existing = await _context.Set<ChatConversation>().AsNoTracking()
            .Where(c => c.CustomerId == customerId).Select(ToConversationDto).FirstOrDefaultAsync();
        if (existing != null)
            return Result<ChatConversationDto>.Ok(existing);

        if (!await _context.Clients.AnyAsync(u => u.Id == customerId))
            return Result<ChatConversationDto>.Fail("Profile not found", ErrorType.NotFound);

        var conversation = new ChatConversation { CustomerId = customerId };
        _context.Add(conversation);
        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateException ex) when (IsUniqueViolation(ex))
        {
            // Две вкладки открыли чат одновременно — переписка уже создана другим запросом.
            _context.Entry(conversation).State = EntityState.Detached;
        }

        var created = await _context.Set<ChatConversation>().AsNoTracking()
            .Where(c => c.CustomerId == customerId).Select(ToConversationDto).FirstAsync();
        return Result<ChatConversationDto>.Ok(created);
    }

    public async Task<Result<PageResult<ChatConversationDto>>> GetConversationsAsync(string? search, string? filter, int page, int pageSize)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var query = _context.Set<ChatConversation>().AsNoTracking().Where(c => c.LastMessagePreview != null);

        query = filter switch
        {
            "unread" => query.Where(c => c.UnreadByStaff > 0),
            "open" => query.Where(c => !c.IsClosed),
            "closed" => query.Where(c => c.IsClosed),
            _ => query
        };

        if (!string.IsNullOrWhiteSpace(search))
        {
            var pattern = $"%{EscapeLike(search.Trim())}%";
            query = query.Where(c =>
                EF.Functions.ILike(c.Customer.FullName, pattern, "\\") ||
                EF.Functions.ILike(c.Customer.Email, pattern, "\\") ||
                (c.Customer.PhoneNumber != null && EF.Functions.ILike(c.Customer.PhoneNumber, pattern, "\\")));
        }

        var total = await query.CountAsync();
        var items = await query
            .OrderByDescending(c => c.LastMessageAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(ToConversationDto)
            .ToListAsync();

        return Result<PageResult<ChatConversationDto>>.Ok(PageResult<ChatConversationDto>.Ok(items, total, page, pageSize));
    }

    public async Task<Result<ChatConversationDto>> GetConversationAsync(Guid conversationId)
    {
        var dto = await _context.Set<ChatConversation>().AsNoTracking()
            .Where(c => c.Id == conversationId).Select(ToConversationDto).FirstOrDefaultAsync();
        return dto == null
            ? Result<ChatConversationDto>.Fail("Conversation not found", ErrorType.NotFound)
            : Result<ChatConversationDto>.Ok(dto);
    }

    public async Task<ChatRole?> GetRoleAsync(Guid conversationId, Guid profileId, bool isStaff)
    {
        var customerId = await _context.Set<ChatConversation>().AsNoTracking()
            .Where(c => c.Id == conversationId).Select(c => (Guid?)c.CustomerId).FirstOrDefaultAsync();
        if (customerId == null) return null;
        // Сотрудник в собственной переписке (через виджет на сайте) — обычный клиент.
        if (customerId == profileId) return ChatRole.Customer;
        return isStaff ? ChatRole.Staff : null;
    }

    public async Task<Result<List<ChatMessageDto>>> GetMessagesAsync(Guid conversationId, DateTime? before, int take)
    {
        take = Math.Clamp(take, 1, 100);
        var query = _context.Set<ChatMessage>().AsNoTracking().Where(m => m.ConversationId == conversationId);
        if (before.HasValue)
        {
            var b = DateTime.SpecifyKind(before.Value.ToUniversalTime(), DateTimeKind.Utc);
            query = query.Where(m => m.CreatedAt < b);
        }

        var items = await query
            .OrderByDescending(m => m.CreatedAt)
            .Take(take)
            .Select(ToMessageDto)
            .ToListAsync();
        items.Reverse();
        return Result<List<ChatMessageDto>>.Ok(items);
    }

    public async Task<Result<ChatMessageDto>> SendAsync(Guid conversationId, Guid senderId, bool fromStaff, string? text, string? attachmentUrl, Guid? replyToId)
    {
        text = Normalize(text);
        if (text == null && attachmentUrl == null)
            return Result<ChatMessageDto>.Fail("Сообщение пустое", ErrorType.Validation);
        if (text?.Length > MaxTextLength)
            return Result<ChatMessageDto>.Fail($"Сообщение длиннее {MaxTextLength} символов", ErrorType.Validation);

        if (!await _context.Set<ChatConversation>().AnyAsync(c => c.Id == conversationId))
            return Result<ChatMessageDto>.Fail("Conversation not found", ErrorType.NotFound);

        if (replyToId.HasValue &&
            !await _context.Set<ChatMessage>().AnyAsync(m => m.Id == replyToId && m.ConversationId == conversationId))
            replyToId = null;

        var sender = await _context.Clients.AsNoTracking()
            .Where(u => u.Id == senderId).Select(u => u.FullName).FirstOrDefaultAsync();

        var message = new ChatMessage
        {
            ConversationId = conversationId,
            SenderId = senderId,
            SenderName = string.IsNullOrWhiteSpace(sender) ? (fromStaff ? "Менеджер" : "Клиент") : sender,
            IsFromStaff = fromStaff,
            Text = text,
            AttachmentUrl = attachmentUrl,
            ReplyToId = replyToId
        };
        _context.Add(message);

        var lastAt = message.CreatedAt;
        var preview = Preview(text, attachmentUrl != null, false);

        // Сообщение и счётчики — в одной транзакции; счётчик увеличиваем атомарно на стороне БД (+1),
        // чтобы параллельные сообщения не теряли инкременты.
        await using (var tx = await _context.Database.BeginTransactionAsync())
        {
            await _context.SaveChangesAsync();

            var conversations = _context.Set<ChatConversation>().Where(c => c.Id == conversationId);
            if (fromStaff)
                await conversations.ExecuteUpdateAsync(s => s
                    .SetProperty(c => c.LastMessageAt, lastAt)
                    .SetProperty(c => c.LastMessagePreview, preview)
                    .SetProperty(c => c.IsClosed, false) // новое сообщение снова открывает переписку
                    .SetProperty(c => c.UnreadByCustomer, c => c.UnreadByCustomer + 1));
            else
                await conversations.ExecuteUpdateAsync(s => s
                    .SetProperty(c => c.LastMessageAt, lastAt)
                    .SetProperty(c => c.LastMessagePreview, preview)
                    .SetProperty(c => c.IsClosed, false)
                    .SetProperty(c => c.UnreadByStaff, c => c.UnreadByStaff + 1));

            await tx.CommitAsync();
        }

        return Result<ChatMessageDto>.Ok(await LoadMessageAsync(message.Id));
    }

    public async Task<Result<ChatMessageDto>> EditAsync(Guid messageId, Guid senderId, string? text)
    {
        text = Normalize(text);
        var message = await _context.Set<ChatMessage>().Include(m => m.Conversation).FirstOrDefaultAsync(m => m.Id == messageId);
        if (message == null || message.IsDeleted)
            return Result<ChatMessageDto>.Fail("Message not found", ErrorType.NotFound);
        if (message.SenderId != senderId)
            return Result<ChatMessageDto>.Fail("Можно менять только свои сообщения", ErrorType.Forbidden);
        if (text == null && message.AttachmentUrl == null)
            return Result<ChatMessageDto>.Fail("Сообщение пустое", ErrorType.Validation);
        if (text?.Length > MaxTextLength)
            return Result<ChatMessageDto>.Fail($"Сообщение длиннее {MaxTextLength} символов", ErrorType.Validation);
        if (text == message.Text)
            return Result<ChatMessageDto>.Ok(await LoadMessageAsync(message.Id));

        message.Text = text;
        message.EditedAt = DateTime.UtcNow;
        if (message.Conversation.LastMessageAt == message.CreatedAt)
            message.Conversation.LastMessagePreview = Preview(text, message.AttachmentUrl != null, false);

        await _context.SaveChangesAsync();
        return Result<ChatMessageDto>.Ok(await LoadMessageAsync(message.Id));
    }

    public async Task<Result<ChatMessageDto>> DeleteAsync(Guid messageId, Guid senderId)
    {
        var message = await _context.Set<ChatMessage>().Include(m => m.Conversation).FirstOrDefaultAsync(m => m.Id == messageId);
        if (message == null || message.IsDeleted)
            return Result<ChatMessageDto>.Fail("Message not found", ErrorType.NotFound);
        if (message.SenderId != senderId)
            return Result<ChatMessageDto>.Fail("Можно удалять только свои сообщения", ErrorType.Forbidden);

        var attachmentUrl = message.AttachmentUrl;
        message.IsDeleted = true;
        message.Text = null;
        message.AttachmentUrl = null;
        var conversation = message.Conversation;
        if (conversation.LastMessageAt == message.CreatedAt)
            conversation.LastMessagePreview = Preview(null, false, true);

        await using (var tx = await _context.Database.BeginTransactionAsync())
        {
            await _context.SaveChangesAsync();

            // Непрочитанное удалённое сообщение больше не ждёт ответа — уменьшаем счётчик атомарно, не ниже нуля.
            if (message.ReadAt == null)
            {
                var conversations = _context.Set<ChatConversation>().Where(c => c.Id == conversation.Id);
                if (message.IsFromStaff)
                    await conversations.ExecuteUpdateAsync(s => s
                        .SetProperty(c => c.UnreadByCustomer, c => c.UnreadByCustomer > 0 ? c.UnreadByCustomer - 1 : 0));
                else
                    await conversations.ExecuteUpdateAsync(s => s
                        .SetProperty(c => c.UnreadByStaff, c => c.UnreadByStaff > 0 ? c.UnreadByStaff - 1 : 0));
            }

            await tx.CommitAsync();
        }

        // Файл вложения удаляем после успешного коммита
        if (!string.IsNullOrWhiteSpace(attachmentUrl) && !await _fileService.DeleteAsync(attachmentUrl))
            _logger.LogWarning("Attachment file of deleted chat message {MessageId} was not removed", message.Id);

        return Result<ChatMessageDto>.Ok(await LoadMessageAsync(message.Id));
    }

    public async Task<Result<ChatReadDto?>> MarkReadAsync(Guid conversationId, bool byStaff)
    {
        var now = DateTime.UtcNow;
        // Сотрудник читает сообщения клиента, клиент — ответы сотрудников.
        var marked = await _context.Set<ChatMessage>()
            .Where(m => m.ConversationId == conversationId && m.ReadAt == null && m.IsFromStaff != byStaff)
            .ExecuteUpdateAsync(s => s.SetProperty(m => m.ReadAt, now));

        var counter = byStaff
            ? await _context.Set<ChatConversation>().Where(c => c.Id == conversationId && c.UnreadByStaff != 0)
                .ExecuteUpdateAsync(s => s.SetProperty(c => c.UnreadByStaff, 0))
            : await _context.Set<ChatConversation>().Where(c => c.Id == conversationId && c.UnreadByCustomer != 0)
                .ExecuteUpdateAsync(s => s.SetProperty(c => c.UnreadByCustomer, 0));

        if (marked == 0 && counter == 0)
            return Result<ChatReadDto?>.Ok(null);

        return Result<ChatReadDto?>.Ok(new ChatReadDto { ConversationId = conversationId, ByStaff = byStaff, ReadAt = now });
    }

    public async Task<Result<ChatConversationDto>> SetClosedAsync(Guid conversationId, bool closed)
    {
        var updated = await _context.Set<ChatConversation>()
            .Where(c => c.Id == conversationId)
            .ExecuteUpdateAsync(s => s.SetProperty(c => c.IsClosed, closed));
        if (updated == 0)
            return Result<ChatConversationDto>.Fail("Conversation not found", ErrorType.NotFound);
        return await GetConversationAsync(conversationId);
    }

    public Task<int> GetStaffUnreadAsync()
        => _context.Set<ChatConversation>().SumAsync(c => c.UnreadByStaff);

    public Task<int> GetCustomerUnreadAsync(Guid customerId)
        => _context.Set<ChatConversation>().Where(c => c.CustomerId == customerId).SumAsync(c => c.UnreadByCustomer);
}
