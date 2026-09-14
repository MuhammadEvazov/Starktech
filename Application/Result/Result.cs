using Application.Result;

namespace Application.Results;

public class Result<T>
{
    public bool IsSuccess { get; }
    public T? Data { get; }
    public List<string> Errors { get; }
    public ErrorType ErrorType { get; }

    private Result(T? data)
    {
        IsSuccess = true;
        Data = data;
        Errors = new List<string>();
    }

    private Result(List<string> errors, ErrorType errorType)
    {
        IsSuccess = false;
        Errors = errors;
        ErrorType = errorType;
    }

    public static Result<T> Ok(T? data) => new(data);

    public static Result<T> Fail(string error, ErrorType errorType)
        => new(new List<string> { error }, errorType);

    public static Result<T> Fail(List<string> errors, ErrorType errorType)
        => new(errors, errorType);
}