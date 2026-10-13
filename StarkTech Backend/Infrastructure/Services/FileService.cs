using Application.Interfaces.Services;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Infrastructure.Services;

public class FileService : IFileService
{
    private const string UploadsRoot = "uploads";
    private const long DefaultMaxFileSizeBytes = 5 * 1024 * 1024;
    private const int SignatureLength = 12;

    private static readonly HashSet<string> AllowedExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".jpg", ".jpeg", ".png", ".webp"
    };

    private const long DefaultMaxVideoSizeBytes = 50 * 1024 * 1024;

    private static readonly HashSet<string> AllowedVideoExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".mp4", ".mov", ".m4v", ".webm"
    };

    private readonly IWebHostEnvironment _env;
    private readonly ILogger<FileService> _logger;
    private readonly long _maxFileSizeBytes;
    private readonly long _maxVideoSizeBytes;
    private readonly S3Storage? _s3;

    public FileService(IWebHostEnvironment env, IConfiguration configuration, ILogger<FileService> logger)
    {
        _env = env;
        _logger = logger;
        _maxFileSizeBytes = configuration.GetValue<long?>("FileStorage:MaxFileSizeBytes") ?? DefaultMaxFileSizeBytes;
        _maxVideoSizeBytes = configuration.GetValue<long?>("FileStorage:MaxVideoSizeBytes") ?? DefaultMaxVideoSizeBytes;
        // Storage:Provider = s3 — файлы в S3-совместимом хранилище (Supabase Storage, Cloudflare R2, Backblaze B2, MinIO):
        // нужно там, где у сервера нет постоянного диска (бесплатный Render). По умолчанию — локальная папка wwwroot/uploads.
        if (string.Equals(configuration["Storage:Provider"], "s3", StringComparison.OrdinalIgnoreCase))
            _s3 = S3Storage.Get(configuration.GetSection("Storage:S3"));
    }

    public string? ValidateImage(IFormFile? file)
    {
        if (file == null || file.Length == 0)
            return "File is required";

        if (file.Length > _maxFileSizeBytes)
            return $"File is too large. Maximum size is {_maxFileSizeBytes / (1024 * 1024)} MB";

        var extension = Path.GetExtension(file.FileName);
        if (!AllowedExtensions.Contains(extension))
            return "Only JPG, PNG and WEBP images are allowed";

        Span<byte> header = stackalloc byte[SignatureLength];
        int bytesRead;

        using (var stream = file.OpenReadStream())
        {
            bytesRead = stream.ReadAtLeast(header, SignatureLength, throwOnEndOfStream: false);
        }

        if (!HasValidSignature(extension.ToLowerInvariant(), header[..bytesRead]))
            return "File content does not match its extension";

        return null;
    }

    public string? ValidateMedia(IFormFile? file, out bool isVideo)
    {
        isVideo = false;
        if (file == null || file.Length == 0)
            return "File is required";

        var extension = Path.GetExtension(file.FileName);
        if (!AllowedVideoExtensions.Contains(extension))
            return ValidateImage(file);

        isVideo = true;
        if (file.Length > _maxVideoSizeBytes)
            return $"Video is too large. Maximum size is {_maxVideoSizeBytes / (1024 * 1024)} MB";

        Span<byte> header = stackalloc byte[SignatureLength];
        int bytesRead;
        using (var stream = file.OpenReadStream())
        {
            bytesRead = stream.ReadAtLeast(header, SignatureLength, throwOnEndOfStream: false);
        }

        if (!HasValidVideoSignature(extension.ToLowerInvariant(), header[..bytesRead]))
            return "File content does not match its extension";

        return null;
    }

    public async Task<string?> UploadMediaAsync(IFormFile file, string folderName)
    {
        var validationError = ValidateMedia(file, out _);
        if (validationError != null)
        {
            _logger.LogWarning("Rejected media upload to {Folder}: {Reason}", folderName, validationError);
            return null;
        }

        return await SaveAsync(file, folderName);
    }

    public async Task<string?> UploadAsync(IFormFile file, string folderName)
    {
        var validationError = ValidateImage(file);
        if (validationError != null)
        {
            _logger.LogWarning("Rejected file upload to {Folder}: {Reason}", folderName, validationError);
            return null;
        }

        return await SaveAsync(file, folderName);
    }

    private async Task<string?> SaveAsync(IFormFile file, string folderName)
    {
        if (_s3 != null)
        {
            try
            {
                var key = $"{folderName}/{Guid.NewGuid()}{Path.GetExtension(file.FileName).ToLowerInvariant()}";
                await using var stream = file.OpenReadStream();
                return await _s3.PutAsync(key, stream, file.ContentType);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "File upload to storage {Folder} failed", folderName);
                return null;
            }
        }

        try
        {
            var uploadsFolder = Path.Combine(_env.WebRootPath, UploadsRoot, folderName);
            Directory.CreateDirectory(uploadsFolder);

            var fileName = Guid.NewGuid() + Path.GetExtension(file.FileName).ToLowerInvariant();
            var filePath = Path.Combine(uploadsFolder, fileName);

            await using (var stream = new FileStream(filePath, FileMode.CreateNew))
            {
                await file.CopyToAsync(stream);
            }

            return $"/{UploadsRoot}/{folderName}/{fileName}";
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "File upload to {Folder} failed", folderName);
            return null;
        }
    }

    public async Task<bool> DeleteAsync(string? filePath)
    {
        if (string.IsNullOrWhiteSpace(filePath))
            return false;

        // Файл в хранилище (полный URL бакета) — удаляем там; старые локальные /uploads/… — с диска.
        if (_s3 != null && _s3.TryGetKey(filePath, out var key))
        {
            try
            {
                await _s3.DeleteAsync(key);
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Could not delete stored file {Path}", filePath);
                return false;
            }
        }

        return DeleteLocal(filePath);
    }

    private bool DeleteLocal(string filePath)
    {
        try
        {
            var uploadsRoot = Path.GetFullPath(Path.Combine(_env.WebRootPath, UploadsRoot)) + Path.DirectorySeparatorChar;
            var fullPath = Path.GetFullPath(Path.Combine(_env.WebRootPath, filePath.TrimStart('/', '\\')));

            if (!fullPath.StartsWith(uploadsRoot, StringComparison.OrdinalIgnoreCase))
            {
                _logger.LogWarning("Refused to delete a file outside the uploads folder: {Path}", filePath);
                return false;
            }

            if (!File.Exists(fullPath))
                return false;

            File.Delete(fullPath);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Could not delete file {Path}", filePath);
            return false;
        }
    }

    // MP4/MOV: байты 4–8 = "ftyp"; WebM: EBML-заголовок 1A 45 DF A3.
    private static bool HasValidVideoSignature(string extension, ReadOnlySpan<byte> header) => extension switch
    {
        ".mp4" or ".mov" or ".m4v" => header.Length >= 8 && header[4..8].SequenceEqual("ftyp"u8),
        ".webm" => header.StartsWith(new byte[] { 0x1A, 0x45, 0xDF, 0xA3 }),
        _ => false
    };

    private static bool HasValidSignature(string extension, ReadOnlySpan<byte> header) => extension switch
    {
        ".jpg" or ".jpeg" => header.StartsWith(new byte[] { 0xFF, 0xD8, 0xFF }),
        ".png" => header.StartsWith(new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A }),
        ".webp" => header.Length >= 12 && header[..4].SequenceEqual("RIFF"u8) && header[8..12].SequenceEqual("WEBP"u8),
        _ => false
    };
}
