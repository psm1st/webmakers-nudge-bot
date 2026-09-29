import {
  ActionRowBuilder,
  ComponentType,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import { daysUntilYmd } from "../config.js";
import { listOpenTasksByAssignee, markTaskDone, type TaskRecord } from "../services/notion.js";

const SELECT_TIMEOUT_MS = 60_000;
const MAX_SELECT_OPTIONS = 25;
const NO_TASK_MESSAGE = "배정된 태스크가 없습니다. 노션의 담당자 ID가 디스코드 유저 ID와 일치하는지 확인해 주세요.";

export const data = new SlashCommandBuilder()
  .setName("태스크")
  .setDescription("내 태스크 확인 및 완료 처리")
  .addSubcommand((sub) => sub.setName("확인하기").setDescription("나에게 배정된 태스크를 확인합니다."))
  .addSubcommand((sub) => sub.setName("완료하기").setDescription("내 태스크 중 완료한 항목을 체크합니다."));

function formatDue(task: TaskRecord): string {
  if (!task.dueDate) {
    return "마감일 없음";
  }

  const remain = daysUntilYmd(task.dueDate);
  const dday = remain === 0 ? "오늘 마감" : remain > 0 ? `D-${remain}` : `D+${-remain} 지남`;
  return `${task.dueDate} · ${dday}`;
}

async function executeList(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  try {
    const tasks = await listOpenTasksByAssignee(interaction.user.id);
    if (tasks.length === 0) {
      await interaction.editReply(NO_TASK_MESSAGE);
      return;
    }

    const lines = tasks.map(
      (task) => `- **${task.title || "(제목 없음)"}** · \`${formatDue(task)}\` · ${task.status ?? "상태 없음"}`,
    );
    await interaction.editReply([`📋 <@${interaction.user.id}>님에게 배정된 태스크 (${tasks.length}개)`, ...lines].join("\n"));
  } catch (error) {
    console.error("[태스크 확인하기] Notion query failed", error);
    await interaction.editReply("태스크를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
  }
}

async function executeComplete(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  let tasks: TaskRecord[];
  try {
    tasks = (await listOpenTasksByAssignee(interaction.user.id)).slice(0, MAX_SELECT_OPTIONS);
  } catch (error) {
    console.error("[태스크 완료하기] Notion query failed", error);
    await interaction.editReply("태스크를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
    return;
  }

  if (tasks.length === 0) {
    await interaction.editReply(NO_TASK_MESSAGE);
    return;
  }

  const select = new StringSelectMenuBuilder()
    .setCustomId("task-complete-select")
    .setPlaceholder("완료한 태스크를 선택하세요")
    .setMinValues(1)
    .setMaxValues(tasks.length)
    .addOptions(
      tasks.map((task) => ({
        label: (task.title || "(제목 없음)").slice(0, 100),
        description: formatDue(task).slice(0, 100),
        value: task.pageId,
      })),
    );

  const message = await interaction.editReply({
    content: "✅ 완료한 태스크를 체크해 주세요. (여러 개 선택 가능, 60초 내)",
    components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select)],
  });

  let selection;
  try {
    selection = await message.awaitMessageComponent({
      componentType: ComponentType.StringSelect,
      time: SELECT_TIMEOUT_MS,
      filter: (i) => i.user.id === interaction.user.id,
    });
  } catch {
    await interaction.editReply({ content: "⌛ 선택 시간이 지났습니다. 다시 `/태스크 완료하기`를 실행해 주세요.", components: [] });
    return;
  }

  await selection.deferUpdate();

  const selected = tasks.filter((task) => selection.values.includes(task.pageId));

  try {
    await Promise.all(selected.map((task) => markTaskDone(task.pageId)));
  } catch (error) {
    console.error("[태스크 완료하기] Notion update failed", error);
    await interaction.editReply({ content: "노션 상태를 완료로 바꾸지 못했습니다. 잠시 후 다시 시도해 주세요.", components: [] });
    return;
  }

  const lines = selected.map((task) => `- **${task.title || "(제목 없음)"}**`);
  await interaction.editReply({ content: `완료 처리했습니다. (${selected.length}개)`, components: [] });
  await interaction.followUp(
    [`✅ <@${interaction.user.id}>님이 태스크를 완료했습니다.`, ...lines].join("\n"),
  );
}

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  switch (interaction.options.getSubcommand()) {
    case "확인하기":
      await executeList(interaction);
      break;
    case "완료하기":
      await executeComplete(interaction);
      break;
    default:
      break;
  }
}
