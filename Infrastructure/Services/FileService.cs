using Application.Interfaces.Services;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;

namespace Infrastructure.Services;

public class FileService : IFileService
{
    private readonly IWebHostEnvironment _env;

    public FileService(IWebHostEnvironment env)
    {
        _env = env;
    }

    public async Task<string?> UploadAsync(IFormFile file, string folderName)
    {
        try
        {
            if (file == null || file.Length == 0) return null;

            // Определяем путь к папке (физический)
            var uploadsFolder = Path.Combine(_env.WebRootPath, "uploads", folderName);

            if (!Directory.Exists(uploadsFolder))
                Directory.CreateDirectory(uploadsFolder);

            var fileName = Guid.NewGuid() + Path.GetExtension(file.FileName);
            var filePath = Path.Combine(uploadsFolder, fileName);

            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            // Возвращаем путь, который поймет браузер: /uploads/folder/file.jpg
            return $"/uploads/{folderName}/{fileName}";
        }
        catch (Exception ex)
        {
            Console.WriteLine($"File upload failed: {ex.Message}");
            return null;
        }
    }

    public Task<bool> DeleteAsync(string? filePath)
    {
        if (string.IsNullOrEmpty(filePath)) return Task.FromResult(false);

        // Убираем начальный слеш, чтобы путь был относительным
        var relativePath = filePath.TrimStart('/');
        var fullPath = Path.Combine(_env.WebRootPath, relativePath);

        if (File.Exists(fullPath))
        {
            File.Delete(fullPath);
            return Task.FromResult(true);
        }
        return Task.FromResult(false);
    }


}
