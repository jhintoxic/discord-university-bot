const fs = require('node:fs');
const path = require('node:path');
const { EmbedBuilder } = require('discord.js');

const CAFETERIA_URL = 'https://www.zokei.ac.jp/university/cafeteria/';
const STATE_PATH = path.join(__dirname, '..', 'data', 'cafeteria-state.json');
const POLL_INTERVAL_MS = 30 * 60 * 1000;

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_PATH, 'utf-8'));
  } catch {
    return { channelIds: [], lastPostedHeading: null };
  }
}

function saveState() {
  fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

const state = loadState();
let clientRef = null;
let timer = null;

async function fetchTodayMenu() {
  const res = await fetch(CAFETERIA_URL, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; UniversityBot/1.0)' },
  });
  if (!res.ok) throw new Error(`学食ページの取得に失敗しました: HTTP ${res.status}`);
  const html = await res.text();

  const headingMatch = html.match(/<h3>【([^】]+)のメニュー】<\/h3>/);
  const heading = headingMatch ? headingMatch[1] : '本日';

  const listMatch = html.match(/<div class="menulist">([\s\S]*?)<\/div>/);
  if (!listMatch) return { heading, items: [] };

  const items = [];
  const itemRe = /<p>[\s\S]*?\/>\s*([^<]+?)<br \/>\s*<strong>([^<]+)<\/strong><br \/>\s*<span class="sml">([\s\S]*?)<\/span>/g;
  let m;
  while ((m = itemRe.exec(listMatch[1])) !== null) {
    items.push({
      name: m[1].trim(),
      price: m[2].trim(),
      info: m[3].replace(/\s+/g, ' ').trim(),
    });
  }
  return { heading, items };
}

function buildMenuEmbed(heading, items) {
  const lines = items.map(i => `**${i.name}** ${i.price}\n　${i.info}`);
  return new EmbedBuilder()
    .setColor(0x2a9d8f)
    .setTitle(`🍽️ ${heading}の学食メニュー`)
    .setDescription(lines.join('\n'))
    .setURL(CAFETERIA_URL);
}

async function poll() {
  if (!clientRef || state.channelIds.length === 0) return;

  let heading, items;
  try {
    ({ heading, items } = await fetchTodayMenu());
  } catch (err) {
    console.error('学食メニュー取得エラー:', err);
    return;
  }

  if (items.length === 0) return;
  if (heading === state.lastPostedHeading) return;

  state.lastPostedHeading = heading;
  saveState();

  const embed = buildMenuEmbed(heading, items);
  for (const channelId of state.channelIds) {
    const channel = await clientRef.channels.fetch(channelId).catch(() => null);
    if (channel) {
      await channel.send({ content: '🍚 今日の学食メニューが公開されました!', embeds: [embed] }).catch(() => {});
    }
  }
}

function startPolling() {
  if (timer) return;
  poll();
  timer = setInterval(poll, POLL_INTERVAL_MS);
}

function stopPolling() {
  clearInterval(timer);
  timer = null;
}

function init(client) {
  clientRef = client;
  if (state.channelIds.length > 0) startPolling();
}

function subscribe(channelId) {
  if (!state.channelIds.includes(channelId)) {
    state.channelIds.push(channelId);
    saveState();
  }
  startPolling();
}

function unsubscribe(channelId) {
  state.channelIds = state.channelIds.filter(id => id !== channelId);
  saveState();
  if (state.channelIds.length === 0) stopPolling();
}

function isSubscribed(channelId) {
  return state.channelIds.includes(channelId);
}

function status() {
  return {
    channelIds: [...state.channelIds],
    lastPostedHeading: state.lastPostedHeading,
    polling: Boolean(timer),
  };
}

module.exports = {
  init,
  fetchTodayMenu,
  buildMenuEmbed,
  subscribe,
  unsubscribe,
  isSubscribed,
  status,
  poll,
  CAFETERIA_URL,
};
