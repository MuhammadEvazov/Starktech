using Amazon.Runtime;
using Amazon.S3;
using Amazon.S3.Model;
using Microsoft.Extensions.Configuration;

namespace Infrastructure.Services;

/// <summary>
/// S3-совместимое хранилище файлов (Supabase Storage, Cloudflare R2, Backblaze B2, MinIO) для FileService.
/// Нужно, когда у сервера нет постоянного диска (бесплатный Render). Файлы публичные: сайт показывает их по URL.
/// Настройки (переменные окружения на хостинге):
///   Storage__Provider=s3
///   Storage__S3__ServiceUrl     — адрес S3 API (например https://&lt;project&gt;.supabase.co/storage/v1/s3)
///   Storage__S3__Region         — регион (Supabase — регион проекта, R2 — auto)
///   Storage__S3__Bucket         — имя публичного бакета
///   Storage__S3__AccessKey / Storage__S3__SecretKey — ключи доступа S3
///   Storage__S3__PublicBaseUrl  — публичный адрес бакета (например https://&lt;project&gt;.supabase.co/storage/v1/object/public/&lt;bucket&gt;)
/// </summary>
public sealed class S3Storage
{
    private static S3Storage? _instance;
    private static readonly object Gate = new();

    private readonly IAmazonS3 _client;
    private readonly string _bucket;
    private readonly string _publicBaseUrl;
    private readonly bool _https;

    /// <summary>Один клиент на всё приложение (FileService — scoped, а клиент S3 дорогой и потокобезопасный).</summary>
    public static S3Storage Get(IConfigurationSection section)
    {
        if (_instance != null) return _instance;
        lock (Gate) return _instance ??= new S3Storage(section);
    }

    private S3Storage(IConfigurationSection s)
    {
        string Required(string key) => s[key] is { Length: > 0 } value
            ? value
            : throw new InvalidOperationException($"Storage:S3:{key} is not configured (environment variable Storage__S3__{key}).");

        var serviceUrl = Required("ServiceUrl");
        _bucket = Required("Bucket");
        _publicBaseUrl = Required("PublicBaseUrl").TrimEnd('/');
        _https = serviceUrl.StartsWith("https://", StringComparison.OrdinalIgnoreCase);

        var config = new AmazonS3Config
        {
            ServiceURL = serviceUrl,
            // Supabase/MinIO/B2 адресуют бакет в пути, а не в поддомене
            ForcePathStyle = s.GetValue("ForcePathStyle", true),
            AuthenticationRegion = s["Region"] is { Length: > 0 } region ? region : "auto",
            // Новые обязательные контрольные суммы AWS SDK не поддерживают R2/B2/Supabase — только когда требуются.
            RequestChecksumCalculation = RequestChecksumCalculation.WHEN_REQUIRED,
            ResponseChecksumValidation = ResponseChecksumValidation.WHEN_REQUIRED
        };
        _client = new AmazonS3Client(new BasicAWSCredentials(Required("AccessKey"), Required("SecretKey")), config);
    }

    /// <summary>Загрузить файл и вернуть его публичный URL.</summary>
    public async Task<string> PutAsync(string key, Stream content, string? contentType)
    {
        var request = new PutObjectRequest
        {
            BucketName = _bucket,
            Key = key,
            InputStream = content,
            AutoCloseStream = false,
            ContentType = string.IsNullOrWhiteSpace(contentType) ? "application/octet-stream" : contentType,
            // R2/B2 не принимают «aws-chunked»; по https подписывать тело не нужно
            UseChunkEncoding = false,
            DisablePayloadSigning = _https
        };
        // Имя файла уникальное (GUID) и не меняется — браузер может кэшировать надолго
        request.Headers.CacheControl = "public, max-age=31536000, immutable";
        await _client.PutObjectAsync(request);
        return $"{_publicBaseUrl}/{key}";
    }

    /// <summary>Ключ объекта по его публичному URL (false — файл не из этого хранилища, например старый /uploads/…).</summary>
    public bool TryGetKey(string url, out string key)
    {
        key = string.Empty;
        if (!url.StartsWith(_publicBaseUrl + "/", StringComparison.OrdinalIgnoreCase))
            return false;
        key = Uri.UnescapeDataString(url[(_publicBaseUrl.Length + 1)..]);
        return key.Length > 0 && !key.Contains("..", StringComparison.Ordinal);
    }

    public Task DeleteAsync(string key) => _client.DeleteObjectAsync(_bucket, key);
}
