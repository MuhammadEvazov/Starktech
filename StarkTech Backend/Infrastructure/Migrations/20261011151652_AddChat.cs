using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddChat : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ChatConversation",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CustomerId = table.Column<Guid>(type: "uuid", nullable: false),
                    LastMessageAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastMessagePreview = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    UnreadByStaff = table.Column<int>(type: "integer", nullable: false),
                    UnreadByCustomer = table.Column<int>(type: "integer", nullable: false),
                    IsClosed = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ChatConversation", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ChatConversation_Clients_CustomerId",
                        column: x => x.CustomerId,
                        principalTable: "Clients",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ChatMessage",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ConversationId = table.Column<Guid>(type: "uuid", nullable: false),
                    SenderId = table.Column<Guid>(type: "uuid", nullable: false),
                    SenderName = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    IsFromStaff = table.Column<bool>(type: "boolean", nullable: false),
                    Text = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: true),
                    AttachmentUrl = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    ReplyToId = table.Column<Guid>(type: "uuid", nullable: true),
                    EditedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    ReadAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ChatMessage", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ChatMessage_ChatConversation_ConversationId",
                        column: x => x.ConversationId,
                        principalTable: "ChatConversation",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ChatMessage_ChatMessage_ReplyToId",
                        column: x => x.ReplyToId,
                        principalTable: "ChatMessage",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ChatConversation_CustomerId",
                table: "ChatConversation",
                column: "CustomerId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ChatConversation_LastMessageAt",
                table: "ChatConversation",
                column: "LastMessageAt");

            migrationBuilder.CreateIndex(
                name: "IX_ChatMessage_ConversationId_CreatedAt",
                table: "ChatMessage",
                columns: new[] { "ConversationId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_ChatMessage_ReplyToId",
                table: "ChatMessage",
                column: "ReplyToId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ChatMessage");

            migrationBuilder.DropTable(
                name: "ChatConversation");
        }
    }
}
