const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const bus = require('../features/busSchedule');
const timetable = require('../features/timetable');

const PERIOD_CHOICES = [1, 2, 3, 4, 5].map(n => ({ name: `${n}限`, value: n }));

module.exports = {
  data: new SlashCommandBuilder()
    .setName('bus-period')
    .setDescription('指定した限に間に合う相原駅発バスを表示します')
    .addIntegerOption(o => o.setName('限').setDescription('何限か').setRequired(true).addChoices(...PERIOD_CHOICES)),

  async execute(interaction) {
    const period = interaction.options.getInteger('限');
    const now = new Date();
    const dayType = bus.getDayType(now);

    if (dayType === 'sunday') {
      await interaction.reply('今日は日曜・祝日のため、スクールバスは終日運休です。');
      return;
    }

    const { results } = bus.getCatchUpList({ [period]: timetable.PERIODS[period] }, now);
    const r = results[0];

    const description = r.passed
      ? 'このコマはすでに開始しています。'
      : r.candidates.length > 0
        ? r.candidates.join(' / ')
        : '間に合う便がありません。';

    const embed = new EmbedBuilder()
      .setColor(0x6d597a)
      .setTitle(`🚌 ${period}限(${r.start}開始)に間に合うバス`)
      .setDescription(description)
      .setFooter({ text: `${bus.DAY_LABELS[dayType]}ダイヤ / 相原駅発 / 開始1時間前〜開始時刻までの便` });

    await interaction.reply({ embeds: [embed] });
  },
};
