// ==============================================================================
// checklist.js - HTMLチェックシート生成スクリプト（完全最終決定版 1/3）
// ==============================================================================

// HTML用の文字エスケープ関数
function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;'); // ⭕【完全修復：シングルクォーテーション奇数個による構文エラーを解消】
}

// 外部から呼び出されるHTMLチェックシートのメイン生成関数
function generateChecklistHtml(lotteryDate, waitDays, eventParam, players, itemOrderTrack, playerAllocation, remainderWinnersMap) {
    const yesterdayDate = new Date(lotteryDate);
    yesterdayDate.setDate(lotteryDate.getDate() - 1);
    
    // 📅 日付を「2026/08/12」のように2桁ゼロ埋め形式で統一
    const yesterdayString = yesterdayDate.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' });
    const lotteryDateString = lotteryDate.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' });

    // 👤 プレイヤー名中心のカード生成
    let htmlCardsPlayerCenter = '';
    players.forEach(p => {
        let itemRowsHtml = '';
        let hasItems = false;
        itemOrderTrack.forEach(itemName => {
            // 【2重加算バグ修正】index.js側で余り分も含めて計算が完了しているため、そのまま使用します
            const totalCount = playerAllocation[p][itemName] || 0;
            
            if (totalCount > 0) {
                hasItems = true;
                itemRowsHtml += `<div class="item-row" onclick="toggleItemRow(this)"><div class="item-left"><input type="checkbox" onclick="event.stopPropagation(); toggleItemRow(this.closest('.item-row'))"><span class="item-name">${escapeHtml(itemName)}</span></div><div class="item-count">x${totalCount.toLocaleString()}</div></div>`;
            }
        });
        if (!hasItems) itemRowsHtml = '<div class="no-item">なし</div>';
        htmlCardsPlayerCenter += `<div class="player-card"><div class="player-header">👤 ${escapeHtml(p)}</div><div class="item-list">${itemRowsHtml}</div></div>`;
    });
    // 📦 アイテム名中心のカード生成
    let htmlCardsItemCenter = '';
    itemOrderTrack.forEach(itemName => {
        let playerRowsHtml = '';
        let hasPlayers = false;
        players.forEach(p => {
            // 【2重加算バグ修正】同様に、すでに確定している数量をそのまま使用します
            const totalCount = playerAllocation[p][itemName] || 0;
            
            if (totalCount > 0) {
                hasPlayers = true;
                playerRowsHtml += `<div class="item-row" onclick="toggleItemRow(this)"><div class="item-left"><input type="checkbox" onclick="event.stopPropagation(); toggleItemRow(this.closest('.item-row'))"><span class="item-name">${escapeHtml(p)}</span></div><div class="item-count">x${totalCount.toLocaleString()}</div></div>`;
            }
        });
        if (!hasPlayers) playerRowsHtml = '<div class="no-item">なし</div>';
        htmlCardsItemCenter += `<div class="player-card"><div class="player-header">📦 ${escapeHtml(itemName)}</div><div class="item-list">${playerRowsHtml}</div></div>`;
    });

    const pageMainTitle = eventParam ? `🎁 アイテム分配・配布チェックリスト（${eventParam}）` : '🎁 アイテム分配・配布チェックリスト';
    const startDate = new Date();
    startDate.setDate(lotteryDate.getDate() + waitDays);
    const startDateString = startDate.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' });
    
    // CSSスタイルシート
    const cssStyle = `<style>*{box-sizing:border-box;}body{font-family:'Helvetica Neue',Arial,sans-serif;background-color:#f4f6f9;color:#2c3e50;margin:0;padding:15px;font-size:15px;}.container{max-width:800px;margin:0 auto;background:#fff;padding:20px;border-radius:8px;box-shadow:0 4px 6px rgba(0,0,0,0.05);}h1{font-size:20px;display:flex;align-items:center;justify-content:center;gap:8px;margin-top:0;margin-bottom:20px;color:#2c3e50;font-weight:bold;}.meta{background:#f8f9fa;padding:12px 15px;border-radius:6px;margin-bottom:20px;font-size:13px;line-height:1.6;border-left:4px solid #5865F2;}.mode-tabs{display:flex;gap:10px;margin-bottom:20px;border-bottom:2px solid #dee2e6;padding-bottom:10px;}.tab-btn{padding:10px 20px;background:#e9ecef;border:none;border-radius:6px;font-weight:bold;color:#495057;cursor:pointer;transition:all 0.2s;font-size:14px;}.tab-btn:hover{background:#ced4da;}.tab-btn.active-tab{background:#5865F2;color:white;}.search-container{display:flex;gap:8px;margin-bottom:20px;width:100%;}.search-input{flex:1;padding:10px 15px;border:1px solid #ced4da;border-radius:4px;font-size:14px;outline:none;}.search-input:focus{border-color:#5865F2;box-shadow:0 0 0 2px rgba(88,101,242,0.2);}.clear-btn{padding:0 20px;background-color:#dc3545;color:white;border:none;border-radius:4px;font-weight:bold;font-size:14px;cursor:pointer;transition:background 0.2s;white-space:nowrap;}.clear-btn:hover{background-color:#bd2130;}.player-card{background:#fff;border:1px solid #dee2e6;border-radius:6px;margin-bottom:15px;overflow:hidden;box-shadow:0 2px 4px rgba(0,0,0,0.02);}.player-header{background-color:#e9ecef;padding:10px 15px;font-weight:bold;font-size:15px;color:#343a40;display:flex;align-items:center;gap:6px;}.item-list{background:#fff;}.item-row{display:flex;justify-content:space-between;align-items:center;padding:12px 15px;border-top:1px solid #eee;cursor:pointer;transition:background-color 0.2s;}.item-row:hover{background-color:#f8f9fa;}.item-left{display:flex;align-items:center;gap:12px;}.item-name{font-size:14px;color:#2c3e50;}.item-count{font-size:14px;color:#6c757d;font-family:monospace;}.item-row.checked-row{background-color:#f8f9fa!important;color:#adb5bd;opacity:0.6;text-decoration:line-through;}.item-row.checked-row .item-name,.item-row.checked-row .item-count {color:#adb5bd;}input[type="checkbox"]{transform:scale(1.2);cursor:pointer;}.no-item{padding:12px 15px;color:#999;font-style:italic;}.view-area{display:none;}.view-area.active-view{display:block;}@media(max-width:576px){body{padding:8px;font-size:13px;}.container{padding:15px;border-radius:4px;}h1{font-size:16px;}.tab-btn{padding:8px 12px;font-size:12px;}.player-header{padding:8px 12px;font-size:14px;}.item-row{padding:10px 12px;}.search-input{padding:8px 12px;font-size:13px;}.clear-btn{padding:0 15px;font-size:13px;}}</style>`;
    // フロントエンド用JavaScript
    const jsScript = `<script>let currentMode = 'player';function switchMode(mode) { currentMode = mode; const tabItem = document.getElementById('tabItem'); const tabPlayer = document.getElementById('tabPlayer'); const viewItem = document.getElementById('itemCenterView'); const viewPlayer = document.getElementById('playerCenterView'); if(mode === 'player') { tabPlayer.classList.add('active-tab'); tabItem.classList.remove('active-tab'); viewPlayer.classList.add('active-view'); viewItem.classList.remove('active-view'); } else { tabPlayer.classList.remove('active-tab'); tabItem.classList.add('active-tab'); viewPlayer.classList.remove('active-view'); viewItem.classList.add('active-view'); } filterCards();}function toggleItemRow(e){ const t=e.querySelector('input[type="checkbox"]'); if(t){ if(event.target!==t) t.checked=!t.checked; if(t.checked){ e.classList.add('checked-row') }else{ e.classList.remove('checked-row') } }}function filterCards(){ const query=document.getElementById('searchInput').value.toLowerCase(); const activeViewId = currentMode === 'item' ? '#itemCenterView' : '#playerCenterView'; Array.from(document.querySelectorAll(activeViewId + ' .player-card')).forEach(card=>{ const headerText=card.querySelector('.player-header').textContent.toLowerCase(); const rows=Array.from(card.querySelectorAll('.item-row')); let headerMatched = headerText.includes(query); let rowMatched = false; rows.forEach(row=>{ const rowText=row.querySelector('.item-name').textContent.toLowerCase(); if(rowText.includes(query)){ row.style.display=""; rowMatched = true; }else{ row.style.display=headerMatched?"":"none"; } }); if(headerMatched||rowMatched){ card.style.display=""; }else{ card.style.display="none"; } });}function clearSearch(){ document.getElementById('searchInput').value=''; filterCards();}</script>`;

    // 骨格テンプレートを返却
    // 🛠️【完全修復】「ギルド」を排除し、安全にバッククォート内のHTMLコメントとしてプレビュー文を仕込みました！
    return `<!--
📊 分配結果チェックリストHTML 📊
ファイルをダウンロード後、ブラウザで開いて確認してください。
（※この枠はDiscordによるファイル内容の自動プレビュー表示です）
--------------------------------------------------
-->
<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>配布チェックリスト</title>${cssStyle}</head><body><div class="container"><h1>${escapeHtml(pageMainTitle)}</h1><div class="meta"><strong>対象日（昨日）:</strong> ${yesterdayString}<br><strong>抽選日:</strong> ${lotteryDateString}<br>${waitDays > 0 ? `<strong>分配開始予定日:</strong> ${startDateString} (待期期間: ${waitDays}日)<br>` : ''}<strong>方式:</strong> ` + (Object.keys(remainderWinnersMap).length > 0 ? '均等分配' : 'ランダム分配') + `</div><div class="mode-tabs"><button id="tabPlayer" class="tab-btn active-tab" onclick="switchMode('player')">👤 プレイヤー名中心</button><button id="tabItem" class="tab-btn" onclick="switchMode('item')">📦 アイテム名中心</button></div><div class="search-container"><input type="text" id="searchInput" class="search-input" placeholder="名前で検索..." onkeyup="filterCards()"><button class="clear-btn" onclick="clearSearch()">クリア</button></div><div id="playerCenterView" class="view-area active-view">${htmlCardsPlayerCenter}</div><div id="itemCenterView" class="view-area">${htmlCardsItemCenter}</div></div>${jsScript}</body></html>`;
}

// 外部へ関数をエクスポート
module.exports = { generateChecklistHtml };
