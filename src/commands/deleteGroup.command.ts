import { Telegraf } from "telegraf";
import { Command } from "./command.class";
import { IBotContext } from "../context/context.interface";
import { supabase } from "../db";

export class DeleteGroup extends Command {
  constructor(bot: Telegraf<IBotContext>) {
    super(bot);
  }
  handle(): void {
    this.bot.command("delete_group", async (ctx) => {
      if (this.isAllowedChatId(ctx)) {
        const groupId = ctx.payload;
        if (groupId) {
          const { error } = await supabase
            .from("groups")
            .delete()
            .eq("group_id", groupId);
          if (error) {
            ctx.reply("Такой группы нет или вы не правильно вписали id!");
          } else {
            ctx.reply("Группа была удалена!");
          }
        } else {
          ctx.reply(
            "После комад, через пробел надо написать id группы. Id вы можете получить с командой /groups"
          );
        }
      }
    });
  }
}
