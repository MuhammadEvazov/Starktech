namespace Application.Result;

public class PageRequest
{
    private int _page { get; set; } = 1;
    private int _pageSize { get; set; } = 10;


    public int Page {
        get => _page;
        set => _page = value < 1 ? 1 : value;
    }

    public int PageSize {
        get => _pageSize;
        set => _pageSize = value < 1 ? 10 : value > 100 ? 100 : value;
    }

    public int Skip => (Page - 1) * PageSize;
}
