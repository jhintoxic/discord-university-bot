const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const timetable = require('../features/timetable');

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DAY_CHOICES = [
  { name: '月', value: '1' },
  { name: '火', value: '2' },
  { name: '水', value: '3' },
  { name: '木', value: '4' },
  { name: '金', value: '5' },
  { name: '土', value: '6' },
  { name: '日', value: '0' },
];
const PERIOD_CHOICES = [1, 2, 3, 4, 5].map(n => ({ name: `${n}限`, value: n }));

module.exports = {
  data: new SlashCommandBuilder()
    .setName('timetable')
    .setDescription('自分の週の時間割を管理します')
    .addSubcommand(sub =>
      sub
        .setName('add')
        .setDescription('時間割に授業を追加します')
        .addStringOption(o => o.setName('曜日').setDescription('曜日').setRequired(true).addChoices(...DAY_CHOICES))
        .addIntegerOption(o => o.setName('限').setDescription('何限か').setRequired(true).addChoices(...PERIOD_CHOICES))
        .addStringOption(o => o.setName('内容').setDescription('授業名など').setRequired(true))
    )
    .addSubcommand(sub =>
      sub
        .setName('remove')
        .setDescription('/timetable list の番号を指定して削除します')
        .addIntegerOption(o => o.setName('番号').setDescription('削除する番号').setRequired(true).setMinValue(1))
    )
    .addSubcommand(sub => sub.setName('list').setDescription('自分の時間割をすべて表示します'))
    .addSubcommand(sub => sub.setName('today').setDescription('今日の時間割を表示します'))
    .addSubcommandGroup(group =>
      group
        .setName('notify')
        .setDescription('時間割の自動通知を設定します')
        .addSubcommand(sub =>
          sub
            .setName('start')
            .setDescription('このチャンネルで自分宛ての通知を開始します(1日の予定・開始10分前・終了10分前)')
            .addStringOption(o => o.setName('時刻').setDescription('1日の予定を知らせる時刻・HH:MM形式(既定07:00)').setRequired(false))
            .addStringOption(o =>
              o
                .setName('キーワード')
                .setDescription('このキーワードを含む授業だけ通知(例: メディアデザイン)。省略で全授業')
                .setRequired(false)
            )
        )
        .addSubcommand(sub => sub.setName('stop').setDescription('自分宛ての通知をすべて停止します'))
    ),

  async execute(interaction) {
    const group = interaction.options.getSubcommandGroup(false);
    const sub = interaction.options.getSubcommand();
    const userId = interaction.user.id;
    const channelId = interaction.channel.id;

    if (group === 'notify') {
      if (sub === 'start') {
        const time = interaction.options.getString('時刻') ?? '07:00';
        const keyword = interaction.options.getString('キーワード') ?? null;
        if (!TIME_RE.test(time)) {
          await interaction.reply({ content: '時刻はHH:MM形式で指定してください(例: 07:00)。', ephemeral: true });
          return;
        }
        timetable.subscribe(channelId, userId, time, keyword);
        await interaction.reply(
          `このチャンネルであなた宛てに通知を開始しました${keyword ? `(「${keyword}」を含む授業のみ)` : ''}。\n・毎日 ${time} に今日の時間割\n・各授業の開始10分前に「まもなく始まります」\n・各授業の終了10分前に「まもなく終わります」`
        );
        return;
      }
      if (sub === 'stop') {
        timetable.unsubscribe(channelId, userId);
        await interaction.reply('このチャンネルでのあなた宛ての通知をすべて停止しました。');
        return;
      }
    }

    if (sub === 'add') {
      const day = Number(interaction.options.getString('曜日'));
      const period = interaction.options.getInteger('限');
      const title = interaction.options.getString('内容');
      timetable.addEntry(userId, day, period, title);
      const p = timetable.PERIODS[period];
      await interaction.reply(`追加しました: ${timetable.DAY_LABELS[day]}曜日 ${period}限(${p.start}〜${p.end}) ${title}`);
      return;
    }

    if (sub === 'remove') {
      const index = interaction.options.getInteger('番号');
      const removed = timetable.removeEntry(userId, index);
      if (!removed) {
        await interaction.reply({ content: 'その番号の予定が見つかりませんでした。`/timetable list` で番号を確認してください。', ephemeral: true });
        return;
      }
      await interaction.reply(`削除しました: ${timetable.DAY_LABELS[removed.day]}曜日 ${removed.period}限 ${removed.title}`);
      return;
    }

    if (sub === 'list') {
      const entries = timetable.listEntries(userId);
      if (entries.length === 0) {
        await interaction.reply({ content: 'まだ時間割が登録されていません。`/timetable add` で追加できます。', ephemeral: true });
        return;
      }
      const lines = entries.map((e, i) => {
        const p = timetable.PERIODS[e.period];
        return `${i + 1}. ${timetable.DAY_LABELS[e.day]}曜日 ${e.period}限(${p.start}〜${p.end}) ${e.title}`;
      });
      const embed = new EmbedBuilder().setColor(0x457b9d).setTitle('🗓️ 週の時間割').setDescription(lines.join('\n'));
      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (sub === 'today') {
      const day = new Date().getDay();
      const embed = new EmbedBuilder()
        .setColor(0x457b9d)
        .setTitle(`🗓️ 今日(${timetable.DAY_LABELS[day]})の時間割`)
        .setDescription(timetable.buildDaySchedule(userId, day));
      await interaction.reply({ embeds: [embed] });
      return;
    }
  },
};
