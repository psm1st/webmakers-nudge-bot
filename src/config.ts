import "dotenv/config";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat.js";
import timezone from "dayjs/plugin/timezone.js";
import utc from "dayjs/plugin/utc.js";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);

export const TIMEZONE = "Asia/Seoul";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`필수 환경 변수가 없습니다: ${name}`);
  }
  return value;
}

export const config = {
  discord: {
    token: required("DISCORD_BOT_TOKEN"),
    clientId: required("DISCORD_CLIENT_ID"),
    guildId: required("DISCORD_GUILD_ID"),
    pmRoleId: required("PM_ROLE_ID"),
    scrumChannelId: required("SCRUM_CHANNEL_ID"),
  },
  notion: {
    apiKey: required("NOTION_API_KEY"),
    databaseId: required("NOTION_DATABASE_ID"),
  },
  leads: {
    plan: required("LEAD_PLAN_ID"),
    design: required("LEAD_DESIGN_ID"),
    frontend: required("LEAD_FE_ID"),
    backend: required("LEAD_BE_ID"),
  },
  channels: {
    plan: required("CH_PLAN_ID"),
    design: required("CH_DESIGN_ID"),
    frontend: required("CH_FE_ID"),
    backend: required("CH_BE_ID"),
  },
} as const;

export const NOTION_PROPS = {
  title: "테스크명 ",
  assigneeId: "담당자 ID",
  dueDate: "마감일",
  status: "상태",
} as const;

export const TASK_STATUS = {
  inProgress: "진행 중",
  done: "완료",
} as const;

export type PartKey = "plan" | "design" | "frontend" | "backend";

export interface PartConfig {
  key: PartKey;
  label: string;
  leadId: string;
  channelId: string;
}

export const PARTS: readonly PartConfig[] = [
  { key: "plan", label: "기획", leadId: config.leads.plan, channelId: config.channels.plan },
  { key: "design", label: "디자인", leadId: config.leads.design, channelId: config.channels.design },
  { key: "frontend", label: "프론트엔드", leadId: config.leads.frontend, channelId: config.channels.frontend },
  { key: "backend", label: "백엔드", leadId: config.leads.backend, channelId: config.channels.backend },
] as const;

export function nowKst(): dayjs.Dayjs {
  return dayjs().tz(TIMEZONE);
}

export function parseYmd(input: string): dayjs.Dayjs | null {
  const parsed = dayjs.tz(input, "YYYY-MM-DD", TIMEZONE);
  if (!parsed.isValid() || parsed.format("YYYY-MM-DD") !== input) {
    return null;
  }
  return parsed.startOf("day");
}

export function todayYmd(): string {
  return nowKst().format("YYYY-MM-DD");
}

export function daysUntilYmd(dateStr: string): number {
  const due = parseYmd(dateStr);
  if (!due) {
    return Number.POSITIVE_INFINITY;
  }
  return due.diff(nowKst().startOf("day"), "day");
}

export { dayjs };
