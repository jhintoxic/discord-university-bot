require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const { REST, Routes } = require('discord.js');

const commands = [];
const commandsPath = path.join(__dirname, 'commands');
for (const file of fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'))) {
  const command = require(path.join(commandsPath, file));
  commands.push(command.data.toJSON());
}

const rest = new REST().setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    const route = process.env.GUILD_ID
      ? Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID)
      : Routes.applicationCommands(process.env.CLIENT_ID);

    await rest.put(route, { body: commands });
    console.log(
      process.env.GUILD_ID
        ? `スラッシュコマンドをサーバーに登録しました(即時反映): ${commands.map(c => c.name).join(', ')}`
        : `スラッシュコマンドをグローバル登録しました(反映まで最大1時間程度かかります): ${commands.map(c => c.name).join(', ')}`
    );
  } catch (error) {
    console.error('コマンド登録に失敗しました:', error);
  }
})();
