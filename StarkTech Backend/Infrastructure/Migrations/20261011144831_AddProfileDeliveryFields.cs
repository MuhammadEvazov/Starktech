using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddProfileDeliveryFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "DefaultDeliveryAddress",
                table: "Clients",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "DefaultDeliveryCityId",
                table: "Clients",
                type: "uuid",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "DefaultDeliveryAddress",
                table: "Clients");

            migrationBuilder.DropColumn(
                name: "DefaultDeliveryCityId",
                table: "Clients");
        }
    }
}
