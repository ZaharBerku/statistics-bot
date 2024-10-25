import { Telegraf } from "telegraf";
import { Command } from "./command.class";
import { IBotContext } from "../context/context.interface";

export class Help extends Command {
  constructor(bot: Telegraf<IBotContext>) {
    super(bot);
  }
  handle(): void {
    this.bot.command("help", async (ctx) => {
      if (this.isAllowedChatId(ctx)) {
        const helpMessage = `/start - Добавить группу в базу данных (вызывать только в группе которую хотите добавить)\n/groups - Показать список групп\n/delete_group [id] - Удалить группу\n/sending_messages - Отправить сообщение во все добавленные группы\n/sending_message [id] [сообщение] - Отправить сообщение в группу\n/help - Показать список доступных команд\n`;
        ctx.reply(helpMessage);
      }
    });
  }
}
