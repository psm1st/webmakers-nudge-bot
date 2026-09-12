import { SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import { parseYmd } from "../config.js";
import { createTask } from "../services/notion.js";

export const data = new SlashCommandBuilder()
  .setName("task-등록")
  .setDescription("노션 DB에 진행 중 태스크를 등록합니다.")
  .addStringOption((option) =>
    option.setName("태스크").setDescription("할 일 이름").setRequired(true).setMaxLength(200),
  )
  .addStringOption((option) =>
    option.setName("마감일").setDescription("마감일 (YYYY-MM-DD)").setRequired(true),
  )
  .addUserOption((option) =>
    option.setName("담당자").setDescription("태스크 담당자").setRequired(true),
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const title = interaction.options.getString("태스크", true).trim();
  const dueDateRaw = interaction.options.getString("마감일", true).trim();
  const assignee = interaction.options.getUser("담당자", true);

  const dueDate = parseYmd(dueDateRaw);
  if (!dueDate) {
    await interaction.reply({
      content: "마감일 형식이 올바르지 않습니다. `YYYY-MM-DD`로 입력해 주세요.",
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply();

  try {
    const task = await createTask({
      title,
      assigneeId: assignee.id,
      dueDate: dueDate.format("YYYY-MM-DD"),
    });

    await interaction.editReply(
      `✅ 태스크를 등록했습니다.\n- 태스크: **${task.title}**\n- 담당자: <@${assignee.id}>\n- 마감일: \`${task.dueDate}\`\n- 상태: 진행 중`,
    );
  } catch (error) {
    console.error("[task-등록] Notion create failed", error);
    await interaction.editReply("노션에 태스크를 등록하지 못했습니다. DB 속성 이름과 권한을 확인해 주세요.");
  }
}
