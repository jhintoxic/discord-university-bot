const fs = require('node:fs');
const path = require('node:path');
const { EmbedBuilder } = require('discord.js');

const STATE_PATH = path.join(__dirname, '..', 'data', 'assignments-state.json');
const CHECK_INTERVAL_MS = 60 * 60 * 1000;
const STAGES = [
  { key: '3d', daysBefore: 3, label: '締切まであと3日' },
  { key: '1d', daysBefore: 1, label: '締切まであと1日' },
  { key: '0d', daysBefore: 0, label: '締切は今日中' },
];

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_PATH, 'utf-8'));
  } catch {
    return { assignments: [], subscriptions: [] };
  }
}

function saveState() {
  fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

const state = loadState();
let clientRef = null;
let timer = null;

function parseDue(dateStr, timeStr) {
  const [m, d] = dateStr.split('/').map(Number);
  const now = new Date();
  let year = now.getFullYear();
  const [hh, mm] = (timeStr || '23:59').split(':').map(Number);
  let due = new Date(year, m - 1, d, hh, mm);
  if (due.getTime() < now.getTime() - 86400000) {
    due = new Date(year + 1, m - 1, d, hh, mm);
  }
  return due;
}

function formatDue(due) {
  const m = due.getMonth() + 1;
  const d = due.getDate();
  const hh = due.getHours().toString().padStart(2, '0');
  const mm = due.getMinutes().toString().padStart(2, '0');
  return `${m}/${d} ${hh}:${mm}`;
}

function addAssignment(userId, title, dateStr, timeStr) {
  const due = parseDue(dateStr, timeStr);
  const assignment = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    userId,
    title,
    dueAt: due.toISOString(),
    notifiedStages: [],
  };
  state.assignments.push(assignment);
  saveState();
  return assignment;
}

function listAssignments(userId) {
  return state.assignments
    .filter(a => a.userId === userId)
    .sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt));
}

function removeAssignment(userId, index) {
  const sorted = listAssignments(userId);
  const target = sorted[index - 1];
  if (!target) return null;
  state.assignments = state.assignments.filter(a => a.id !== target.id);
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

async function announce(sub, assignment, stage) {
  const channel = await clientRef.channels.fetch(sub.channelId).catch(() => null);
  if (!channel) return;
  const due = new Date(assignment.dueAt);
  const embed = new EmbedBuilder()
    .setColor(stage.daysBefore === 0 ? 0xe76f51 : 0xf4a261)
    .setTitle(`📝 課題リマインダー: ${stage.label}`)
    .setDescription(`**${assignment.title}**\n締切: ${formatDue(due)}`);
  await channel.send({ content: `<@${sub.userId}>`, embeds: [embed] }).catch(() => {});
}

async function tick() {
  if (!clientRef || state.subscriptions.length === 0) return;

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  for (const assignment of state.assignments) {
    const due = new Date(assignment.dueAt);
    const dueDateStart = new Date(due.getFullYear(), due.getMonth(), due.getDate());
    const diffDays = Math.round((dueDateStart - todayStart) / 86400000);

    for (const stage of STAGES) {
      if (diffDays === stage.daysBefore && !assignment.notifiedStages.includes(stage.key)) {
        assignment.notifiedStages.push(stage.key);
        const subs = state.subscriptions.filter(s => s.userId === assignment.userId);
        for (const sub of subs) {
          await announce(sub, assignment, stage);
        }
      }
    }
  }

  state.assignments = state.assignments.filter(a => new Date(a.dueAt).getTime() > now.getTime() - 86400000);
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
  addAssignment,
  listAssignments,
  removeAssignment,
  subscribe,
  unsubscribe,
  getSubscription,
  formatDue,
  tick,
};
