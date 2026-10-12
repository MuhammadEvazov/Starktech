using Application.Interfaces.Repositories;
using Application.Results;

namespace Infrastructure.Data;

public class UnitOfWork(AppDbContext context) : IUnitOfWork
{
    public async Task<Result<T>> ExecuteInTransactionAsync<T>(Func<Task<Result<T>>> action)
    {
        if (context.Database.CurrentTransaction != null)
            return await action();

        await using var transaction = await context.Database.BeginTransactionAsync();

        try
        {
            var result = await action();

            if (result.IsSuccess)
            {
                await transaction.CommitAsync();
            }
            else
            {
                await transaction.RollbackAsync();
                context.ChangeTracker.Clear();
            }

            return result;
        }
        catch
        {
            await transaction.RollbackAsync();
            context.ChangeTracker.Clear();
            throw;
        }
    }
}
