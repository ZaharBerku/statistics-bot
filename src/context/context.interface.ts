import { Context } from "telegraf";

export interface SessionData {
  coursLike: boolean;
  groupChats: Set<number>;
}

export interface IBotContext extends Context {
  session: SessionData;
}
