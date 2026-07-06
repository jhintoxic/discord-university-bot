require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { Client, GatewayIntentBits, Collection } = require('discord.js');

// Koyebなどのホスティングはヘルスチェック用にHTTPポートの公開を要求する
http
  .createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('OK');
  })
  .listen(process.env.PORT || 8080);

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
for (const file of fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'))) {
  const command = require(path.join(commandsPath, file));
  client.commands.set(command.data.name, command);
}

const eventsPath = path.join(__dirname, 'events');
for (const file of fs.readdirSync(eventsPath).filter(f => f.endsWith('.js'))) {
  const event = require(path.join(eventsPath, file));
  client.on(event.name, (...args) => event.execute(...args, client));
}

client.once('clientReady', () => {
  console.log(`${client.user.tag} としてログインしました`);
  require('./features/timetable').init(client);
  require('./features/assignments').init(client);
  require('./features/cafeteria').init(client);
  require('./features/events').init(client);
});

client.login(process.env.DISCORD_TOKEN);
