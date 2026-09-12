import { Events, type Client, type Message } from "discord.js";
import { findNearestInProgressTask, markTaskDone } from "../services/notion.js";

const COMPLETION_TRIGGER = "완료했습니다";

function isCompletionMessage(content: string): boolean {
  return content.replace(/\s+/g, "").includes(COMPLETION_TRIGGER);
}

async function handleCompletion(message: Message): Promise<void> {
  if (message.author.bot || !message.inGuild() || !isCompletionMessage(message.content)) {
    return;
  }

  try {
    const task = await findNearestInProgressTask(message.author.id);

    if (!task) {
      await message.reply("진행 중인 태스크가 없습니다. 노션의 담당자ID가 디스코드 유저 ID와 일치하는지 확인해 주세요.");
      return;
    }

    await markTaskDone(task.pageId);

    const due = task.dueDate ? ` (마감일: \`${task.dueDate}\`)` : "";
    await message.reply(`✅ <@${message.author.id}>님의 태스크 **${task.title}**을(를) 완료 처리했습니다.${due}`);
  } catch (error) {
    console.error("[completion] 완료 처리 실패", error);
    await message.reply("노션 상태를 완료로 바꾸지 못했습니다. 잠시 후 다시 시도해 주세요.");
  }
}

export function bindCompletionListener(client: Client): void {
  client.on(Events.MessageCreate, (message) => {
    void handleCompletion(message);
  });
}
