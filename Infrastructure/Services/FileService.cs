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

    private readonly IWebHostEnvironment _env;
    private readonly ILogger<FileService> _logger;
    private readonly long _maxFileSizeBytes;

    public FileService(IWebHostEnvironment env, IConfiguration configuration, ILogger<FileService> logger)
    {
        _env = env;
        _logger = logger;
        _maxFileSizeBytes = configuration.GetValue<long?>("FileStorage:MaxFileSizeBytes") ?? DefaultMaxFileSizeBytes;
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

    public async Task<string?> UploadAsync(IFormFile file, string folderName)
    {
        var validationError = ValidateImage(file);
        if (validationError != null)
        {
            _logger.LogWarning("Rejected file upload to {Folder}: {Reason}", folderName, validationError);
            return null;
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

    public Task<bool> DeleteAsync(string? filePath)
    {
        if (string.IsNullOrWhiteSpace(filePath))
            return Task.FromResult(false);

        try
        {
            var uploadsRoot = Path.GetFullPath(Path.Combine(_env.WebRootPath, UploadsRoot)) + Path.DirectorySeparatorChar;
            var fullPath = Path.GetFullPath(Path.Combine(_env.WebRootPath, filePath.TrimStart('/', '\\')));

            if (!fullPath.StartsWith(uploadsRoot, StringComparison.OrdinalIgnoreCase))
            {
                _logger.LogWarning("Refused to delete a file outside the uploads folder: {Path}", filePath);
                return Task.FromResult(false);
            }

            if (!File.Exists(fullPath))
                return Task.FromResult(false);

            File.Delete(fullPath);
            return Task.FromResult(true);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Could not delete file {Path}", filePath);
            return Task.FromResult(false);
        }
    }

    private static bool HasValidSignature(string extension, ReadOnlySpan<byte> header) => extension switch
    {
        ".jpg" or ".jpeg" => header.StartsWith(new byte[] { 0xFF, 0xD8, 0xFF }),
        ".png" => header.StartsWith(new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A }),
        ".webp" => header.Length >= 12 && header[..4].SequenceEqual("RIFF"u8) && header[8..12].SequenceEqual("WEBP"u8),
        _ => false
    };
}
