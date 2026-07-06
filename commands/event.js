const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const events = require('../features/events');

const DATE_RE = /^([0-1]?\d)\/([0-3]?\d)$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const TYPE_CHOICES = [
  { name: '締切', value: '締切' },
  { name: 'テスト', value: 'テスト' },
  { name: '発表', value: '発表' },
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('event')
    .setDescription('締切・テスト・発表などのイベントを管理し、1週間前に通知します')
    .addSubcommand(sub =>
      sub
        .setName('add')
        .setDescription('イベントを追加します')
        .addStringOption(o => o.setName('種類').setDescription('イベントの種類').setRequired(true).addChoices(...TYPE_CHOICES))
        .addStringOption(o => o.setName('内容').setDescription('イベント名(例: 研究A 第一締切)').setRequired(true))
        .addStringOption(o => o.setName('日付').setDescription('M/D形式(例: 7/22)').setRequired(true))
        .addStringOption(o => o.setName('時刻').setDescription('HH:MM形式(既定23:59)').setRequired(false))
    )
    .addSubcommand(sub =>
      sub
        .setName('remove')
        .setDescription('/event list の番号を指定して削除します')
        .addIntegerOption(o => o.setName('番号').setDescription('削除する番号').setRequired(true).setMinValue(1))
    )
    .addSubcommand(sub => sub.setName('list').setDescription('自分のイベントをすべて表示します'))
    .addSubcommandGroup(group =>
      group
        .setName('notify')
        .setDescription('イベント通知の設定をします(1週間前に通知)')
        .addSubcommand(sub => sub.setName('start').setDescription('このチャンネルで自分宛ての通知を開始します'))
        .addSubcommand(sub => sub.setName('stop').setDescription('自分宛ての通知を停止します'))
    ),

  async execute(interaction) {
    const group = interaction.options.getSubcommandGroup(false);
    const sub = interaction.options.getSubcommand();
    const userId = interaction.user.id;
    const channelId = interaction.channel.id;

    if (group === 'notify') {
      if (sub === 'start') {
        events.subscribe(channelId, userId);
        await interaction.reply(
          'このチャンネルであなた宛てのイベント通知を開始しました。各イベントの1週間前に通知します(すでに1週間を切っているものは次のチェック時にすぐ通知されます)。'
        );
        return;
      }
      if (sub === 'stop') {
        events.unsubscribe(channelId, userId);
        await interaction.reply('このチャンネルでのあなた宛てのイベント通知を停止しました。');
        return;
      }
    }

    if (sub === 'add') {
      const type = interaction.options.getString('種類');
      const title = interaction.options.getString('内容');
      const dateStr = interaction.options.getString('日付');
      const timeStr = interaction.options.getString('時刻');

      if (!DATE_RE.test(dateStr)) {
        await interaction.reply({ content: '日付はM/D形式で指定してください(例: 7/22)。', ephemeral: true });
        return;
      }
      if (timeStr && !TIME_RE.test(timeStr)) {
        await interaction.reply({ content: '時刻はHH:MM形式で指定してください(例: 17:00)。', ephemeral: true });
        return;
      }

      const event = events.addEvent(userId, type, title, dateStr, timeStr);
      const info = events.TYPE_INFO[type];
      await interaction.reply(`追加しました: ${info.emoji}【${type}】${title}(${events.formatWhen(new Date(event.at))})`);
      return;
    }

    if (sub === 'remove') {
      const index = interaction.options.getInteger('番号');
      const removed = events.removeEvent(userId, index);
      if (!removed) {
        await interaction.reply({ content: 'その番号のイベントが見つかりませんでした。`/event list` で番号を確認してください。', ephemeral: true });
        return;
      }
      await interaction.reply(`削除しました: 【${removed.type}】${removed.title}`);
      return;
    }

    if (sub === 'list') {
      const list = events.listEvents(userId);
      if (list.length === 0) {
        await interaction.reply({ content: 'まだイベントが登録されていません。`/event add` で追加できます。', ephemeral: true });
        return;
      }
      const lines = list.map((e, i) => {
        const info = events.TYPE_INFO[e.type] || { emoji: '📌' };
        return `${i + 1}. ${info.emoji}【${e.type}】${e.title} — ${events.formatWhen(new Date(e.at))}`;
      });
      const embed = new EmbedBuilder().setColor(0x6d597a).setTitle('📌 イベント一覧').setDescription(lines.join('\n'));
      await interaction.reply({ embeds: [embed] });
      return;
    }
  },
};
