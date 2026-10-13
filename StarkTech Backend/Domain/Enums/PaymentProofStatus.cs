namespace Domain.Enums;

/// <summary>Чек оплаты, присланный клиентом: ждёт проверки, принят или отклонён.</summary>
public enum PaymentProofStatus
{
    Pending = 0,
    Approved = 1,
    Rejected = 2
}
