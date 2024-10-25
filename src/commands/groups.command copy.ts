import { Telegraf } from "telegraf";
import { Command } from "./command.class";
import { IBotContext } from "../context/context.interface";
import { supabase } from "../db";

export class Groups extends Command {
  constructor(bot: Telegraf<IBotContext>) {
    super(bot);
  }
  handle(): void {
    this.bot.command("groups", async (ctx) => {
      if (this.isAllowedChatId(ctx)) {
        const { data: groups, error } = await supabase
          .from("groups")
          .select("group_id, title");
        if (error) {
          ctx.reply("Что-то пошло не так");
        } else if (!groups.length) {
          ctx.reply("Пока что список групп пуст!");
        } else {
          const groupsList = groups
            .map(({ group_id, title }) => `${title} (${group_id})`)
            .join("\n");
          ctx.reply(`Список групп:\n${groupsList}`);
        }
      }
    });
  }
}
