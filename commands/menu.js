const { SlashCommandBuilder } = require('discord.js');
const cafeteria = require('../features/cafeteria');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('menu')
    .setDescription('学食メニューの表示と自動通知を管理します')
    .addSubcommand(sub => sub.setName('today').setDescription('今日の学食メニューを表示します'))
    .addSubcommandGroup(group =>
      group
        .setName('notify')
        .setDescription('メニュー更新の自動通知を設定します')
        .addSubcommand(sub =>
          sub.setName('start').setDescription('このチャンネルに、メニューが更新されたら自動で通知します')
        )
        .addSubcommand(sub => sub.setName('stop').setDescription('このチャンネルへの自動通知を停止します'))
        .addSubcommand(sub => sub.setName('status').setDescription('自動通知の設定状況を確認します'))
    ),

  async execute(interaction) {
    const group = interaction.options.getSubcommandGroup(false);
    const sub = interaction.options.getSubcommand();
    const channelId = interaction.channel.id;

    if (group === 'notify') {
      if (sub === 'start') {
        cafeteria.subscribe(channelId);
        await interaction.reply(
          'このチャンネルで学食メニューの自動通知を開始しました。約30分ごとにページをチェックし、新しい日のメニューが公開されたら投稿します。'
        );
        return;
      }
      if (sub === 'stop') {
        cafeteria.unsubscribe(channelId);
        await interaction.reply('このチャンネルへの学食メニュー自動通知を停止しました。');
        return;
      }
      if (sub === 'status') {
        const s = cafeteria.status();
        await interaction.reply(
          `通知先チャンネル数: ${s.channelIds.length}\nこのチャンネルへの通知: ${s.channelIds.includes(channelId) ? 'オン' : 'オフ'}\n最後に投稿したメニュー: ${s.lastPostedHeading ?? 'なし'}\n監視動作中: ${s.polling ? 'はい' : 'いいえ'}`
        );
        return;
      }
    }

    if (sub === 'today') {
      await interaction.deferReply();
      try {
        const { heading, items } = await cafeteria.fetchTodayMenu();
        if (items.length === 0) {
          await interaction.editReply(
            `今日のメニュー情報が見つかりませんでした(休業日の可能性があります)。\n${cafeteria.CAFETERIA_URL}`
          );
          return;
        }
        await interaction.editReply({ embeds: [cafeteria.buildMenuEmbed(heading, items)] });
      } catch (err) {
        console.error('学食メニュー取得エラー:', err);
        await interaction.editReply('学食メニューの取得に失敗しました。時間をおいて再度お試しください。');
      }
      return;
    }
  },
};
