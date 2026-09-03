                                     
import { h, addDays, todayKey, mondayOf, kindChip, ART_STATUS_SHORT } from '../ui.js?v=mtlslcfn';
import { calendarGrid } from '../components/calendar-grid.js?v=mtlslcfn';

let lastError = '';

function shiftMonth(key        , n        )         {
  const d = new Date(key.slice(0, 7) + '-01T00:00:00'); d.setMonth(d.getMonth() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function rangeLabel(mode        , anchor        )         {
  if (mode === 'month') return new Date(anchor.slice(0, 7) + '-01T00:00:00').toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
  const m = mondayOf(anchor); const e = addDays(m, 6);
  const f = (k        ) => new Date(k + 'T00:00:00').toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' });
  return `${f(m)} — ${f(e)}`;
}

export function render(app     )              {
  const mode = app.sel.mode === 'month' ? 'month' : 'week';
  const anchor = app.sel.anchor && /^\d{4}-\d{2}-\d{2}$/.test(app.sel.anchor) ? app.sel.anchor : todayKey();
  const go = (patch                        ) => app.go('calendar', { mode, anchor, ...patch });
  const prev = mode === 'week' ? addDays(anchor, -7) : shiftMonth(anchor, -1);
  const next = mode === 'week' ? addDays(anchor, 7) : shiftMonth(anchor, 1);

  const toolbar = h('div', { class: 'toolbar', style: { marginBottom: '12px' } },
    h('div', { class: 'seg' }, h('button', { class: mode === 'week' ? 'active' : '', onClick: () => go({ mode: 'week' }) }, 'Неделя'), h('button', { class: mode === 'month' ? 'active' : '', onClick: () => go({ mode: 'month' }) }, 'Месяц')),
    h('button', { class: 'btn sm', onClick: () => go({ anchor: prev }), 'aria-label': 'Назад' }, '‹'),
    h('span', { class: 'cal-range' }, rangeLabel(mode, anchor)),
    h('button', { class: 'btn sm', onClick: () => go({ anchor: next }), 'aria-label': 'Вперёд' }, '›'),
    h('button', { class: 'btn ghost sm', onClick: () => go({ anchor: todayKey() }) }, 'Сегодня'),
    h('div', { class: 'cal-legend' }, kindChip('post', 'пост'), kindChip('reels', 'Reels'), kindChip('seo_page', 'статья'), kindChip('weekly_report', 'отчёт'), kindChip('campaign', 'кампания')),
    h('div', { class: 'cal-legend statuses' }, ...['DRAFT', 'IN_REVIEW', 'APPROVED', 'PUBLISHED', 'FAILED'].map((s) => h('span', { class: `cal-status s-${s}` }, ART_STATUS_SHORT[s]))));

  const errorBox = h('div', { class: 'callout err', style: { marginBottom: '12px' }, hidden: !lastError }, lastError ? `Перенос невозможен: ${lastError}` : '');
  const grid = calendarGrid(app, { mode, anchor, dnd: true, onError: (msg) => { lastError = msg; errorBox.textContent = msg ? `Перенос невозможен: ${msg}` : ''; errorBox.hidden = !msg; } });

  const rules = h('div', { class: 'card', style: { marginTop: '14px' } }, h('h3', null, 'Правила переноса'),
    h('ul', { class: 'small', style: { margin: 0, paddingLeft: '18px' } },
      h('li', null, 'Черновики и материалы на согласовании можно перетаскивать на другой день — время сохраняется, дата меняется.'),
      h('li', null, 'Одобренные, запланированные и опубликованные материалы перенести нельзя: время зафиксировано согласованием. Причина показывается при попытке; изменить время можно правкой материала — согласование будет отозвано.'),
      h('li', null, 'Перенос — mock-операция: ничего не публикуется и не отправляется наружу.')));

  return h('div', null,
    h('div', { class: 'page-head' }, h('div', null, h('h1', null, 'Календарь'), h('div', { class: 'sub' }, 'Публикации, Reels, статьи и кампании выбранного проекта.'))),
    toolbar, errorBox, h('div', { class: 'card' }, grid), rules);
}
