import { NarrowedContext, Telegraf } from "telegraf";
import { Command } from "./command.class";
import { IBotContext } from "../context/context.interface";
import { supabase } from "../db";
import { Message, Update } from "telegraf/typings/core/types/typegram";
import { PostgrestError } from "@supabase/supabase-js";

const calculateExpression = (expr: string) => {
  const [initialValue, percentage] = expr.split("-");
  const numericValue = parseFloat(initialValue);
  const numericPercentage = parseFloat(percentage);
  const discount = (numericValue * numericPercentage) / 100;
  const finalValue = numericValue - discount;
  return { finalValue, value: numericValue, percentage: numericPercentage };
};

type MessageType = {
  text: string;
  created_at: string;
  group_id: number;
  id: string;
  message_id: number;
};

type RootMessageType = {
  message: MessageType;
  isTodayMessage: boolean;
};

export class MessageCommand extends Command {
  constructor(bot: Telegraf<IBotContext>) {
    super(bot);
  }

  private async updateMessageAndReply(
    ctx: NarrowedContext<IBotContext, Update.MessageUpdate<Message>>,
    chatId: number,
    currentMessage: MessageType
  ) {
    if (currentMessage?.message_id) {
      const message = await this.getStartMessageAndUpdatePaidSum(
        chatId,
        currentMessage.created_at
      );
      try {
        await ctx.telegram.editMessageText(
          chatId,
          currentMessage.message_id,
          undefined,
          message,
          {
            parse_mode: "HTML",
          }
        );
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (error) {
        console.log("updateMessageAndReply editMessageText");
      }
    } else {
      ctx.reply("Что-то пошло не так!");
    }
  }

  private handleDatabaseError(ctx: IBotContext, error: PostgrestError | null) {
    if (error) {
      ctx.reply("Что-то пошло не так!");
      return true;
    }
    return false;
  }

  private extractReplyMessageId(ctx: IBotContext): number | undefined {
    return (ctx.message as { reply_to_message?: { message_id: number } })
      .reply_to_message?.message_id;
  }

  private async executeEntryCommand(
    ctx: NarrowedContext<IBotContext, Update.MessageUpdate<Message>>,
    chatId: number,
    messageId: number,
    expression: string | undefined,
    currentMessage: RootMessageType
  ) {
    if (expression) {
      const { finalValue, value, percentage } = calculateExpression(expression);
      const { error } = await supabase
        .from("statistics")
        .insert([
          {
            sum: value,
            calc_sum: finalValue,
            percentage,
            message_id: messageId,
            group_id: chatId,
          },
        ])
        .select();
      const isError = this.handleDatabaseError(ctx, error);
      if (!isError) {
        await this.updateMessageAndReply(ctx, chatId, currentMessage.message);
      }
    } else {
      ctx.reply("Забыли написать выражение после двоеточия!");
    }
  }

  entryCommand = async (
    ctx: NarrowedContext<IBotContext, Update.MessageUpdate<Message>>
  ) => {
    if(!this.isAllowedUser(ctx)) return
    const currentMessage = await this.getCurrentMessage(ctx.message.chat.id);
    if ("message" in currentMessage && "code" in currentMessage) {
      ctx.reply("Что-то пошло не так!");
      return;
    }
    if (!currentMessage.isTodayMessage) {
      ctx.reply(
        "Cообщение устарело, на сегодня необходимо создать новое с командой /start"
      );
      return;
    }
    const chatId = ctx.message.chat.id;
    const messageId = ctx.message.message_id;
    const expression = (ctx.message as { text: string }).text.split(" ").at(1);
    await this.executeEntryCommand(
      ctx,
      chatId,
      messageId,
      expression,
      currentMessage
    );
  };

  async getCommonStat(
    ctx: NarrowedContext<IBotContext, Update.MessageUpdate<Message>>
  ) {
    const chatId = ctx.message.chat.id;
    const { data, error } = await supabase
      .from("statistics")
      .select("*")
      .eq("group_id", chatId);
    const fullSum = data?.reduce(
      (item, message) => +(item + message.sum).toFixed(2),
      0
    );
    const fullPaidSum = data?.reduce(
      (item, message) =>
        message.is_paid
          ? +(item + message.calc_sum / message.course).toFixed(2)
          : item,
      0
    );
    if (error) {
      ctx.reply("Что-то пошло не так!");
      return;
    }

    ctx.reply(
      `📦 <b>Общая сумма:</b> ${fullSum}\n💸 <b>Выплачено:</b> <i>${fullPaidSum} $</i>`,
      {
        parse_mode: "HTML",
      }
    );
  }

  async cancelCommand(
    ctx: NarrowedContext<IBotContext, Update.MessageUpdate<Message>>
  ) {
    if(!this.isAllowedUser(ctx)) return
    const chatId = ctx.message.chat.id;
    const replyMessageId = this.extractReplyMessageId(ctx);

    if (replyMessageId) {
      const { data } = await supabase
        .from("statistics")
        .select("*")
        .eq("message_id", replyMessageId);

      const { error } = await supabase
        .from("statistics")
        .delete()
        .eq("message_id", replyMessageId);

      const message = await this.getCurrentMessageByDate(
        chatId,
        data?.at(0).created_at
      );
      const isError = this.handleDatabaseError(ctx, error);
      if (!isError) {
        await this.updateMessageAndReply(ctx, chatId, message);
      }
    } else {
      ctx.reply("Выберите сообщение!");
    }
  }

  async calculationCommand(
    ctx: NarrowedContext<IBotContext, Update.MessageUpdate<Message>>
  ) {
    if(!this.isAllowedUser(ctx)) return
    const chatId = ctx.message.chat.id;
    const replyMessageId = this.extractReplyMessageId(ctx);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [_, course, messageId] = (ctx.message as { text: string }).text.split(
      " "
    );

    if (replyMessageId || messageId) {
      const { error, data } = await supabase
        .from("statistics")
        .update({ course })
        .eq("message_id", replyMessageId || Number(messageId))
        .select();
      const message = await this.getCurrentMessageByDate(
        chatId,
        data?.at(0).created_at
      );
      if ("message" in message && "code" in message) {
        ctx.reply("Что-то пошло не так!");
      }
      const isError = this.handleDatabaseError(ctx, error);
      if (!isError) {
        await this.updateMessageAndReply(ctx, chatId, message);
      } else {
        ctx.reply("Что-то пошло не так! calculationCommand");
      }
    } else {
      ctx.reply("Выберите сообщение!");
    }
  }

  async calcChat(
    ctx: NarrowedContext<IBotContext, Update.MessageUpdate<Message>>
  ) {
    if(!this.isAllowedUser(ctx)) return
    const chatId = ctx.message.chat.id;
    const { data } = await supabase
      .from("statistics")
      .select("*")
      .eq("is_paid", false)
      .not("course", "is", null);
    if (data) {
      const { error } = await supabase
        .from("statistics")
        .update({ is_paid: true })
        .not("course", "is", null);

      const uniqueDates = Array.from(
        new Set(data.map((item) => item.created_at.split("T")[0]))
      );
      const messagesByDate = await Promise.all(
        uniqueDates.map((item) => {
          return this.getCurrentMessageByDate(chatId, item);
        })
      );

      const isError = this.handleDatabaseError(ctx, error);
      if (!isError) {
        try {
          await Promise.allSettled(
            messagesByDate.map((message) => {
              return this.updateMessageAndReply(ctx, chatId, message);
            })
          );
        } catch (error) {
          console.log(error);
        }
      }
    }
  }

  handle(): void {
    this.bot.on("message", async (ctx) => {
      const message = (ctx.message as { text: string }).text;
      if (!message) return;

      const commandMapping: {
        [key: string]: (
          ctx: NarrowedContext<IBotContext, Update.MessageUpdate<Message>>
        ) => Promise<void>;
      } = {
        Заход: this.entryCommand,
        Отмена: this.cancelCommand,
        Расчет: this.calculationCommand,
        "Чат рассчитан": this.calcChat,
        Статистика: this.getCommonStat,
      };

      for (const [key, command] of Object.entries(commandMapping)) {
        if (message.startsWith(key)) {
          await command.call(this, ctx);
          return;
        }
      }
    });
  }
}
