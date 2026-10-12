using System.Diagnostics;

namespace WebApi.DevTools;

/// <summary>
/// Только для Development: перед стартом API поднимает Docker Engine (без окна Docker Desktop)
/// и контейнеры из docker-compose.yml (postgres, redis), дожидаясь их healthcheck.
/// Отключается в appsettings: "DevDocker": { "AutoStart": false }.
/// </summary>
public static class DockerBootstrapper
{
    private static readonly TimeSpan EngineStartTimeout = TimeSpan.FromMinutes(3);

    public static async Task EnsureRunningAsync(IHostEnvironment env, IConfiguration config)
    {
        if (!env.IsDevelopment() || !config.GetValue("DevDocker:AutoStart", true))
            return;

        var composeFile = FindComposeFile(env.ContentRootPath);
        if (composeFile is null)
        {
            Write("docker-compose.yml не найден — автозапуск контейнеров пропущен.");
            return;
        }

        if (!await IsEngineRunningAsync())
        {
            Write("Docker не запущен — запускаю движок в фоне (без окна Docker Desktop)…");
            if (!await StartEngineAsync())
            {
                Write("Не удалось запустить Docker. Запустите Docker Desktop вручную и перезапустите API.");
                return;
            }
        }

        Write("Поднимаю контейнеры (postgres, redis)…");
        var (code, output) = await RunAsync(
            "docker",
            $"compose -f \"{composeFile}\" up -d --wait --wait-timeout 120",
            TimeSpan.FromMinutes(5));

        Write(code == 0 ? "Контейнеры готовы." : $"docker compose завершился с ошибкой:\n{output}");
    }

    private static async Task<bool> IsEngineRunningAsync()
    {
        var (code, _) = await RunAsync("docker", "info --format \"{{.ServerVersion}}\"", TimeSpan.FromSeconds(15));
        return code == 0;
    }

    private static async Task<bool> StartEngineAsync()
    {
        // `docker desktop start` (Docker Desktop 4.37+) запускает движок без открытия дашборда.
        var (code, _) = await RunAsync(
            "docker",
            $"desktop start --timeout {(int)EngineStartTimeout.TotalSeconds}",
            EngineStartTimeout + TimeSpan.FromSeconds(15));

        if (code != 0)
        {
            // Старые версии без CLI-плагина: запускаем сам Docker Desktop (свернётся в трей).
            var exe = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),
                "Docker", "Docker", "Docker Desktop.exe");
            if (!File.Exists(exe))
                return false;

            Process.Start(new ProcessStartInfo(exe) { UseShellExecute = true, WindowStyle = ProcessWindowStyle.Minimized });
        }

        // Ждём, пока движок начнёт отвечать.
        var deadline = DateTime.UtcNow + EngineStartTimeout;
        while (DateTime.UtcNow < deadline)
        {
            if (await IsEngineRunningAsync())
                return true;
            await Task.Delay(TimeSpan.FromSeconds(3));
        }

        return false;
    }

    private static string? FindComposeFile(string startDir)
    {
        for (var dir = new DirectoryInfo(startDir); dir != null; dir = dir.Parent)
        {
            var path = Path.Combine(dir.FullName, "docker-compose.yml");
            if (File.Exists(path))
                return path;
        }

        return null;
    }

    private static async Task<(int ExitCode, string Output)> RunAsync(string file, string args, TimeSpan timeout)
    {
        var psi = new ProcessStartInfo(file, args)
        {
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true
        };

        try
        {
            using var process = Process.Start(psi);
            if (process is null)
                return (-1, $"Не удалось запустить {file}");

            var stdout = process.StandardOutput.ReadToEndAsync();
            var stderr = process.StandardError.ReadToEndAsync();

            using var cts = new CancellationTokenSource(timeout);
            try
            {
                await process.WaitForExitAsync(cts.Token);
            }
            catch (OperationCanceledException)
            {
                try { process.Kill(entireProcessTree: true); } catch { /* уже завершился */ }
                return (-1, $"{file} {args}: превышено время ожидания");
            }

            return (process.ExitCode, (await stdout + await stderr).Trim());
        }
        catch (System.ComponentModel.Win32Exception)
        {
            // docker не установлен / не в PATH
            return (-1, $"{file} не найден в PATH");
        }
    }

    private static void Write(string message) => Console.WriteLine($"[docker] {message}");
}
