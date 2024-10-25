import { Telegraf } from "telegraf";
import { Command } from "./command.class";
import { IBotContext } from "../context/context.interface";
import { supabase } from "../db";

export class StartCommand extends Command {
  constructor(bot: Telegraf<IBotContext>) {
    super(bot);
  }

  handle(): void {
    this.bot.start(async (ctx) => {
      if (!this.isAllowedChatId(ctx)) {
        if (this.isAllowedUser(ctx)) {
          const { id, type, title } = ctx.update.message.chat as {
            title: string;
            id: number;
            type: string;
          };
          if (type === "supergroup") {
            const message = this.getMeesage({ chatId: id });
            const { data, error } = await supabase
              .from("groups")
              .select("*")
              .eq("group_id", id);
            const currentGroup = data?.at(0);
            if (message && !currentGroup) {
              const error = await this.createGroup(id, title);
              const errorCreateRootMessage = await this.createRootMessage(
                id,
                message,
                ctx
              );
              if (errorCreateRootMessage) {
                ctx.reply("Что-то пошло не так при создание сообщения");
              }
              if (error) {
                ctx.reply(
                  error.code === "23505"
                    ? "Такая группа уже была добалена"
                    : "Группа не была добавлена"
                );
              }
            } else {
              if (error) {
                ctx.reply("Что-то пошло не так!");
              } else if (currentGroup) {
                const errorCreateRootMessage = await this.createRootMessage(
                  id,
                  message,
                  ctx
                );
                if (errorCreateRootMessage) {
                  ctx.reply("Что-то пошло не так при создание сообщения");
                }
              }
            }
          } else {
            ctx.reply("Необходимо сделать бота админом группы");
          }
        }
      } else {
        ctx.reply("Эту группу нельзя добавить в список!");
      }
    });
  }
}
