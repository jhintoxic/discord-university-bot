const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const bus = require('../features/busSchedule');

module.exports = {
  data: new SlashCommandBuilder().setName('bus-university').setDescription('大学発のスクールバス、次の時刻を調べます'),

  async execute(interaction) {
    const now = new Date();
    const dayType = bus.getDayType(now);

    if (dayType === 'sunday') {
      await interaction.reply('今日は日曜・祝日のため、スクールバスは終日運休です。');
      return;
    }

    const { times, finished } = bus.getUpcoming('university', now, 3);

    if (finished) {
      await interaction.reply(`本日(${bus.DAY_LABELS[dayType]})の大学発バスは、すべて発車済みです。`);
      return;
    }

    const nowMin = now.getHours() * 60 + now.getMinutes();
    const [h, m] = times[0].split(':').map(Number);
    const minutesUntil = h * 60 + m - nowMin;

    const embed = new EmbedBuilder()
      .setColor(0xe76f51)
      .setTitle('🚌 大学発 次のバス')
      .setDescription(
        `**${times[0]}**(あと${minutesUntil}分)\n\nその後: ${times.slice(1).join(' / ') || 'なし'}`
      )
      .setFooter({ text: `${bus.DAY_LABELS[dayType]}ダイヤ` });

    await interaction.reply({ embeds: [embed] });
  },
};
