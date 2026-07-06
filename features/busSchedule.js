const SCHEDULE = {
  weekday: {
    aihara: [
      '8:25', '8:33', '8:42', '8:54',
      '9:00', '9:07', '9:17', '9:27', '9:41', '9:55',
      '10:12', '10:23', '10:33', '10:43', '10:56',
      '11:12', '11:22', '11:41',
      '12:21', '12:32', '12:42', '12:53',
      '13:03', '13:13', '13:23', '13:33', '13:53',
      '14:12', '14:23', '14:37', '14:53',
      '15:05', '15:16', '15:32', '15:53',
      '16:09', '16:22', '16:40', '16:52',
      '17:02', '17:12', '17:22', '17:32', '17:44', '17:58',
      '18:14', '18:29', '18:41', '18:54',
      '19:12', '19:24', '19:39', '19:59',
    ],
    university: [
      '8:20', '8:25', '8:33', '8:49', '8:54',
      '9:00', '9:12', '9:22', '9:36', '9:50',
      '10:07', '10:18', '10:28', '10:38', '10:51',
      '11:07', '11:17', '11:36',
      '12:16', '12:27', '12:37', '12:48', '12:58',
      '13:08', '13:18', '13:28', '13:48',
      '14:07', '14:18', '14:32', '14:48',
      '15:00', '15:11', '15:27', '15:48',
      '16:04', '16:17', '16:35', '16:47', '16:57',
      '17:07', '17:17', '17:27', '17:39', '17:53',
      '18:09', '18:24', '18:36', '18:49',
      '19:07', '19:19', '19:34', '19:54',
      '20:06', '20:27', '20:44', '20:56',
      '21:09', '21:28',
    ],
  },
  saturday: {
    aihara: [
      '8:26', '8:36', '8:43', '8:54',
      '9:07', '9:27', '9:42',
      '10:07', '10:21', '10:40', '10:56',
      '11:12', '11:24', '11:41',
      '12:20', '12:40', '12:56',
      '13:16', '13:40',
      '14:21', '14:52',
      '15:21', '15:52',
      '16:21', '16:52',
      '17:12', '17:32', '17:44',
      '18:03', '18:22', '18:46',
    ],
    university: [
      '8:20', '8:31', '8:36', '8:49',
      '9:02', '9:22', '9:37',
      '10:02', '10:16', '10:35', '10:51',
      '11:07', '11:19', '11:36',
      '12:15', '12:35', '12:51',
      '13:11', '13:35',
      '14:16', '14:47',
      '15:16', '15:47',
      '16:16', '16:47',
      '17:07', '17:27', '17:39', '17:58',
      '18:17', '18:41',
      '19:11', '19:34',
      '20:05', '20:25',
    ],
  },
};

const DAY_LABELS = {
  weekday: '平日',
  saturday: '土曜日',
  sunday: '日曜・祝日',
};

function getDayType(date) {
  const day = date.getDay();
  if (day === 0) return 'sunday';
  if (day === 6) return 'saturday';
  return 'weekday';
}

function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function getUpcoming(direction, date = new Date(), count = 3) {
  const dayType = getDayType(date);
  if (dayType === 'sunday') {
    return { dayType, times: [], finished: false };
  }

  const times = SCHEDULE[dayType][direction];
  const nowMin = date.getHours() * 60 + date.getMinutes();
  const upcoming = times.filter(t => toMinutes(t) >= nowMin).slice(0, count);

  return { dayType, times: upcoming, finished: upcoming.length === 0 };
}

const CATCH_UP_WINDOW_MIN = 60;

function getCatchUpList(periods, date = new Date()) {
  const dayType = getDayType(date);
  const nowMin = date.getHours() * 60 + date.getMinutes();

  if (dayType === 'sunday') {
    return { dayType, results: [] };
  }

  const times = SCHEDULE[dayType].aihara;

  const results = Object.entries(periods).map(([periodNum, period]) => {
    const startMin = toMinutes(period.start);
    if (startMin < nowMin) {
      return { period: Number(periodNum), start: period.start, passed: true, candidates: [] };
    }
    const windowStart = startMin - CATCH_UP_WINDOW_MIN;
    const candidates = times.filter(t => {
      const m = toMinutes(t);
      return m >= windowStart && m <= startMin;
    });
    return { period: Number(periodNum), start: period.start, passed: false, candidates };
  });

  return { dayType, results };
}

module.exports = { getUpcoming, getDayType, getCatchUpList, DAY_LABELS };
