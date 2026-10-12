using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <summary>
    /// Repairs the damage done by 20260721211118_AddUserProfileFields, which added
    /// Clients.RegisterAt and Clients.UpdatedAt with defaultValue DateTime.MinValue.
    /// Npgsql stores that as '-infinity', so every row that existed before that migration
    /// lost its real registration date, and the column DEFAULT kept producing '-infinity'
    /// for any insert that omitted the column.
    /// </summary>
    public partial class FixClientRegisterAtBackfill : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Idempotent: only touches rows still holding the sentinel value.
            migrationBuilder.Sql(@"
                UPDATE ""Clients""
                SET ""RegisterAt"" = ""CreatedAt""
                WHERE ""RegisterAt"" = '-infinity'::timestamptz;");

            migrationBuilder.Sql(@"
                UPDATE ""Clients""
                SET ""UpdatedAt"" = ""CreatedAt""
                WHERE ""UpdatedAt"" = '-infinity'::timestamptz;");

            // Drop the poisoned defaults. CreatedAt has no DB default either: the
            // application always supplies these values, so an omitted column should
            // fail loudly rather than silently store '-infinity'.
            migrationBuilder.Sql(@"ALTER TABLE ""Clients"" ALTER COLUMN ""RegisterAt"" DROP DEFAULT;");
            migrationBuilder.Sql(@"ALTER TABLE ""Clients"" ALTER COLUMN ""UpdatedAt"" DROP DEFAULT;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Restores the previous schema only. The backfilled dates are deliberately
            // not reverted: the sentinel values they replaced carried no information.
            migrationBuilder.Sql(@"ALTER TABLE ""Clients"" ALTER COLUMN ""RegisterAt"" SET DEFAULT '-infinity'::timestamptz;");
            migrationBuilder.Sql(@"ALTER TABLE ""Clients"" ALTER COLUMN ""UpdatedAt"" SET DEFAULT '-infinity'::timestamptz;");
        }
    }
}
