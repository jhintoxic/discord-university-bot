const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const bus = require('../features/busSchedule');
const timetable = require('../features/timetable');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('bus-catchup')
    .setDescription('1〜5限それぞれに間に合う相原駅発バスの一覧をまとめて表示します'),

  async execute(interaction) {
    const now = new Date();
    const dayType = bus.getDayType(now);

    if (dayType === 'sunday') {
      await interaction.reply('今日は日曜・祝日のため、スクールバスは終日運休です。');
      return;
    }

    const { results } = bus.getCatchUpList(timetable.PERIODS, now);

    const lines = results.map(r => {
      if (r.passed) return `**${r.period}限**(${r.start}開始) — 開始済み`;
      if (r.candidates.length === 0) return `**${r.period}限**(${r.start}開始) — 間に合う便なし`;
      return `**${r.period}限**(${r.start}開始) — ${r.candidates.join(' / ')}`;
    });

    const embed = new EmbedBuilder()
      .setColor(0x6d597a)
      .setTitle('🚌 授業に間に合うバス一覧(相原駅発)')
      .setDescription(lines.join('\n'))
      .setFooter({ text: `${bus.DAY_LABELS[dayType]}ダイヤ / 各コマ開始1時間前〜開始時刻までの便` });

    await interaction.reply({ embeds: [embed] });
  },
};
