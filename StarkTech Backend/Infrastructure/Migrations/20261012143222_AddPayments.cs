using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddPayments : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "HasPendingPaymentProof",
                table: "Orders",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<decimal>(
                name: "PaidAmount",
                table: "Orders",
                type: "numeric(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<int>(
                name: "PrepaymentPercent",
                table: "Orders",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateTable(
                name: "OrderPaymentProof",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    OrderId = table.Column<Guid>(type: "uuid", nullable: false),
                    ImageUrl = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    Amount = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    ApprovedAmount = table.Column<decimal>(type: "numeric(18,2)", nullable: true),
                    Comment = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    RejectReason = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    ReviewedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ReviewedBy = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OrderPaymentProof", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OrderPaymentProof_Orders_OrderId",
                        column: x => x.OrderId,
                        principalTable: "Orders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PaymentSettings",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PrepaymentPercent = table.Column<int>(type: "integer", nullable: false),
                    PrepaymentForCash = table.Column<bool>(type: "boolean", nullable: false),
                    CashEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    KortiMilliEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    KortiMilliCard = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    KortiMilliHolder = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    AlifPayEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    AlifPayPhone = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    AlifPayHolder = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    CardTransferEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    CardTransferNumber = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    CardTransferHolder = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    CardTransferBank = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    Instructions = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PaymentSettings", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_OrderPaymentProof_OrderId_CreatedAt",
                table: "OrderPaymentProof",
                columns: new[] { "OrderId", "CreatedAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "OrderPaymentProof");

            migrationBuilder.DropTable(
                name: "PaymentSettings");

            migrationBuilder.DropColumn(
                name: "HasPendingPaymentProof",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "PaidAmount",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "PrepaymentPercent",
                table: "Orders");
        }
    }
}
