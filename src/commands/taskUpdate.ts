import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type GuildMember,
} from "discord.js";
import { config, parseYmd } from "../config.js";
import { findTasksByTitle, updateTaskDueDate } from "../services/notion.js";

export const data = new SlashCommandBuilder()
  .setName("task-기한수정")
  .setDescription("PM만 사용할 수 있는 태스크 마감일 변경")
  .addStringOption((option) =>
    option.setName("태스크명").setDescription("수정할 태스크 이름").setRequired(true).setMaxLength(200),
  )
  .addStringOption((option) =>
    option.setName("새마감일").setDescription("새 마감일 (YYYY-MM-DD)").setRequired(true),
  );

function hasPmRole(member: GuildMember | null): boolean {
  return Boolean(member?.roles.cache.has(config.discord.pmRoleId));
}

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const guildMember =
    interaction.guild !== null
      ? await interaction.guild.members.fetch(interaction.user.id).catch(() => null)
      : null;

  if (!hasPmRole(guildMember)) {
    await interaction.reply({
      content: "이 명령은 PM만 사용할 수 있습니다.",
      ephemeral: true,
    });
    return;
  }

  const title = interaction.options.getString("태스크명", true).trim();
  const dueDateRaw = interaction.options.getString("새마감일", true).trim();
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
    const matches = await findTasksByTitle(title);
    if (matches.length === 0) {
      await interaction.editReply(`\`${title}\` 태스크를 노션에서 찾지 못했습니다.`);
      return;
    }

    const target = matches[0];
    if (!target) {
      await interaction.editReply(`\`${title}\` 태스크를 노션에서 찾지 못했습니다.`);
      return;
    }

    await updateTaskDueDate(target.pageId, dueDate.format("YYYY-MM-DD"));

    const extra =
      matches.length > 1 ? `\n(동일 이름 태스크가 ${matches.length}개라 첫 번째 항목만 수정했습니다.)` : "";

    await interaction.editReply(
      `🗓️ **${target.title}** 마감일을 \`${dueDate.format("YYYY-MM-DD")}\`(으)로 변경했습니다.${extra}`,
    );
  } catch (error) {
    console.error("[task-기한수정] Notion update failed", error);
    await interaction.editReply("마감일을 변경하지 못했습니다. 노션 권한과 속성 이름을 확인해 주세요.");
  }
}
