using System.Text.Json;
using Microsoft.Extensions.Caching.Distributed;

namespace Infrastructure.Extensions;

public static class DistributedCacheExtensions
{
    private static readonly JsonSerializerOptions SerializerOptions = new(JsonSerializerDefaults.Web);

    public static async Task<T?> GetAsync<T>(
        this IDistributedCache cache,
        string key,
        CancellationToken token = default)
    {
        var bytes = await cache.GetAsync(key, token);

        if (bytes == null || bytes.Length == 0)
            return default;

        return JsonSerializer.Deserialize<T>(bytes, SerializerOptions);
    }

    public static Task AddAsync<T>(
        this IDistributedCache cache,
        string key,
        T value,
        DateTime absoluteExpiration,
        CancellationToken token = default)
    {
        var bytes = JsonSerializer.SerializeToUtf8Bytes(value, SerializerOptions);

        var options = new DistributedCacheEntryOptions
        {
            AbsoluteExpiration = new DateTimeOffset(DateTime.SpecifyKind(absoluteExpiration, DateTimeKind.Utc))
        };

        return cache.SetAsync(key, bytes, options, token);
    }
}
