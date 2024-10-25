import { Context, NarrowedContext, Telegraf } from "telegraf";
import { IBotContext } from "../context/context.interface";
import { Update, Message } from "telegraf/typings/core/types/typegram";
import { CommandContextExtn } from "telegraf/typings/telegram-types";
import { supabase } from "../db";
import { getDate } from "../utils/getDate";
import "dotenv/config";

type DataStatType = {
  sum: number;
  percentage: number;
  calc_sum: number;
};

export abstract class Command {
  allowedChatId: string;
  allowedUsers: string;

  constructor(public bot: Telegraf<IBotContext>) {
    this.allowedChatId = process.env.ALLOWED_CHAT_ID as string;
    this.allowedUsers = process.env.ALLOWED_USERS as string;
  }

  abstract handle(): void;

  getMeesage({
    chatId,
    fullSum = 0,
    paidSum = 0,
    toPaySum = 0,
    stat = "",
    currentDate,
  }: {
    chatId: number;
    fullSum?: number;
    toPaySum?: number;
    paidSum?: number;
    stat?: string;
    currentDate?: string;
  }) {
    const date = getDate(currentDate);
    const message = `Начало работы: ${date}\n\n📟 <b>Айди чата:</b> <i>${chatId}</i>\n\n\n📈 <b>Статистика:</b>\n${stat}\n\n📦 <b>Общая сумма:</b> ${fullSum} \n📤 <b>К выплате:</b> ${toPaySum}\n💸 <b>Выплачено:</b> <i>${paidSum} $</i>`;
    return message;
  }

  getStat(data: DataStatType[]) {
    if (!data) {
      return "";
    }
    const stat = data?.reduce((item, stat) => {
      item += `\n💰${stat.sum}-${stat.percentage}% = ${stat.calc_sum}`;
      return item;
    }, "");
    return stat;
  }

  async getFullCommonSum(chatId: number, date: string) {
    const currentDate = new Date(date);
    const startOfDay = new Date(currentDate.setHours(0, 0, 0, 0)).toISOString();
    const endOfDay = new Date(
      currentDate.setHours(23, 59, 59, 999)
    ).toISOString();
    const { data } = await supabase
      .from("statistics")
      .select("*")
      .eq("group_id", chatId)
      .gte("created_at", startOfDay)
      .lte("created_at", endOfDay);
    const fullSum = data?.reduce(
      (item, message) => +(item + message.sum).toFixed(2),
      0
    );
    const fullToPaidSum = data?.reduce(
      (item, message) =>
        message.course && !message.is_paid
          ? +(item + message.calc_sum / message.course).toFixed(2)
          : item,
      0
    );

    const fullPaidSum = data?.reduce(
      (item, message) =>
        message.is_paid
          ? +(item + message.calc_sum / message.course).toFixed(2)
          : item,
      0
    );

    const stat = this.getStat(data as DataStatType[]);
    return { fullSum, fullToPaidSum, stat, fullPaidSum };
  }

  async getStartMessageAndUpdatePaidSum(chatId: number, date: string) {
    const { fullToPaidSum, fullSum, stat, fullPaidSum } =
      await this.getFullCommonSum(chatId, date);
    return this.getMeesage({
      chatId,
      fullSum,
      toPaySum: fullToPaidSum,
      stat,
      paidSum: fullPaidSum,
      currentDate: date,
    });
  }

  isAllowedChatId(
    ctx: Context<{
      message: Update.New & Update.NonChannel & Message.TextMessage;
      update_id: number;
    }> &
      Omit<IBotContext, keyof Context<Update>> &
      CommandContextExtn
  ) {
    const chatId = ctx.update.message.chat.id;
    return `${chatId}` === this.allowedChatId;
  }

  isAllowedUser(
    ctx: NarrowedContext<IBotContext, Update.MessageUpdate<Message>>
  ) {
    const userId = ctx.message.from.id;
    return this.allowedUsers.includes(`${userId}`);
  }

  async sendMessageToGroup(groupId: number, message: string) {
    try {
      await this.bot.telegram.sendMessage(groupId, message);
      console.log(`Message sent to group ${groupId}`);
    } catch (error) {
      console.error(`Failed to send message to group ${groupId}:`, error);
    }
  }

  async getCurrentMessageByDate(groupId: number, date: string) {
    const currentDate = new Date(date);
    const startOfDay = new Date(currentDate.setHours(0, 0, 0, 0)).toISOString();
    const endOfDay = new Date(
      currentDate.setHours(23, 59, 59, 999)
    ).toISOString();
    const { data: messages, error } = await supabase
      .from("messages")
      .select("*")
      .eq("group_id", groupId)
      .gte("created_at", startOfDay)
      .lte("created_at", endOfDay)
      .limit(1);
    if (error) {
      console.error("Error fetching messages:", error);
      return error;
    }
    const message = messages[0];
    return message;
  }

  async getCurrentMessage(groupId: number) {
    const { data: messages, error } = await supabase
      .from("messages")
      .select("*")
      .order("created_at", { ascending: false })
      .eq("group_id", groupId)
      .limit(1);

    if (error) {
      console.error("Error fetching messages:", error);
      return error;
    }
    const message = messages[0];
    if (
      message &&
      new Date(message.created_at).toDateString() === new Date().toDateString()
    ) {
      return { message, isTodayMessage: true };
    } else {
      return { message, isTodayMessage: false };
    }
  }

  async createRootMessage(
    groupId: number,
    message: string,
    ctx: NarrowedContext<IBotContext, Update.MessageUpdate<Message>>
  ) {
    const { data: messages, error } = await supabase
      .from("messages")
      .select("*")
      .order("created_at", { ascending: false })
      .eq("group_id", groupId)
      .limit(1);

    if (error) {
      console.error("Error fetching messages:", error);
      return error;
    }
    const lastMessage = messages[0];
    if (
      lastMessage &&
      new Date(lastMessage.created_at).toDateString() ===
        new Date().toDateString()
    ) {
      ctx.reply("Сообщение уже было отправлено на сегодня");
    } else {
      const sentMessage = await ctx.telegram.sendMessage(groupId, message, {
        parse_mode: "HTML",
      });

      await ctx.telegram.pinChatMessage(groupId, sentMessage.message_id);
      const { error } = await supabase
        .from("messages")
        .insert([
          {
            group_id: groupId,
            text: message,
            message_id: sentMessage.message_id,
          },
        ])
        .select();

      return error;
    }
  }
  async createGroup(id: number, title: string) {
    const { error } = await supabase
      .from("groups")
      .insert([
        {
          group_id: id,
          title,
        },
      ])
      .select();
    return error;
  }
}
