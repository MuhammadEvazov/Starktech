using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddOrderItemPhotoCopies : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "Copies",
                table: "OrderItemPhotos",
                type: "integer",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.AddCheckConstraint(
                name: "CK_OrderItemPhotos_Copies_Positive",
                table: "OrderItemPhotos",
                sql: "\"Copies\" >= 1");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_OrderItemPhotos_Copies_Positive",
                table: "OrderItemPhotos");

            migrationBuilder.DropColumn(
                name: "Copies",
                table: "OrderItemPhotos");
        }
    }
}
