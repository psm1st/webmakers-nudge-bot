import cron from "node-cron";
import { type Client, type TextBasedChannel } from "discord.js";
import { config, nowKst, PARTS, TIMEZONE } from "../config.js";

function mention(userId: string): string {
  return `<@${userId}>`;
}

async function getTextChannel(client: Client, channelId: string): Promise<TextBasedChannel | null> {
  const channel = await client.channels.fetch(channelId).catch((error: unknown) => {
    console.error(`[scrum] 채널 조회 실패: ${channelId}`, error);
    return null;
  });

  if (!channel || !channel.isTextBased()) {
    return null;
  }

  return channel;
}

async function leadPostedAfter(
  channel: TextBasedChannel,
  leadId: string,
  afterMs: number,
): Promise<boolean> {
  if (!("messages" in channel)) {
    return false;
  }

  let before: string | undefined;

  for (let page = 0; page < 5; page += 1) {
    const batch = await channel.messages.fetch({
      limit: 100,
      ...(before ? { before } : {}),
    });

    if (batch.size === 0) {
      return false;
    }

    const messages = [...batch.values()].sort((a, b) => b.createdTimestamp - a.createdTimestamp);

    for (const message of messages) {
      if (message.createdTimestamp >= afterMs && message.author.id === leadId) {
        return true;
      }
    }

    const oldest = messages[messages.length - 1];
    if (!oldest || oldest.createdTimestamp < afterMs) {
      return false;
    }

    before = oldest.id;
  }

  return false;
}

export async function sendMondayScrumPing(client: Client): Promise<void> {
  const channel = await getTextChannel(client, config.discord.scrumChannelId);
  if (!channel || !("send" in channel)) {
    console.error("[scrum] 스크럼 채널을 찾을 수 없습니다.");
    return;
  }

  const content =
    `기획(${mention(config.leads.plan)}), ` +
    `디자인(${mention(config.leads.design)}), ` +
    `프론트엔드(${mention(config.leads.frontend)}), ` +
    `백엔드(${mention(config.leads.backend)}) ` +
    "스크럼 시간입니다! 각 채널에 스크럼을 진행해주세요!";

  await channel.send(content);
}

export async function remindMissingScrumLeads(client: Client): Promise<void> {
  const afterMs = nowKst().startOf("day").hour(10).minute(0).second(0).millisecond(0).valueOf();
  const missingLeadIds: string[] = [];

  for (const part of PARTS) {
    const partChannel = await getTextChannel(client, part.channelId);
    if (!partChannel) {
      console.warn(`[scrum] ${part.label} 채널을 확인하지 못해 미작성으로 처리합니다.`);
      missingLeadIds.push(part.leadId);
      continue;
    }

    const posted = await leadPostedAfter(partChannel, part.leadId, afterMs).catch((error: unknown) => {
      console.error(`[scrum] ${part.label} 채널 메시지 조회 실패`, error);
      return false;
    });

    if (!posted) {
      missingLeadIds.push(part.leadId);
    }
  }

  if (missingLeadIds.length === 0) {
    console.log("[scrum] 모든 파트 리드가 스크럼을 작성했습니다.");
    return;
  }

  const scrumChannel = await getTextChannel(client, config.discord.scrumChannelId);
  if (!scrumChannel || !("send" in scrumChannel)) {
    console.error("[scrum] 스크럼 채널을 찾을 수 없습니다.");
    return;
  }

  const mentions = [...new Set(missingLeadIds)].map(mention).join(" ");
  await scrumChannel.send(`(${mentions}) 금일 21:30까지 스크럼을 남겨주세요!`);
}

export function startScrumScheduler(client: Client): void {
  cron.schedule(
    "0 10 * * 1",
    () => {
      void sendMondayScrumPing(client).catch((error: unknown) => {
        console.error("[scrum] 월요일 10시 알림 실패", error);
      });
    },
    { timezone: TIMEZONE },
  );

  cron.schedule(
    "0 21 * * 1",
    () => {
      void remindMissingScrumLeads(client).catch((error: unknown) => {
        console.error("[scrum] 월요일 21시 리마인드 실패", error);
      });
    },
    { timezone: TIMEZONE },
  );

  console.log("[scrum] 월요일 10:00 / 21:00 KST 스케줄러를 등록했습니다.");
}
