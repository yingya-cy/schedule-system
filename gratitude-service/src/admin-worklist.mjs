export function summarizeWorklist(people, records, scores, days, today) {
  const completed = new Map(), judged = new Map();
  const validDays = new Set(days.map(day => day.day_no));
  for (const record of records) {
    if (!validDays.has(+record.day_no)) continue;
    const id = +record.participant_id;
    if (!completed.has(id)) completed.set(id, new Set());
    completed.get(id).add(+record.day_no);
  }
  for (const score of scores) {
    const name = String(score.judge_name || '').trim(), id = +score.participant_id;
    if (!name) continue;
    if (!judged.has(id)) judged.set(id, new Set());
    judged.get(id).add(name);
  }
  const elapsed = days.filter(day => day.date < today).slice().reverse();
  const current = days.find(day => day.date === today);
  return {
    total: people.length, total_days: days.length, today_day_no: current?.day_no ?? null,
    worklist_ready: true,
    list: people.map(person => {
      const done = completed.get(+person.id) || new Set();
      let missed = 0;
      for (const day of elapsed) { if (done.has(day.day_no)) break; missed++; }
      return { ...person, days_done: done.size, today_done: !!current && done.has(current.day_no), miss_streak: missed, judges: [...(judged.get(+person.id) || [])] };
    })
  };
}
