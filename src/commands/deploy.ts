import { REST, Routes } from "discord.js";
import { config } from "../config.js";
import { data as taskCreateCommand } from "./taskCreate.js";
import { data as taskUpdateCommand } from "./taskUpdate.js";
import { data as taskCommand } from "./task.js";

const commands = [taskCreateCommand, taskUpdateCommand, taskCommand].map((command) => command.toJSON());

async function deploy(): Promise<void> {
  const rest = new REST({ version: "10" }).setToken(config.discord.token);

  console.log(`슬래시 커맨드 ${commands.length}개를 길드(${config.discord.guildId})에 등록합니다.`);

  await rest.put(Routes.applicationGuildCommands(config.discord.clientId, config.discord.guildId), {
    body: commands,
  });

  console.log("길드 커맨드 등록이 완료되었습니다.");
  console.log("전역 등록이 필요하면 아래를 사용하세요:");
  console.log("  await rest.put(Routes.applicationCommands(clientId), { body: commands })");
}

deploy().catch((error: unknown) => {
  console.error("커맨드 등록 실패", error);
  process.exitCode = 1;
});
