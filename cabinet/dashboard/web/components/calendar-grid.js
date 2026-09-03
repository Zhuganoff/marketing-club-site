// Календарная сетка: неделя / месяц, материалы и кампании, mock drag-and-drop с уважением согласования.
                                     
import { api } from '../api.js?v=mtlslcfn';
import { h, kindChip, dateKey, timeOf, fmtDay, addDays, todayKey, mondayOf, KIND_COLOR, ART_STATUS_SHORT } from '../ui.js?v=mtlslcfn';

                                                                                                                     

const LOCK_REASON = 'Время зафиксировано согласованием — перенос через правку материала';
const MOVABLE = new Set(['DRAFT', 'IN_REVIEW']);

function monthStart(key        )         { return key.slice(0, 7) + '-01'; }

export function calendarDays(opts              )           {
  if (opts.mode === 'week') { const m = mondayOf(opts.anchor); return Array.from({ length: 7 }, (_, i) => addDays(m, i)); }
  const m = mondayOf(monthStart(opts.anchor));
  return Array.from({ length: 42 }, (_, i) => addDays(m, i));
}

function artifactItems(app     )        {
  const st = app.state;
  return st.artifacts.filter((a     ) => (a.kind === 'draft' || a.kind === 'weekly_report') && a.scheduledAt).map((a     ) => {
    const task = st.tasks.find((t     ) => t.id === a.taskId);
    return { artifact: a, kind: task?.kind ?? (a.kind === 'weekly_report' ? 'weekly_report' : 'post'), archived: Boolean(task?.archived) };
  }).filter((x     ) => !x.archived);
}

function chip(app     , item     , opts              )              {
  const a = item.artifact;
  const movable = MOVABLE.has(a.status);
  const el = h('div', {
    class: `cal-chip${opts.dnd && !movable ? ' locked' : ''}${opts.dnd && movable ? ' movable' : ''}`,
    style: { '--chip': KIND_COLOR[item.kind] ?? 'var(--ink-3)' },
    title: opts.dnd && !movable ? LOCK_REASON : `${a.title} · ${ART_STATUS_SHORT[a.status] ?? a.status}`,
    draggable: opts.dnd && movable ? 'true' : 'false',
    onClick: () => app.go('content', { artifact: a.id }),
  },
    h('span', { class: 'cal-time' }, timeOf(a.scheduledAt)),
    h('span', { class: 'cal-title' }, a.title),
    h('span', { class: `cal-status s-${a.status}` }, ART_STATUS_SHORT[a.status] ?? a.status),
    opts.dnd && !movable ? h('span', { class: 'lock', 'aria-hidden': 'true' }, '🔒') : null);
  if (opts.dnd) {
    el.addEventListener('dragstart', (e           ) => {
      if (!movable) { e.preventDefault(); opts.onError?.(LOCK_REASON); return; }
      e.dataTransfer?.setData('text/plain', a.id);
      if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
      el.classList.add('dragging');
    });
    el.addEventListener('dragend', () => el.classList.remove('dragging'));
  }
  return el;
}

function attachDrop(app     , cell             , dayKey        , opts              ) {
  cell.addEventListener('dragover', (e           ) => { e.preventDefault(); cell.classList.add('drop-target'); if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'; });
  cell.addEventListener('dragleave', () => cell.classList.remove('drop-target'));
  cell.addEventListener('drop', (e           ) => {
    e.preventDefault(); cell.classList.remove('drop-target');
    const id = e.dataTransfer?.getData('text/plain');
    if (!id) return;
    const a = app.state.artifacts.find((x     ) => x.id === id);
    if (!a) return;
    if (!MOVABLE.has(a.status)) { opts.onError?.(LOCK_REASON); return; }
    const time = a.scheduledAt && timeOf(a.scheduledAt) !== '—' ? timeOf(a.scheduledAt) : '11:00';
    const newAt = `${dayKey}T${time}`;
    if (dateKey(a.scheduledAt) === dayKey) return;
    app.act(() => api.reschedule(app.pid, a.id, newAt, null, app.actor()), 'Перенесено').then((ok) => { if (ok) opts.onError?.(''); });
  });
}

export function calendarGrid(app     , opts              )              {
  const st = app.state;
  const days = calendarDays(opts);
  const items = artifactItems(app);
  const today = todayKey();
  const month = opts.anchor.slice(0, 7);
  const first = days[0], last = days[days.length - 1];
  const campaigns = st.campaigns.filter((c     ) => c.period.from <= last && c.period.to >= first);

  const spans = h('div', { class: 'cal-spans' }, ...campaigns.map((c     ) => {
    const from = c.period.from < first ? first : c.period.from;
    const to = c.period.to > last ? last : c.period.to;
    const startIdx = days.indexOf(from), endIdx = days.indexOf(to);
    if (startIdx < 0 || endIdx < 0) return null;
    return h('div', { class: 'cal-span', style: { gridColumn: `${startIdx + 1} / ${endIdx + 2}`, '--chip': 'var(--kind-campaign)' }, title: `${c.name} · ${c.period.from} — ${c.period.to}`, onClick: () => app.go('campaigns', { campaign: c.id }) },
      kindChip('campaign', c.name), c.period.from < first ? h('span', { class: 'muted small' }, ' ← продолжается') : null, c.period.to > last ? h('span', { class: 'muted small' }, ' продолжается →') : null);
  }));
  const spansMonth = opts.mode === 'month' ? (() => {
    const rows                = [];
    for (let r = 0; r < 6; r++) {
      const wk = days.slice(r * 7, r * 7 + 7);
      const row = h('div', { class: 'cal-spans' }, ...campaigns.map((c     ) => {
        const from = c.period.from < wk[0] ? wk[0] : c.period.from; const to = c.period.to > wk[6] ? wk[6] : c.period.to;
        const s = wk.indexOf(from), e = wk.indexOf(to);
        if (s < 0 || e < 0 || from > to) return null;
        return h('div', { class: 'cal-span', style: { gridColumn: `${s + 1} / ${e + 2}`, '--chip': 'var(--kind-campaign)' }, title: c.name, onClick: () => app.go('campaigns', { campaign: c.id }) }, kindChip('campaign', c.name));
      }));
      rows.push(row);
    }
    return rows;
  })() : null;

  const cells = days.map((key) => {
    const inMonth = opts.mode === 'week' || key.slice(0, 7) === month;
    const dayItems = items.filter((x     ) => dateKey(x.artifact.scheduledAt) === key).sort((a     , b     ) => String(a.artifact.scheduledAt).localeCompare(String(b.artifact.scheduledAt)));
    const cell = h('div', { class: `cal-cell${inMonth ? '' : ' out'}${key === today ? ' today' : ''}`, 'data-day': key },
      h('div', { class: 'cal-day' }, opts.mode === 'week' ? fmtDay(key) : String(Number(key.slice(8, 10)))),
      ...dayItems.map((x     ) => chip(app, x, opts)),
      dayItems.length === 0 && opts.mode === 'week' ? h('div', { class: 'muted small cal-empty' }, st.project.publishingRules.preferredHours.join(' · ')) : null);
    if (opts.dnd) attachDrop(app, cell, key, opts);
    return cell;
  });

  if (opts.mode === 'week') return h('div', { class: 'cal-grid week' }, spans, h('div', { class: 'cal-cells' }, ...cells));
  const weekRows                = [];
  for (let r = 0; r < 6; r++) weekRows.push(h('div', { class: 'cal-week' }, spansMonth [r], h('div', { class: 'cal-cells' }, ...cells.slice(r * 7, r * 7 + 7))));
  const header = h('div', { class: 'cal-cells cal-head' }, ...['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'].map((d) => h('div', { class: 'cal-dow' }, d)));
  return h('div', { class: 'cal-grid month' }, header, ...weekRows);
}
