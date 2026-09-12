import { Client, Events, GatewayIntentBits } from "discord.js";
import { config } from "./config.js";
import { execute as executeTaskCreate } from "./commands/taskCreate.js";
import { execute as executeTaskUpdate } from "./commands/taskUpdate.js";
import { bindCompletionListener } from "./listeners/completion.js";
import { startDeadlineScheduler } from "./schedulers/deadline.js";
import { startScrumScheduler } from "./schedulers/scrum.js";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

bindCompletionListener(client);

client.once(Events.ClientReady, (readyClient) => {
  console.log(`로그인 완료: ${readyClient.user.tag}`);
  startScrumScheduler(readyClient);
  startDeadlineScheduler(readyClient);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) {
    return;
  }

  try {
    switch (interaction.commandName) {
      case "task-등록":
        await executeTaskCreate(interaction);
        break;
      case "task-기한수정":
        await executeTaskUpdate(interaction);
        break;
      default:
        break;
    }
  } catch (error) {
    console.error(`[command] ${interaction.commandName} 처리 실패`, error);

    const payload = {
      content: "명령 처리 중 오류가 발생했습니다.",
      ephemeral: true,
    };

    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(payload).catch(() => undefined);
    } else {
      await interaction.reply(payload).catch(() => undefined);
    }
  }
});

await client.login(config.discord.token);
