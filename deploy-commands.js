// ==============================================================================
// deploy-commands.js - スラッシュコマンド登録スクリプト
// ==============================================================================
require('dotenv').config();
const { REST, Routes, SlashCommandBuilder } = require('discord.js');

// 登録するコマンドの定義
const commands = [
    new SlashCommandBuilder()
        .setName('分配')
        .setDescription('アイテムを平等に分配します')
        .addStringOption(option => 
            option.setName('イベント名') 
                .setDescription('イベント名やメモを入力してください（省略可能。ファイル名にも反映されます）')
                .setRequired(false) 
        )
        .addStringOption(option =>
            option.setName('均等')
                .setDescription('全員に同じ個数ずつ均等に分配しますか？')
                .setRequired(false)
                .addChoices(
                    { name: 'ON', value: 'on' },
                    { name: 'OFF', value: 'off' }
                )
        )
        .addIntegerOption(option =>
            option.setName('分配待期期間')
                .setDescription('分配開始予定日を算出するために、抽選日にプラスする日数（数字）を入力してください')
                .setRequired(false)
        )
        .toJSON(),

    new SlashCommandBuilder()
        .setName('ymir倉庫データ抽出')
        .setDescription('倉庫の回収ログからアイテム名と個数を抽出し、時間ごとにグループ化します')
        .toJSON()
];

// RESTインスタンスの初期化
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log('--- スラッシュコマンドの登録・更新を開始します ---');
        
        // トークンからボットのクライアントIDを自動抽出
        const botId = Buffer.from(process.env.DISCORD_TOKEN.split('.')[0], 'base64').toString('ascii');
        
        if (!botId || isNaN(botId)) {
            throw new Error('トークンからボットIDを抽出できませんでした。.envファイルを確認してください。');
        }

        const guildId = process.env.GUILD_ID;

        if (guildId) {
            // 指定されたサーバーへ即時反映で更新登録
            await rest.put(
                Routes.applicationGuildCommands(botId, guildId), 
                { body: commands }
            );
            console.log('✅ 稼働中サーバーへのコマンド登録・更新に成功しました！(即時反映されました)');
        } else {
            // グローバル登録（すべてのサーバーに反映されるまで最大1時間かかります）
            await rest.put(
                Routes.applicationCommands(botId), 
                { body: commands }
            );
            console.log('✅ グローバルスラッシュコマンドの登録に成功しました！');
            console.log('※Discord側に反映されるまで、数分〜最大1時間ほどかかる場合があります。');
        }
    } catch (error) {
        console.error('❌ コマンドの登録に失敗しました:', error);
    }
})();
