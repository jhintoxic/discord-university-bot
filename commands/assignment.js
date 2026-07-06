const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const assignments = require('../features/assignments');

const DATE_RE = /^([0-1]?\d)\/([0-3]?\d)$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('assignment')
    .setDescription('課題の締切を管理し、近づいたらリマインダーします')
    .addSubcommand(sub =>
      sub
        .setName('add')
        .setDescription('課題を追加します')
        .addStringOption(o => o.setName('内容').setDescription('課題名など').setRequired(true))
        .addStringOption(o => o.setName('締切日').setDescription('M/D形式(例: 7/15)').setRequired(true))
        .addStringOption(o => o.setName('締切時刻').setDescription('HH:MM形式(既定23:59)').setRequired(false))
    )
    .addSubcommand(sub =>
      sub
        .setName('remove')
        .setDescription('/assignment list の番号を指定して削除します')
        .addIntegerOption(o => o.setName('番号').setDescription('削除する番号').setRequired(true).setMinValue(1))
    )
    .addSubcommand(sub => sub.setName('list').setDescription('自分の課題をすべて表示します'))
    .addSubcommandGroup(group =>
      group
        .setName('notify')
        .setDescription('締切リマインダーの通知先を設定します(締切3日前・1日前・当日に通知)')
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
        assignments.subscribe(channelId, userId);
        await interaction.reply(
          'このチャンネルであなた宛ての課題リマインダーを開始しました。締切の3日前・1日前・当日に通知します。'
        );
        return;
      }
      if (sub === 'stop') {
        assignments.unsubscribe(channelId, userId);
        await interaction.reply('このチャンネルでのあなた宛ての課題リマインダーを停止しました。');
        return;
      }
    }

    if (sub === 'add') {
      const title = interaction.options.getString('内容');
      const dateStr = interaction.options.getString('締切日');
      const timeStr = interaction.options.getString('締切時刻');

      if (!DATE_RE.test(dateStr)) {
        await interaction.reply({ content: '締切日はM/D形式で指定してください(例: 7/15)。', ephemeral: true });
        return;
      }
      if (timeStr && !TIME_RE.test(timeStr)) {
        await interaction.reply({ content: '締切時刻はHH:MM形式で指定してください(例: 23:59)。', ephemeral: true });
        return;
      }

      const assignment = assignments.addAssignment(userId, title, dateStr, timeStr);
      await interaction.reply(`追加しました: ${title}(締切: ${assignments.formatDue(new Date(assignment.dueAt))})`);
      return;
    }

    if (sub === 'remove') {
      const index = interaction.options.getInteger('番号');
      const removed = assignments.removeAssignment(userId, index);
      if (!removed) {
        await interaction.reply({ content: 'その番号の課題が見つかりませんでした。`/assignment list` で番号を確認してください。', ephemeral: true });
        return;
      }
      await interaction.reply(`削除しました: ${removed.title}`);
      return;
    }

    if (sub === 'list') {
      const list = assignments.listAssignments(userId);
      if (list.length === 0) {
        await interaction.reply({ content: 'まだ課題が登録されていません。`/assignment add` で追加できます。', ephemeral: true });
        return;
      }
      const lines = list.map((a, i) => `${i + 1}. ${a.title} — 締切: ${assignments.formatDue(new Date(a.dueAt))}`);
      const embed = new EmbedBuilder().setColor(0xf4a261).setTitle('📝 課題一覧').setDescription(lines.join('\n'));
      await interaction.reply({ embeds: [embed] });
      return;
    }
  },
};
