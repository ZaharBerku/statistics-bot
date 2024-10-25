import { Telegraf } from "telegraf";
import { Command } from "./command.class";
import { IBotContext } from "../context/context.interface";

export class SendingMessage extends Command {
  constructor(bot: Telegraf<IBotContext>) {
    super(bot);
  }
  handle(): void {
    this.bot.command("sending_message", async (ctx) => {
      if (this.isAllowedChatId(ctx)) {
        const payload = ctx.payload;
        if (payload) {
          const [id, ...message] = payload.split(" ");
          if (message && id) {
            try {
              this.sendMessageToGroup(+id, message.join(" "));
            } catch (error) {
              console.log(error);
              ctx.reply("Что-то пошло не так!");
            }
          } else {
            ctx.reply("Вы забыли написать сообщение или id!");
          }
        }
      }
    });
  }
}
