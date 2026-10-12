using Application.Results;

namespace Application.Interfaces.Repositories;

public interface IUnitOfWork
{
    // Commits when the result is successful, rolls back on a failed result or an exception.
    // When a transaction is already open the action joins it and the outermost caller decides.
    Task<Result<T>> ExecuteInTransactionAsync<T>(Func<Task<Result<T>>> action);
}
