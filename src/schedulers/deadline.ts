import cron from "node-cron";
import { ChannelType, type Client } from "discord.js";
import { config, daysUntilYmd, TIMEZONE } from "../config.js";
import { listOpenTasks, type TaskRecord } from "../services/notion.js";

const MORNING_OFFSETS = new Set([0, 1, 3]);

function formatTaskLine(task: TaskRecord, label: string): string {
  const mention = task.assigneeId ? `<@${task.assigneeId}>` : "담당자 없음";
  const due = task.dueDate ?? "마감일 없음";
  return `- ${label} **${task.title || "(제목 없음)"}** · ${mention} · \`${due}\``;
}

async function sendScrumMessage(client: Client, content: string): Promise<void> {
  const channel = await client.channels.fetch(config.discord.scrumChannelId);
  if (!channel || channel.type !== ChannelType.GuildText) {
    console.error("[deadline] 스크럼 채널을 찾을 수 없습니다.");
    return;
  }

  await channel.send(content);
}

export async function notifyMorningDeadlines(client: Client): Promise<void> {
  const tasks = await listOpenTasks();
  const grouped = {
    d3: [] as TaskRecord[],
    d1: [] as TaskRecord[],
    d0: [] as TaskRecord[],
  };

  for (const task of tasks) {
    if (!task.dueDate) {
      continue;
    }

    const remain = daysUntilYmd(task.dueDate);
    if (!MORNING_OFFSETS.has(remain)) {
      continue;
    }

    if (remain === 3) {
      grouped.d3.push(task);
    } else if (remain === 1) {
      grouped.d1.push(task);
    } else {
      grouped.d0.push(task);
    }
  }

  const lines: string[] = [];
  for (const task of grouped.d3) {
    lines.push(formatTaskLine(task, "D-3"));
  }
  for (const task of grouped.d1) {
    lines.push(formatTaskLine(task, "D-1"));
  }
  for (const task of grouped.d0) {
    lines.push(formatTaskLine(task, "오늘 마감"));
  }

  if (lines.length === 0) {
    console.log("[deadline] 오전 알림 대상 태스크가 없습니다.");
    return;
  }

  await sendScrumMessage(client, ["⏰ 마감일 알림 (10:00 KST)", ...lines].join("\n"));
}

export async function notifySameDayDeadlines(client: Client): Promise<void> {
  const tasks = (await listOpenTasks()).filter((task) => task.dueDate && daysUntilYmd(task.dueDate) === 0);

  if (tasks.length === 0) {
    console.log("[deadline] 당일 마감 리마인드 대상이 없습니다.");
    return;
  }

  const lines = tasks.map((task) => formatTaskLine(task, "오늘 마감 리마인드"));
  await sendScrumMessage(client, ["🔔 당일 마감 리마인드 (22:00 KST)", ...lines].join("\n"));
}

export function startDeadlineScheduler(client: Client): void {
  cron.schedule(
    "0 10 * * *",
    () => {
      void notifyMorningDeadlines(client).catch((error: unknown) => {
        console.error("[deadline] 오전 마감 알림 실패", error);
      });
    },
    { timezone: TIMEZONE },
  );

  cron.schedule(
    "0 22 * * *",
    () => {
      void notifySameDayDeadlines(client).catch((error: unknown) => {
        console.error("[deadline] 22시 마감 리마인드 실패", error);
      });
    },
    { timezone: TIMEZONE },
  );

  console.log("[deadline] 매일 10:00 / 22:00 KST 스케줄러를 등록했습니다.");
}
