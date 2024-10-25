import { Telegraf } from "telegraf";
import { Command } from "./command.class";
import { IBotContext } from "../context/context.interface";
import { supabase } from "../db";

export class SendingMessages extends Command {
  constructor(bot: Telegraf<IBotContext>) {
    super(bot);
  }
  handle(): void {
    this.bot.command("sending_messages", async (ctx) => {
      if (this.isAllowedChatId(ctx)) {
        const message = ctx.payload;
        if (message) {
          const { data: groups } = await supabase
            .from("groups")
            .select("group_id");
          if (groups?.length) {
            try {
              const sendingMessage = groups?.map(({ group_id }) =>
                this.sendMessageToGroup(group_id as number, message)
              );
              if (sendingMessage) {
                await Promise.all(sendingMessage);
              }
            } catch (error) {
              console.log(error);
              ctx.reply("Что-то пошло не так!");
            }
          } else {
            ctx.reply("Пока что список групп пуст!");
          }
        } else {
          ctx.reply("Вы забыли написать сообщение!");
        }
      }
    });
  }
}
