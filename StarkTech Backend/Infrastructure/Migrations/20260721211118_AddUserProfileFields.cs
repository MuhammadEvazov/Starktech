using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddUserProfileFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AvatarUrl",
                table: "Clients",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Bio",
                table: "Clients",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "RegisterAt",
                table: "Clients",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<DateTime>(
                name: "UpdatedAt",
                table: "Clients",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AvatarUrl",
                table: "Clients");

            migrationBuilder.DropColumn(
                name: "Bio",
                table: "Clients");

            migrationBuilder.DropColumn(
                name: "RegisterAt",
                table: "Clients");

            migrationBuilder.DropColumn(
                name: "UpdatedAt",
                table: "Clients");
        }
    }
}
