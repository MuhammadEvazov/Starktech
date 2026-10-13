using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AuditFixes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Reviews_UserId",
                table: "Reviews");

            migrationBuilder.DropIndex(
                name: "IX_Orders_UserId",
                table: "Orders");

            migrationBuilder.AddColumn<int>(
                name: "MaxUsagesPerUser",
                table: "PromoCodes",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "QuantityTiersJson",
                table: "Products",
                type: "text",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "OrderLayout",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    OrderId = table.Column<Guid>(type: "uuid", nullable: false),
                    ImageUrl = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    Note = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    CustomerComment = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    RespondedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UploadedBy = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OrderLayout", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OrderLayout_Orders_OrderId",
                        column: x => x.OrderId,
                        principalTable: "Orders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Reviews_UserId_ProductId",
                table: "Reviews",
                columns: new[] { "UserId", "ProductId" },
                unique: true);

            migrationBuilder.AddCheckConstraint(
                name: "CK_PromoCodes_DiscountValue_NonNegative",
                table: "PromoCodes",
                sql: "\"DiscountValue\" >= 0");

            migrationBuilder.AddCheckConstraint(
                name: "CK_PromoCodes_MaxUsages_Positive",
                table: "PromoCodes",
                sql: "\"MaxUsages\" IS NULL OR \"MaxUsages\" >= 1");

            migrationBuilder.AddCheckConstraint(
                name: "CK_PromoCodes_MaxUsagesPerUser_Positive",
                table: "PromoCodes",
                sql: "\"MaxUsagesPerUser\" IS NULL OR \"MaxUsagesPerUser\" >= 1");

            migrationBuilder.AddCheckConstraint(
                name: "CK_PaymentSettings_PrepaymentPercent",
                table: "PaymentSettings",
                sql: "\"PrepaymentPercent\" BETWEEN 0 AND 100");

            migrationBuilder.CreateIndex(
                name: "IX_Orders_PaymentStatus",
                table: "Orders",
                column: "PaymentStatus");

            migrationBuilder.CreateIndex(
                name: "IX_Orders_Status_CreatedAt",
                table: "Orders",
                columns: new[] { "Status", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_Orders_UserId_CreatedAt",
                table: "Orders",
                columns: new[] { "UserId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_OrderPaymentProof_Pending",
                table: "OrderPaymentProof",
                column: "CreatedAt",
                filter: "\"Status\" = 0");

            migrationBuilder.AddCheckConstraint(
                name: "CK_ComboOffers_DiscountValue_NonNegative",
                table: "ComboOffers",
                sql: "\"DiscountValue\" >= 0");

            migrationBuilder.CreateIndex(
                name: "IX_Clients_DefaultDeliveryCityId",
                table: "Clients",
                column: "DefaultDeliveryCityId");

            migrationBuilder.CreateIndex(
                name: "IX_OrderLayout_OrderId_CreatedAt",
                table: "OrderLayout",
                columns: new[] { "OrderId", "CreatedAt" });

            migrationBuilder.AddForeignKey(
                name: "FK_Clients_DeliveryCities_DefaultDeliveryCityId",
                table: "Clients",
                column: "DefaultDeliveryCityId",
                principalTable: "DeliveryCities",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Clients_DeliveryCities_DefaultDeliveryCityId",
                table: "Clients");

            migrationBuilder.DropTable(
                name: "OrderLayout");

            migrationBuilder.DropIndex(
                name: "IX_Reviews_UserId_ProductId",
                table: "Reviews");

            migrationBuilder.DropCheckConstraint(
                name: "CK_PromoCodes_DiscountValue_NonNegative",
                table: "PromoCodes");

            migrationBuilder.DropCheckConstraint(
                name: "CK_PromoCodes_MaxUsages_Positive",
                table: "PromoCodes");

            migrationBuilder.DropCheckConstraint(
                name: "CK_PromoCodes_MaxUsagesPerUser_Positive",
                table: "PromoCodes");

            migrationBuilder.DropCheckConstraint(
                name: "CK_PaymentSettings_PrepaymentPercent",
                table: "PaymentSettings");

            migrationBuilder.DropIndex(
                name: "IX_Orders_PaymentStatus",
                table: "Orders");

            migrationBuilder.DropIndex(
                name: "IX_Orders_Status_CreatedAt",
                table: "Orders");

            migrationBuilder.DropIndex(
                name: "IX_Orders_UserId_CreatedAt",
                table: "Orders");

            migrationBuilder.DropIndex(
                name: "IX_OrderPaymentProof_Pending",
                table: "OrderPaymentProof");

            migrationBuilder.DropCheckConstraint(
                name: "CK_ComboOffers_DiscountValue_NonNegative",
                table: "ComboOffers");

            migrationBuilder.DropIndex(
                name: "IX_Clients_DefaultDeliveryCityId",
                table: "Clients");

            migrationBuilder.DropColumn(
                name: "MaxUsagesPerUser",
                table: "PromoCodes");

            migrationBuilder.DropColumn(
                name: "QuantityTiersJson",
                table: "Products");

            migrationBuilder.CreateIndex(
                name: "IX_Reviews_UserId",
                table: "Reviews",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_Orders_UserId",
                table: "Orders",
                column: "UserId");
        }
    }
}
