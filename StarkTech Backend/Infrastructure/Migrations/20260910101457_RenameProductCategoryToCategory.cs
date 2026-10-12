using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class RenameProductCategoryToCategory : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_PortfolioItems_ProductCategories_CategoryId",
                table: "PortfolioItems");

            migrationBuilder.DropForeignKey(
                name: "FK_Products_ProductCategories_CategoryId",
                table: "Products");

            migrationBuilder.DropForeignKey(
                name: "FK_VariantAttributeOptions_ProductCategories_CategoryId",
                table: "VariantAttributeOptions");

            migrationBuilder.RenameTable(
                name: "ProductCategories",
                newName: "Categories");

            migrationBuilder.RenameIndex(
                name: "IX_ProductCategories_Slug",
                table: "Categories",
                newName: "IX_Categories_Slug");

            migrationBuilder.Sql(
                "ALTER TABLE \"Categories\" RENAME CONSTRAINT \"PK_ProductCategories\" TO \"PK_Categories\";");

            migrationBuilder.AddForeignKey(
                name: "FK_PortfolioItems_Categories_CategoryId",
                table: "PortfolioItems",
                column: "CategoryId",
                principalTable: "Categories",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_Products_Categories_CategoryId",
                table: "Products",
                column: "CategoryId",
                principalTable: "Categories",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_VariantAttributeOptions_Categories_CategoryId",
                table: "VariantAttributeOptions",
                column: "CategoryId",
                principalTable: "Categories",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_PortfolioItems_Categories_CategoryId",
                table: "PortfolioItems");

            migrationBuilder.DropForeignKey(
                name: "FK_Products_Categories_CategoryId",
                table: "Products");

            migrationBuilder.DropForeignKey(
                name: "FK_VariantAttributeOptions_Categories_CategoryId",
                table: "VariantAttributeOptions");

            migrationBuilder.Sql(
                "ALTER TABLE \"Categories\" RENAME CONSTRAINT \"PK_Categories\" TO \"PK_ProductCategories\";");

            migrationBuilder.RenameIndex(
                name: "IX_Categories_Slug",
                table: "Categories",
                newName: "IX_ProductCategories_Slug");

            migrationBuilder.RenameTable(
                name: "Categories",
                newName: "ProductCategories");

            migrationBuilder.AddForeignKey(
                name: "FK_PortfolioItems_ProductCategories_CategoryId",
                table: "PortfolioItems",
                column: "CategoryId",
                principalTable: "ProductCategories",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_Products_ProductCategories_CategoryId",
                table: "Products",
                column: "CategoryId",
                principalTable: "ProductCategories",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_VariantAttributeOptions_ProductCategories_CategoryId",
                table: "VariantAttributeOptions",
                column: "CategoryId",
                principalTable: "ProductCategories",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
