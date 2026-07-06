const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const bus = require('../features/busSchedule');

module.exports = {
  data: new SlashCommandBuilder().setName('bus-table').setDescription('今日の運行ダイヤ(全便)を一覧表示します'),

  async execute(interaction) {
    const now = new Date();
    const dayType = bus.getDayType(now);

    if (dayType === 'sunday') {
      await interaction.reply('今日は日曜・祝日のため、スクールバスは終日運休です。');
      return;
    }

    const schedule = bus.getSchedule(dayType);

    const embed = new EmbedBuilder()
      .setColor(0x2a9d8f)
      .setTitle(`🚌 ${bus.DAY_LABELS[dayType]}ダイヤ 全便一覧`)
      .addFields(
        { name: '相原駅発', value: schedule.aihara.join(' / ') },
        { name: '大学発', value: schedule.university.join(' / ') }
      );

    await interaction.reply({ embeds: [embed] });
  },
};
