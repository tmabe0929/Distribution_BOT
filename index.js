// ==========================================
// Renderの自動停止（ポート未検出エラー）を防ぐためのダミーサーバー
// ==========================================
const http = require('http');
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot is running\n');
}).listen(process.env.PORT || 3000);
// ==========================================

require('dotenv').config();
const { 
    Client, 
    GatewayIntentBits, 
    ActionRowBuilder, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    Events, 
    EmbedBuilder, 
    REST, 
    Routes, 
    SlashCommandBuilder, 
    AttachmentBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');

// HTMLチェックシート生成関数を別ファイルから読み込み
const { generateChecklistHtml } = require('./checklist.js');

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ] 
});

// モーダルの100文字制限を確実に回避するためのストア
const modalSessionStore = new Map();

// 配列の完全ランダムシャッフル関数
function shuffle(array) {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}
// --- スラッシュコマンドの定義 ---
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
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

client.once(Events.ClientReady, async (c) => {
    try {
        console.log(c.user.tag + ' 起動中...');
        await rest.put(Routes.applicationCommands(c.user.id), { body: commands });
        console.log('スラッシュコマンドを登録しました。');
    } catch (error) {
        console.error(error);
    }
});

client.on(Events.InteractionCreate, async interaction => {
    // スラッシュコマンド（ChatInput）の処理
    if (interaction.isChatInputCommand()) {
        if (interaction.commandName === '分配') {
            const equalChoice = interaction.options.getString('均等') || 'off';
            const isEqual = equalChoice === 'on';

            const sessionId = `dist_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
            
            const modal = new ModalBuilder()
                .setCustomId(`distributeModal::${sessionId}`) 
                .setTitle(isEqual ? 'アイテム均等分配（ON）' : 'アイテムランダム分配（OFF）');

            const playersInput = new TextInputBuilder()
                .setCustomId('playersInput')
                .setLabel("プレイヤー名（改行またはカンマ区切り）")
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('PlayerA\nPlayerB\nor\nPlayerA,PlayerB')
                .setRequired(true);
            const itemsInput = new TextInputBuilder()
                .setCustomId('itemsInput')
                .setLabel("アイテム（改行、カンマ、タブ区切り対応）")
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('ItemAx12,345,ItemBx12\nor\nItemA\t12,345\nItemBx12')
                .setRequired(true);

            modal.addComponents(
                new ActionRowBuilder().addComponents(playersInput),
                new ActionRowBuilder().addComponents(itemsInput)
            );

            // 【3秒ルール対策】Discordにモーダルを最速で返却
            await interaction.showModal(modal);

            // オプション取得とストア保存はshowModalの後に実行
            const eventParam = interaction.options.getString('イベント名') || '';
            const waitDays = interaction.options.getInteger('分配待期期間') || 0;
            modalSessionStore.set(sessionId, { isEqual, waitDays, eventParam });
            setTimeout(() => modalSessionStore.delete(sessionId), 10 * 60 * 1000); // 10分後に削除
            return; 
        }

        if (interaction.commandName === 'ymir倉庫データ抽出') {
            const modal = new ModalBuilder()
                .setCustomId('ymirExtractModal')
                .setTitle('倉庫データ抽出モード（最大5連枠）');

            const logInput1 = new TextInputBuilder()
                .setCustomId('logInput1')
                .setLabel("倉庫ログ【1枠目】（必須）")
                .setStyle(TextInputStyle.Paragraph)
                .setMaxLength(4000)
                .setPlaceholder('コピーしたログの最初の塊をここに貼り付けてください\n\n（改行して3行以上の広さで入力できます）')
                .setRequired(true);

            const logInput2 = new TextInputBuilder()
                .setCustomId('logInput2')
                .setLabel("倉庫ログ【2枠目】")
                .setStyle(TextInputStyle.Paragraph)
                .setMaxLength(4000)
                .setPlaceholder('1枠目に入り切らなかった続きのログはここに貼り付けてください')
                .setRequired(false);

            const logInput3 = new TextInputBuilder()
                .setCustomId('logInput3')
                .setLabel("倉庫ログ【3枠目】")
                .setStyle(TextInputStyle.Paragraph)
                .setMaxLength(4000)
                .setPlaceholder('さらに続きのログがある場合はここに貼り付けてください')
                .setRequired(false);

            const logInput4 = new TextInputBuilder()
                .setCustomId('logInput4')
                .setLabel("倉庫ログ【4枠目】")
                .setStyle(TextInputStyle.Paragraph)
                .setMaxLength(4000)
                .setRequired(false);

            const logInput5 = new TextInputBuilder()
                .setCustomId('logInput5')
                .setLabel("倉庫ログ【5枠目】")
                .setStyle(TextInputStyle.Paragraph)
                .setMaxLength(4000)
                .setRequired(false);

            modal.addComponents(
                new ActionRowBuilder().addComponents(logInput1),
                new ActionRowBuilder().addComponents(logInput2),
                new ActionRowBuilder().addComponents(logInput3),
                new ActionRowBuilder().addComponents(logInput4),
                new ActionRowBuilder().addComponents(logInput5)
            );
            
            // 【3秒ルール対策】最速でモーダルを返却
            await interaction.showModal(modal);
            return; 
        }
    }

    // モーダル送信（ModalSubmit）の処理
    if (interaction.isModalSubmit()) {
        // --- 1. 分配モードのモーダル処理 ---
        if (interaction.customId.startsWith('distributeModal::')) {
            await interaction.deferReply();

            const customIdPieces = interaction.customId.split('::');
            const sessionId = customIdPieces[1];
            const sessionData = modalSessionStore.get(sessionId);

            if (!sessionData) {
                await interaction.editReply({ content: '❌ モーダルの有効期限が切れました。もう一度やり直してください。' });
                return;
            }

            const { isEqual, waitDays, eventParam } = sessionData;
            modalSessionStore.delete(sessionId);

            const eventHeader = eventParam ? eventParam + ' ' : '';

            const players = interaction.fields.getTextInputValue('playersInput')
                .split(/[\n,，、]+/)
                .map(s => s.trim())
                .filter(s => Boolean(s) && s !== '参加者' && s !== '参加者一覧');
                
            const itemsRawInput = interaction.fields.getTextInputValue('itemsInput');

            if (players.length === 0) {
                await interaction.editReply({ content: '❌ 有効なプレイヤーを入力してください。' });
                return; 
            }
            const rawLines = itemsRawInput.split(/[\n]+/).map(s => s.trim()).filter(Boolean);
            const processedItems = [];

            rawLines.forEach(line => {
                const normalizedLine = line.replace(/(?<!\d),(?!\d)/g, '\n');
                const splitPieces = normalizedLine.split('\n').map(s => s.trim()).filter(Boolean);
                processedItems.push(...splitPieces);
            });

            if (processedItems.length === 0) {
                await interaction.editReply({ content: '❌ アイテムを正しく入力してください。' });
                return;
            }

            const playerAllocation = Object.fromEntries(players.map(p => [p, {}]));
            const remainderWinnersMap = {}; 
            const totalItemsMap = {};
            const parsedLines = [];

            processedItems.forEach(line => {
                if (line === 'アイテム' || line.startsWith('≪') || line.startsWith('抽選日:') || (line.startsWith('【') && line.endsWith('】')) || line.startsWith('※') || line.startsWith('🎁') || line.startsWith('・') || line.startsWith('```')) {
                    return;
                }

                let itemName = line.trim();
                let amount = 1;

                const matchResult = line.match(/^([\s\S]*?)(?:\t+|[\sXx\*_\[\]\t]+)([\d,]+)(?:[\s\*_\[\]]*)$/) || line.match(/^([\s\S]*?)\s+([\d,]+)$/);
                if (matchResult) {
                    itemName = matchResult[1].trim();
                    amount = parseInt(matchResult[2].replace(/,/g, ''), 10) || 1;
                }

                if (itemName) {
                    const cleanedName = itemName
                        .replace(/\(帰属\)/g, '')
                        .replace(/（帰属）/g, '')
                        .replace(/\[帰属\]/g, '')
                        .trim();

                    if (cleanedName) {
                        totalItemsMap[cleanedName] = (totalItemsMap[cleanedName] || 0) + amount;
                        parsedLines.push({ name: cleanedName, amount: amount });
                    }
                }
            });

            const itemOrderTrack = Object.keys(totalItemsMap);

            if (itemOrderTrack.length === 0) {
                await interaction.editReply({ content: '❌ 有効なアイテムデータが検出されませんでした。' });
                return;
            }

            if (isEqual) {
                itemOrderTrack.forEach(itemName => {
                    const totalAmount = totalItemsMap[itemName];
                    const perPlayerAmount = Math.floor(totalAmount / players.length);
                    
                    players.forEach(player => {
                        playerAllocation[player][itemName] = perPlayerAmount;
                    });
                });

                const remainderItemNames = [];
                itemOrderTrack.forEach(itemName => {
                    const totalAmount = totalItemsMap[itemName];
                    const remainder = totalAmount % players.length;
                    if (remainder > 0) {
                        remainderItemNames.push(itemName);
                    }
                });
                const shuffledRemainderItems = shuffle(remainderItemNames);

                shuffledRemainderItems.forEach(itemName => {
                    const totalAmount = totalItemsMap[itemName];
                    const remainder = totalAmount % players.length;
                    
                    const luckyRotator = shuffle(players); 
                    for (let i = 0; i < remainder; i++) {
                        const luckyPlayer = luckyRotator[i % luckyRotator.length];
                        
                        if (!remainderWinnersMap[itemName]) {
                            remainderWinnersMap[itemName] = [];
                        }
                        remainderWinnersMap[itemName].push(luckyPlayer);
                        playerAllocation[luckyPlayer][itemName] = (playerAllocation[luckyPlayer][itemName] || 0) + 1;
                    }
                });

            } else {
                const shuffledChunks = shuffle(parsedLines);
                const playerRotator = shuffle(players);

                shuffledChunks.forEach((chunk, index) => {
                    const luckyPlayer = playerRotator[index % playerRotator.length];
                    playerAllocation[luckyPlayer][chunk.name] = (playerAllocation[luckyPlayer][chunk.name] || 0) + chunk.amount;
                });
            }

            const lotteryDate = new Date();
            let dateHeaderText = '抽選日: ' + lotteryDate.toLocaleDateString('ja-JP');

            if (waitDays > 0) {
                const startDate = new Date();
                startDate.setDate(lotteryDate.getDate() + waitDays);
                dateHeaderText += '\n分配開始予定日: ' + startDate.toLocaleDateString('ja-JP');
            }

            let titleText = players.length === 1 
                ? '≪' + eventHeader + 'アイテム付与結果≫'
                : '≪' + eventHeader + (isEqual ? '均等' : 'ランダム') + '分配抽選結果≫';
            
            const embeds = [];
            let currentEmbed = new EmbedBuilder().setTitle(titleText).setDescription(dateHeaderText).setColor(0x5865F2);
            let fieldChunkIndex = 1;
            let currentFieldText = "";

            players.forEach((p) => {
                const displayItems = [];
                itemOrderTrack.forEach(itemName => {
                    const totalCount = playerAllocation[p][itemName] || 0;
                    if (totalCount > 0) {
                        displayItems.push('・' + itemName + ' x **[' + totalCount.toLocaleString() + ']**');
                    }
                });
                
                const playerBlock = '**【' + p + '】**\n' + (displayItems.join('\n') || 'なし') + '\n\n';

                if ((currentFieldText + playerBlock).length > 950) {
                    const fieldName = '結果リスト (' + fieldChunkIndex + ')';
                    currentEmbed.addFields({ name: fieldName, value: currentFieldText.trim() });
                    embeds.push(currentEmbed);
                    
                    currentEmbed = new EmbedBuilder().setTitle(titleText).setDescription(dateHeaderText).setColor(0x5865F2);
                    currentFieldText = playerBlock;
                    fieldChunkIndex++;
                } else {
                    currentFieldText += playerBlock;
                }
            });

            if (currentFieldText.trim().length > 0) {
                const fieldName = '結果リスト (' + fieldChunkIndex + ')';
                currentEmbed.addFields({ name: fieldName, value: currentFieldText.trim() });
                embeds.push(currentEmbed);
            }

            if (isEqual && Object.keys(remainderWinnersMap).length > 0) {
                let remainderEmbed = new EmbedBuilder().setTitle('🎁 余りアイテムの当選者一覧').setColor(0xFAC13C);
                let remainderText = "";

                itemOrderTrack.forEach(itemName => {
                    const winners = remainderWinnersMap[itemName];
                    if (winners && winners.length > 0) {
                        remainderText += '・' + itemName + ' **[+1個]** ➡️ **【' + winners.join(', ') + '】**\n';
                    }
                });

                if (remainderText) {
                    remainderEmbed.setDescription(remainderText.trim());
                    embeds.push(remainderEmbed);
                }
            }

            const responseOptions = { embeds: embeds };

            try {
                const htmlContent = generateChecklistHtml(
                    lotteryDate,
                    waitDays,
                    eventParam,
                    players,
                    itemOrderTrack,
                    playerAllocation,
                    remainderWinnersMap
                );

                const fileBuffer = Buffer.from(htmlContent, 'utf-8');
                const fileMemo = eventParam ? `_${eventParam}` : '';
                const filename = `checklist_${lotteryDate.getFullYear()}${String(lotteryDate.getMonth() + 1).padStart(2, '0')}${String(lotteryDate.getDate()).padStart(2, '0')}${fileMemo}.html`;
                
                const attachment = new AttachmentBuilder(fileBuffer, { name: filename });
                responseOptions.files = [attachment];

                const row = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('dummy_download')
                            .setLabel('チェックリストHTML添付済み')
                            .setStyle(ButtonStyle.Success)
                            .setDisabled(true)
                    );
                responseOptions.components = [row];

            } catch (htmlError) {
                console.error('HTMLチェックシートの生成に失敗しました:', htmlError);
            }

            await interaction.editReply(responseOptions);
            return;
        }

        // --- 2. 倉庫データ抽出モードのモーダル処理 ---
        if (interaction.customId === 'ymirExtractModal') {
            await interaction.deferReply(); 

            const logInput1 = interaction.fields.getTextInputValue('logInput1') || '';
            const logInput2 = interaction.fields.getTextInputValue('logInput2') || '';
            const logInput3 = interaction.fields.getTextInputValue('logInput3') || '';
            const logInput4 = interaction.fields.getTextInputValue('logInput4') || '';
            const logInput5 = interaction.fields.getTextInputValue('logInput5') || '';
            
            const combinedLog = `${logInput1} ${logInput2} ${logInput3} ${logInput4} ${logInput5}`;

            const groupMap = {};
            const groupOrder = [];

            const normalizedLog = combinedLog.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ');
            const logRegex = /([^\s]+)\s+([\d,]+)\s+([\s\S]+?)\s+(\d{4}-\d{2}-\d{2})\s+(\d{2}):(\d{2}):(\d{2})\s*\(UTC\+8\)/g;

            let match;
            let addedCount = 0;

            while ((match = logRegex.exec(normalizedLog)) !== null) {
                const itemName = match[1];
                const countStr = String(match[2]);
                const countNum = parseInt(countStr.replace(/,/g, ''), 10) || 1;
                let rawLocation = match[3].trim(); 

                if (rawLocation.includes('-')) {
                    const idx = rawLocation.indexOf('-');
                    if (idx > 0) {
                        rawLocation = rawLocation.substring(0, idx).trim();
                    }
                }
                const locationName = rawLocation;

                const datePart = match[4];      
                const hourPart = match[5];      

                const roundedTimestamp = `${datePart} ${hourPart}:00:00 (UTC+8)`;
                const groupKey = `${locationName}::${roundedTimestamp}`;

                if (!groupMap[groupKey]) {
                    groupMap[groupKey] = [];
                    groupOrder.push(groupKey);
                }

                groupMap[groupKey].push({ name: itemName, count: countNum });
                addedCount++;
            }

            if (addedCount === 0) {
                await interaction.editReply({ content: '❌ 有効な倉庫ログデータが検出されませんでした。フォーマットを確認するか、貼り付け位置が正しいか確かめてください。' });
                return;
            }

            const today = new Date();
            const dateText = `確認日: ${today.toLocaleDateString('ja-JP')}`;

            const extractEmbeds = [];
            const baseTitle = '≪倉庫回収アイテム一覧≫';
            let currentExtractEmbed = new EmbedBuilder()
                .setTitle(baseTitle)
                .setDescription(`**${dateText}**`)
                .setColor(0x5865F2);

            let extractEmbedSize = baseTitle.length + dateText.length;
            let currentFieldCount = 0;

            groupOrder.forEach((groupKey) => {
                const [location, timestamp] = groupKey.split('::');
                const itemsList = groupMap[groupKey];

                const fieldChunks = [];
                let tempLines = [];

                for (let i = 0; i < itemsList.length; i++) {
                    const item = itemsList[i];
                    const lineText = `${item.name}x${item.count}`;
                    const tentativeLength = tempLines.join('\n').length + lineText.length + 15;

                    if (tentativeLength > 900 && tempLines.length > 0) {
                        fieldChunks.push([...tempLines]);
                        tempLines = [];
                    }
                    tempLines.push(lineText);

                    if (i === itemsList.length - 1) {
                        fieldChunks.push([...tempLines]);
                    }
                }

                const totalPages = fieldChunks.length;

                fieldChunks.forEach((lines, index) => {
                    const pageNum = index + 1;
                    const isSplit = totalPages > 1;
                    const fieldName = `📍 ${location}${isSplit ? ` (${pageNum} / ${totalPages} ページ)` : ''}\n🕒 ${timestamp}`;
                    const fieldValue = `\`\`\`\n${lines.join('\n')}\n\`\`\``;

                    if (currentFieldCount >= 20 || (extractEmbedSize + fieldName.length + fieldValue.length) > 5000) {
                        extractEmbeds.push(currentExtractEmbed);
                        currentExtractEmbed = new EmbedBuilder().setTitle(baseTitle).setColor(0x5865F2);
                        extractEmbedSize = baseTitle.length;
                        currentFieldCount = 0;
                    }

                    currentExtractEmbed.addFields({ name: fieldName, value: fieldValue });
                    extractEmbedSize += fieldName.length + fieldValue.length;
                    currentFieldCount++;
                });
            });

            extractEmbeds.push(currentExtractEmbed);

            const totalExtractPages = extractEmbeds.length;
            extractEmbeds.forEach((emb, index) => {
                if (index === 0) {
                    emb.setTitle(`${baseTitle} (1/${totalExtractPages})`);
                } else {
                    emb.setTitle(`${baseTitle} 続き (${index + 1}/${totalExtractPages})`);
                }
            });

            await interaction.editReply({ embeds: extractEmbeds.slice(0, 10) });

            if (extractEmbeds.length > 10) {
                const remainingExtract = extractEmbeds.slice(10);
                for (const remainEmb of remainingExtract) {
                    await interaction.followUp({ embeds: [remainEmb] });
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }
            return;
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
