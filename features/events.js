const fs = require('node:fs');
const path = require('node:path');
const { EmbedBuilder } = require('discord.js');

const STATE_PATH = path.join(__dirname, '..', 'data', 'events-state.json');
const CHECK_INTERVAL_MS = 60 * 60 * 1000;
const NOTIFY_DAYS_BEFORE = 7;

const TYPE_INFO = {
  締切: { emoji: '🔔', color: 0xe76f51 },
  テスト: { emoji: '📝', color: 0x457b9d },
  発表: { emoji: '🎤', color: 0x2a9d8f },
};

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_PATH, 'utf-8'));
  } catch {
    return { events: [], subscriptions: [] };
  }
}

function saveState() {
  fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

const state = loadState();
let clientRef = null;
let timer = null;

function parseDate(dateStr, timeStr) {
  const [m, d] = dateStr.split('/').map(Number);
  const now = new Date();
  let year = now.getFullYear();
  const [hh, mm] = (timeStr || '23:59').split(':').map(Number);
  let when = new Date(year, m - 1, d, hh, mm);
  if (when.getTime() < now.getTime() - 86400000) {
    when = new Date(year + 1, m - 1, d, hh, mm);
  }
  return when;
}

function formatWhen(when) {
  const m = when.getMonth() + 1;
  const d = when.getDate();
  const hh = when.getHours().toString().padStart(2, '0');
  const mm = when.getMinutes().toString().padStart(2, '0');
  return `${m}/${d} ${hh}:${mm}`;
}

function addEvent(userId, type, title, dateStr, timeStr) {
  const when = parseDate(dateStr, timeStr);
  const event = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    userId,
    type,
    title,
    at: when.toISOString(),
    notified: false,
  };
  state.events.push(event);
  saveState();
  return event;
}

function listEvents(userId) {
  return state.events
    .filter(e => e.userId === userId)
    .sort((a, b) => new Date(a.at) - new Date(b.at));
}

function removeEvent(userId, index) {
  const sorted = listEvents(userId);
  const target = sorted[index - 1];
  if (!target) return null;
  state.events = state.events.filter(e => e.id !== target.id);
  saveState();
  return target;
}

function subscribe(channelId, userId) {
  const existing = state.subscriptions.find(s => s.channelId === channelId && s.userId === userId);
  if (!existing) {
    state.subscriptions.push({ channelId, userId });
    saveState();
  }
  startTimer();
}

function unsubscribe(channelId, userId) {
  state.subscriptions = state.subscriptions.filter(s => !(s.channelId === channelId && s.userId === userId));
  saveState();
  if (state.subscriptions.length === 0) stopTimer();
}

function getSubscription(channelId, userId) {
  return state.subscriptions.find(s => s.channelId === channelId && s.userId === userId) || null;
}

async function announce(sub, event, diffDays) {
  const channel = await clientRef.channels.fetch(sub.channelId).catch(() => null);
  if (!channel) return;
  const info = TYPE_INFO[event.type] || { emoji: '📌', color: 0xf4a261 };
  const whenText = diffDays === 0 ? '今日' : `あと${diffDays}日`;
  const embed = new EmbedBuilder()
    .setColor(info.color)
    .setTitle(`${info.emoji} 【${event.type}】${whenText}: ${event.title}`)
    .setDescription(`日時: ${formatWhen(new Date(event.at))}`);
  await channel.send({ content: `<@${sub.userId}>`, embeds: [embed] }).catch(() => {});
}

async function tick() {
  if (!clientRef || state.subscriptions.length === 0) return;

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  for (const event of state.events) {
    if (event.notified) continue;
    const at = new Date(event.at);
    const dateStart = new Date(at.getFullYear(), at.getMonth(), at.getDate());
    const diffDays = Math.round((dateStart - todayStart) / 86400000);

    if (diffDays >= 0 && diffDays <= NOTIFY_DAYS_BEFORE) {
      event.notified = true;
      const subs = state.subscriptions.filter(s => s.userId === event.userId);
      for (const sub of subs) {
        await announce(sub, event, diffDays);
      }
    }
  }

  state.events = state.events.filter(e => new Date(e.at).getTime() > now.getTime() - 86400000);
  saveState();
}

function startTimer() {
  if (timer) return;
  timer = setInterval(tick, CHECK_INTERVAL_MS);
}

function stopTimer() {
  clearInterval(timer);
  timer = null;
}

function init(client) {
  clientRef = client;
  if (state.subscriptions.length > 0) startTimer();
}

module.exports = {
  init,
  addEvent,
  listEvents,
  removeEvent,
  subscribe,
  unsubscribe,
  getSubscription,
  formatWhen,
  tick,
  TYPE_INFO,
};
