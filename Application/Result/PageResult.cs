namespace Application.Result;

public class PageResult<T>
{
    public IReadOnlyList<T> Items { get; }
    public int TotalCount { get; }
    public int Page { get; }
    public int PageSize { get; }
    public int TotalPages => (int)Math.Ceiling(TotalCount / (double) PageSize);
    public bool HasNextPage => Page < TotalPages;
    public bool HasPreviousPage => Page > 1;

    public PageResult(IReadOnlyList<T> items, int totalCount, int page, int pageSize)
    {
        Items = items;
        TotalCount = totalCount;
        Page = page;
        PageSize = pageSize;
    }


    public static PageResult<T> Ok(IReadOnlyList<T> items, int totalCount, int page, int pageSize)
    {
        return new PageResult<T>(items, totalCount, page, pageSize);
    }
}
