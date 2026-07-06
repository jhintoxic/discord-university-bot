const fs = require('node:fs');
const path = require('node:path');
const { EmbedBuilder } = require('discord.js');

const STATE_PATH = path.join(__dirname, '..', 'data', 'timetable-state.json');
const DAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];
const CHECK_INTERVAL_MS = 60 * 1000;
const REMINDER_MINUTES_BEFORE = 10;
const MAX_FIRED_KEYS = 500;

const PERIODS = {
  1: { start: '09:00', end: '10:40' },
  2: { start: '10:50', end: '12:30' },
  3: { start: '13:20', end: '15:00' },
  4: { start: '15:10', end: '16:50' },
  5: { start: '17:00', end: '18:40' },
};

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_PATH, 'utf-8'));
  } catch {
    return { entries: [], subscriptions: [] };
  }
}

function saveState() {
  fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

const state = loadState();
let clientRef = null;
let timer = null;

function subtractMinutes(hhmm, minutes) {
  const [h, m] = hhmm.split(':').map(Number);
  const total = (((h * 60 + m - minutes) % 1440) + 1440) % 1440;
  const hh = Math.floor(total / 60).toString().padStart(2, '0');
  const mm = (total % 60).toString().padStart(2, '0');
  return `${hh}:${mm}`;
}

function addEntry(userId, day, period, title) {
  const entry = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, userId, day, period, title };
  state.entries.push(entry);
  saveState();
  return entry;
}

function listEntries(userId) {
  return state.entries
    .filter(e => e.userId === userId)
    .sort((a, b) => (a.day - b.day) || (a.period - b.period));
}

function removeEntry(userId, index) {
  const sorted = listEntries(userId);
  const target = sorted[index - 1];
  if (!target) return null;
  state.entries = state.entries.filter(e => e.id !== target.id);
  saveState();
  return target;
}

function entriesForDay(userId, day, keyword) {
  let entries = listEntries(userId).filter(e => e.day === day);
  if (keyword) entries = entries.filter(e => e.title.includes(keyword));
  return entries;
}

function buildDaySchedule(userId, day, keyword) {
  const entries = entriesForDay(userId, day, keyword);
  if (entries.length === 0) {
    return keyword
      ? `${DAY_LABELS[day]}曜日に「${keyword}」を含む予定はありません。`
      : `${DAY_LABELS[day]}曜日の予定はありません。`;
  }
  return entries
    .map(e => `${e.period}限(${PERIODS[e.period].start}〜${PERIODS[e.period].end}) ${e.title}`)
    .join('\n');
}

function subscribe(channelId, userId, time, keyword) {
  const existing = state.subscriptions.find(s => s.channelId === channelId && s.userId === userId);
  if (existing) {
    existing.time = time;
    existing.keyword = keyword || null;
    existing.lastDigestDate = null;
  } else {
    state.subscriptions.push({ channelId, userId, time, keyword: keyword || null, lastDigestDate: null, firedKeys: [] });
  }
  saveState();
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

async function sendToSub(sub, content, embed) {
  const channel = await clientRef.channels.fetch(sub.channelId).catch(() => null);
  if (!channel) return;
  await channel.send({ content: `<@${sub.userId}> ${content}`, embeds: embed ? [embed] : undefined }).catch(() => {});
}

async function announceToday(sub, day) {
  const embed = new EmbedBuilder()
    .setColor(0x457b9d)
    .setTitle(`🗓️ 今日(${DAY_LABELS[day]})の時間割${sub.keyword ? `(「${sub.keyword}」のみ)` : ''}`)
    .setDescription(buildDaySchedule(sub.userId, day, sub.keyword));
  await sendToSub(sub, '', embed);
}

function markFired(sub, key) {
  sub.firedKeys = sub.firedKeys || [];
  sub.firedKeys.push(key);
  if (sub.firedKeys.length > MAX_FIRED_KEYS) {
    sub.firedKeys = sub.firedKeys.slice(-MAX_FIRED_KEYS);
  }
}

function hasFired(sub, key) {
  return (sub.firedKeys || []).includes(key);
}

async function tick() {
  if (!clientRef || state.subscriptions.length === 0) return;

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const day = now.getDay();
  const hh = now.getHours().toString().padStart(2, '0');
  const mm = now.getMinutes().toString().padStart(2, '0');
  const currentTime = `${hh}:${mm}`;

  for (const sub of state.subscriptions) {
    if (sub.time === currentTime && sub.lastDigestDate !== todayStr) {
      sub.lastDigestDate = todayStr;
      await announceToday(sub, day);
    }

    for (const entry of entriesForDay(sub.userId, day, sub.keyword)) {
      const period = PERIODS[entry.period];
      const startReminderTime = subtractMinutes(period.start, REMINDER_MINUTES_BEFORE);
      const endReminderTime = subtractMinutes(period.end, REMINDER_MINUTES_BEFORE);
      const startKey = `${todayStr}-${entry.id}-start`;
      const endKey = `${todayStr}-${entry.id}-end`;

      if (currentTime === startReminderTime && !hasFired(sub, startKey)) {
        markFired(sub, startKey);
        await sendToSub(sub, `📚 まもなく「${entry.title}」(${entry.period}限)が始まります!`);
      }
      if (currentTime === endReminderTime && !hasFired(sub, endKey)) {
        markFired(sub, endKey);
        await sendToSub(sub, `⏰ 「${entry.title}」(${entry.period}限)がまもなく終わります!`);
      }
    }
  }
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
  addEntry,
  listEntries,
  removeEntry,
  buildDaySchedule,
  subscribe,
  unsubscribe,
  getSubscription,
  DAY_LABELS,
  PERIODS,
};
