// Карта агентов — коммутационная панель. Дорожки по командам, маршрут задачи загорается сегментами.
                                     
import { h, s, tooltip, STATUS_LABEL, usd } from '../ui.js?v=mtmlqkxg';

const LANES                                                   = [
  { id: 'growth', label: 'Growth', roles: ['seo-strategist', 'funnel-analyst'] },
  { id: 'strategy', label: 'Strategy', roles: ['marketing-director', 'brand-strategist', 'market-researcher'] },
  { id: 'content', label: 'Content', roles: ['chief-editor', 'creative-director', 'reels-producer', 'channel-editor'] },
  { id: 'control', label: 'Control', roles: ['quality-controller', '__human'] },
  { id: 'publishing', label: 'Publishing', roles: ['publisher-executor'] },
];
const W = 214, H = 56, GX = 30, GY = 22, X0 = 16, Y0 = 34;

function pos(roleId        )                                  {
  for (let li = 0; li < LANES.length; li++) {
    const ri = LANES[li].roles.indexOf(roleId);
    if (ri >= 0) return { x: X0 + li * (W + GX), y: Y0 + ri * (H + GY) };
  }
  return null;
}

export function focusTask(app     )             {
  const st = app.state;
  if (app.activeStep) return st.tasks.find((t     ) => t.id === app.activeStep .taskId) ?? null;
  if (app.sel.task) { const t = st.tasks.find((t     ) => t.id === app.sel.task); if (t && t.column !== 'ideas') return t; }
  return [...st.tasks].filter((t     ) => t.column !== 'ideas').sort((a     , b     ) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null;
}

export function agentMap(app     )              {
  const st = app.state;
  const byRole                      = Object.fromEntries(st.agents.map((a     ) => [a.roleId, a]));
  const task = focusTask(app);
  const width = X0 * 2 + LANES.length * W + (LANES.length - 1) * GX;
  const height = Y0 + 4 * (H + GY) + 4;
  const svg = s('svg', { viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': 'Карта агентов' });

  for (let li = 0; li < LANES.length; li++) {
    svg.appendChild(s('text', { x: X0 + li * (W + GX), y: 18, class: 'lane-label' }, LANES[li].label));
  }

  // маршрут: директор → шаги → человек → исполнитель
  let chain           = [];
  let doneUntil = -1; let activeIdx = -1; let humanLit = false; let pubLit = false;
  if (task) {
    chain = ['marketing-director', ...task.route.filter((r        ) => r !== 'marketing-director' || true)];
    if (task.kind === 'weekly_report') chain = ['marketing-director', 'funnel-analyst', 'marketing-director'];
    chain = [...chain, '__human'];
    if (task.kind === 'post' || task.kind === 'reels') chain.push('publisher-executor');
    const stepsDone = task.stepIndex; // число выполненных шагов маршрута
    doneUntil = Math.min(stepsDone, task.route.length); // индексы chain: 0 — директор (всегда выполнен)
    if (app.activeStep && app.activeStep.taskId === task.id) activeIdx = task.route.indexOf(app.activeStep.roleId) + 1;
    humanLit = ['in_review', 'approved', 'published'].includes(task.column);
    pubLit = task.column === 'published';
  }
  const wires = s('g');
  svg.appendChild(wires);
  for (let i = 0; i + 1 < chain.length; i++) {
    const a = pos(chain[i]); const b = pos(chain[i + 1]);
    if (!a || !b) continue;
    const x1 = a.x + W, y1 = a.y + H / 2, x2 = b.x, y2 = b.y + H / 2;
    const same = chain[i] === chain[i + 1];
    const d = same ? `M${a.x + W} ${y1} c 30 0 30 ${H} 0 ${H}` : x2 > x1
      ? `M${x1} ${y1} C ${x1 + GX / 2} ${y1}, ${x2 - GX / 2} ${y2}, ${x2} ${y2}`
      : `M${a.x} ${y1} C ${a.x - GX / 2} ${y1}, ${b.x + W + GX / 2} ${y2}, ${b.x + W} ${y2}`;
    const toHuman = chain[i + 1] === '__human'; const fromHuman = chain[i] === '__human';
    let cls = 'wire';
    const lit = toHuman ? (humanLit || (task && task.column === 'in_review')) && doneUntil >= i : fromHuman ? pubLit : i + 1 <= doneUntil;
    const isActive = activeIdx === i + 1;
    if (lit || isActive) cls += ' lit';
    if (isActive) cls += ' flow';
    if (toHuman && lit) cls += ' human';
    if (fromHuman && lit) cls += ' human';
    if (toHuman && !lit && task && task.column === 'in_review') cls += ' lit human';
    wires.appendChild(s('path', { d, class: cls }));
  }

  for (const lane of LANES) for (const roleId of lane.roles) {
    const p = pos(roleId) ;
    if (roleId === '__human') {
      const waiting = st.artifacts.filter((a     ) => a.status === 'IN_REVIEW').length;
      const g = s('g', { class: `node human-node${task && task.column === 'in_review' ? ' waiting' : ''}`, transform: `translate(${p.x} ${p.y})` });
      g.appendChild(s('rect', { width: W, height: H, rx: 10 }));
      g.appendChild(s('text', { x: 14, y: 24, class: 'name' }, 'Человек-согласующий'));
      g.appendChild(s('text', { x: 14, y: 42, class: 'role' }, waiting ? `ждёт решений: ${waiting}` : st.project.approvers[0]));
      svg.appendChild(g);
      continue;
    }
    const ag = byRole[roleId];
    const def = app.catalog.find((d     ) => d.id === roleId);
    const onRoute = task ? chain.includes(roleId) : false;
    const isActive = app.activeStep?.roleId === roleId || ag?.status === 'working';
    const cls = ['node', !ag ? 'disabled' : '', onRoute ? 'on-route' : '', isActive ? 'active' : '', ag?.status === 'waiting_approval' ? 'waiting' : '', ag?.status === 'error' ? 'error' : ''].filter(Boolean).join(' ');
    const g = s('g', { class: cls, transform: `translate(${p.x} ${p.y})` });
    g.appendChild(s('rect', { class: 'ring', x: -3, y: -3, width: W + 6, height: H + 6, rx: 13 }));
    g.appendChild(s('rect', { width: W, height: H, rx: 10 }));
    const hue = def?.avatar?.hue ?? 200;
    g.appendChild(s('circle', { cx: 22, cy: H / 2, r: 13, fill: `hsl(${hue} 30% 32%)` }));
    g.appendChild(s('text', { x: 22, y: H / 2 + 4, 'text-anchor': 'middle', class: 'ini' }, def?.avatar?.initials ?? '??'));
    g.appendChild(s('text', { x: 44, y: 22, class: 'name' }, def?.name ?? roleId));
    g.appendChild(s('text', { x: 44, y: 38, class: 'model' }, ag ? ag.modelLabel : 'не включён в проекте'));
    const dotColor = !ag ? 'var(--line)' : ag.status === 'error' ? 'var(--err)' : isActive ? 'var(--agent)' : ag.status === 'waiting_approval' ? 'var(--human)' : 'var(--ink-3)';
    g.appendChild(s('circle', { cx: W - 12, cy: 12, r: 4, fill: dotColor, class: 'status-dot' }));
    tooltip(g, () => h('div', null,
      h('div', null, h('b', null, def?.name ?? roleId), ' · ', ag ? STATUS_LABEL[isActive ? 'working' : ag.status] : 'выключен'),
      h('div', { class: 'mono' }, roleId, ' · ', ag ? ag.modelLabel : '—'),
      ag ? h('div', { class: 'mono' }, `расход ${usd(ag.budget.spentUsd)} из ${usd(ag.budget.limitUsd)} · запусков: ${ag.runs}`) : null,
      ag?.errorMessage ? h('div', null, ag.errorMessage) : null,
    ));
    g.addEventListener('click', () => app.go('agents', { agent: roleId }));
    (g       ).style.cursor = 'pointer';
    svg.appendChild(g);
  }

  const wrap = h('div', { class: 'map' });
  wrap.appendChild(svg                   );
  wrap.appendChild(h('div', { class: 'legend' },
    h('span', null, h('i', { style: { background: 'var(--agent)' } }), 'агент работает / маршрут'),
    h('span', null, h('i', { style: { background: 'var(--human)' } }), 'решение человека'),
    h('span', null, h('i', { style: { background: 'var(--err)' } }), 'ошибка или блокировка'),
    h('span', null, h('i', { style: { background: 'var(--line)' } }), 'не включён в проекте'),
    task ? h('span', { class: 'mono' }, `маршрут: ${task.title}`) : h('span', null, 'нет активной задачи'),
  ));
  return wrap;
}
