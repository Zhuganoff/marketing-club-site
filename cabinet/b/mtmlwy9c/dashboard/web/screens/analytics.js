// Демонстрационные графики: одна ось, один оттенок для величин, подписи текстовыми токенами, подсказки при наведении.
                                     
import { h, s, tooltip, usd } from '../ui.js?v=mtmlwy9c';

// Пустой набор данных (новый проект без сидов аналитики) — явная заглушка вместо графика с NaN.
function noData()              { return h('div', { class: 'empty', style: { padding: '28px 12px' } }, 'Данных пока нет — появятся после первых публикаций (mock)'); }

function barChart(items                                                   , opts                                          = {})              {
  if (!items.length) return noData();
  const max = Math.max(1, ...items.map((i) => i.value));
  const W = 520, H = opts.horizontal ? items.length * 30 + 10 : 200, padL = opts.horizontal ? 140 : 36, padB = 26;
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}` });
  if (opts.horizontal) {
    items.forEach((it, i) => {
      const y = i * 30 + 6, w = (W - padL - 60) * (it.value / max);
      svg.appendChild(s('text', { x: padL - 8, y: y + 14, class: 'tick', 'text-anchor': 'end' }, it.label));
      const r = s('rect', { x: padL, y, width: Math.max(4, w), height: 18, rx: 4, class: 'bar' });
      tooltip(r, () => h('div', null, h('b', null, it.label), h('div', { class: 'mono' }, `${it.value}${opts.unit ?? ''}`), it.hint ? h('div', null, it.hint) : null));
      svg.appendChild(r);
      svg.appendChild(s('text', { x: padL + w + 6, y: y + 14, class: 'lbl' }, `${it.value}${opts.unit ?? ''}`));
    });
  } else {
    const plotH = H - padB - 10, bw = (W - padL - 10) / items.length;
    for (let g = 0; g <= 4; g++) { const y = 10 + plotH - (plotH * g) / 4; svg.appendChild(s('line', { x1: padL, x2: W - 10, y1: y, y2: y, class: g === 0 ? 'axis' : 'grid-line' })); svg.appendChild(s('text', { x: padL - 6, y: y + 4, class: 'tick', 'text-anchor': 'end' }, String(Math.round((max * g) / 4)))); }
    items.forEach((it, i) => {
      const hgt = plotH * (it.value / max), x = padL + i * bw + bw * 0.18, y = 10 + plotH - hgt;
      const r = s('rect', { x, y, width: bw * 0.64, height: Math.max(2, hgt), rx: 4, class: 'bar' });
      tooltip(r, () => h('div', null, h('b', null, it.label), h('div', { class: 'mono' }, `${it.value}${opts.unit ?? ''}`), it.hint ? h('div', null, it.hint) : null));
      svg.appendChild(r);
      if (i === 0 || it.value === max) svg.appendChild(s('text', { x: x + bw * 0.32, y: y - 5, class: 'lbl', 'text-anchor': 'middle' }, `${it.value}${opts.unit ?? ''}`));
      svg.appendChild(s('text', { x: x + bw * 0.32, y: H - 8, class: 'tick', 'text-anchor': 'middle' }, it.label));
    });
  }
  const wrap = h('div', { class: 'chart' }); wrap.appendChild(svg                   ); return wrap;
}

function lineChart(points                                    , unit = '')              {
  if (!points.length) return noData();
  const W = 520, H = 180, padL = 40, padB = 26, plotH = H - padB - 12, plotW = W - padL - 12;
  const max = Math.max(1, ...points.map((p) => p.value)), min = Math.min(...points.map((p) => p.value));
  const step = Math.pow(10, Math.floor(Math.log10(Math.max(1, max - min || max))));
  const lo = Math.max(0, Math.floor((min - (max - min) * 0.3) / step) * step);
  const x = (i        ) => padL + (plotW * i) / Math.max(1, points.length - 1);
  const y = (v        ) => 12 + plotH - (plotH * (v - lo)) / Math.max(1, max - lo);
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}` });
  for (let g = 0; g <= 3; g++) { const yy = 12 + plotH - (plotH * g) / 3; svg.appendChild(s('line', { x1: padL, x2: W - 12, y1: yy, y2: yy, class: g === 0 ? 'axis' : 'grid-line' })); svg.appendChild(s('text', { x: padL - 6, y: yy + 4, class: 'tick', 'text-anchor': 'end' }, String(Math.round(lo + ((max - lo) * g) / 3)))); }
  svg.appendChild(s('path', { d: points.map((p, i) => `${i ? 'L' : 'M'}${x(i)} ${y(p.value)}`).join(' '), class: 'line' }));
  points.forEach((p, i) => {
    const c = s('circle', { cx: x(i), cy: y(p.value), r: 4, class: 'pt' });
    tooltip(c, () => h('div', null, h('b', null, p.label), h('div', { class: 'mono' }, `${p.value}${unit}`)));
    svg.appendChild(c);
    svg.appendChild(s('text', { x: x(i), y: H - 8, class: 'tick', 'text-anchor': 'middle' }, p.label));
    if (i === points.length - 1) svg.appendChild(s('text', { x: x(i) - 8, y: y(p.value) - 8, class: 'lbl', 'text-anchor': 'end' }, `${p.value}${unit}`));
  });
  const wrap = h('div', { class: 'chart' }); wrap.appendChild(svg                   ); return wrap;
}

export function render(app     )              {
  const an = app.state.analytics; const st = app.state;
  const card = (title        , body             , note         ) => h('div', { class: 'card' }, h('div', { class: 'head' }, h('h3', null, title), h('span', { class: 'mock-tag' }, 'mock')), body, note ? h('div', { class: 'muted small', style: { marginTop: '6px' } }, note) : null);
  const tasksTotal = st.tasks.length || 1;
  const share = [
    { label: 'На согласовании', value: st.artifacts.filter((a     ) => a.status === 'IN_REVIEW').length },
    { label: 'Одобрено', value: st.artifacts.filter((a     ) => ['APPROVED', 'SCHEDULED'].includes(a.status)).length },
    { label: 'Опубликовано', value: st.artifacts.filter((a     ) => a.status === 'PUBLISHED').length },
    { label: 'Заблокировано', value: st.tasks.filter((t     ) => t.blockedReason).length },
    { label: 'Ошибка публикации', value: st.artifacts.filter((a     ) => a.status === 'FAILED').length },
  ];
  return h('div', null,
    h('div', { class: 'page-head' }, h('div', null, h('h1', null, 'Аналитика'), h('div', { class: 'sub' }, 'Только агрегированные демонстрационные показатели. Реальная аналитика не подключена; персональные данные не используются.'))),
    h('div', { class: 'grid two' },
      card('Источники: переходы', barChart(an.sources.map((x     ) => ({ label: x.name, value: x.visits, hint: `заявок: ${x.leads}` }))), 'Заявки по источнику — в подсказке при наведении.'),
      card('Воронка недели', barChart(an.funnel.map((x     ) => ({ label: x.stage, value: x.value })), { horizontal: true })),
      card('Переходы по неделям', lineChart(an.weekly.map((w     ) => ({ label: w.week.slice(5), value: w.visits })))),
      card('Заявки по неделям', lineChart(an.weekly.map((w     ) => ({ label: w.week.slice(5), value: w.leads })))),
      card('Материалы по состоянию', barChart(share, { horizontal: true }), `Задач в проекте: ${tasksTotal}.`),
      card('Расход по моделям (условные $)', barChart(an.modelSpend.map((m     ) => ({ label: m.label, value: m.usd, hint: 'mock-стоимость шагов маршрута' })), { horizontal: true, unit: ' $' }), `Всего ${usd(st.budget.spentUsd)} из ${usd(st.budget.limitUsd)} за неделю.`)),
    h('div', { class: 'card', style: { marginTop: '16px' } }, h('h3', null, 'Таблица данных'), h('table', { class: 'table' }, h('thead', null, h('tr', null, h('th', null, 'Неделя'), h('th', null, 'Переходы'), h('th', null, 'Заявки'), h('th', null, 'Консультации'), h('th', null, 'Договоры'))),
      h('tbody', null, an.weekly.length ? an.weekly.map((w     ) => h('tr', null, h('td', { class: 'mono' }, w.week), h('td', null, String(w.visits)), h('td', null, String(w.leads)), h('td', null, String(w.consultations)), h('td', null, String(w.contracts))))
        : h('tr', null, h('td', { colspan: 5, class: 'muted small' }, 'Недельных показателей пока нет'))))));
}
