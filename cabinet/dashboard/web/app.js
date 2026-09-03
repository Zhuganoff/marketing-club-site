// Оболочка панели: состояние, роутер, шапка, навигация, запуск демо, быстрые действия.
import { api, ApiError } from './api.js?v=mtlq3kut';
import { h, badge, toast, sleep, usd } from './ui.js?v=mtlq3kut';
import { apply as applyMotion, reduceMotion, setReduceMotion } from './motion.js?v=mtlq3kut';
import { openTaskModal } from './components/task-form.js?v=mtlq3kut';
import { openProjectWizard } from './components/project-wizard.js?v=mtlq3kut';
import { AGENT_NAME } from './components/team-studio.js?v=mtlq3kut';
import { render as today } from './screens/today.js?v=mtlq3kut';
import { render as projectsScreen } from './screens/projects.js?v=mtlq3kut';
import { render as content } from './screens/content.js?v=mtlq3kut';
import { render as calendar } from './screens/calendar.js?v=mtlq3kut';
import { render as approvals } from './screens/approvals.js?v=mtlq3kut';
import { render as campaigns } from './screens/campaigns.js?v=mtlq3kut';
import { render as tasks } from './screens/tasks.js?v=mtlq3kut';
import { render as agents } from './screens/agents.js?v=mtlq3kut';
import { render as analytics } from './screens/analytics.js?v=mtlq3kut';
import { render as settings } from './screens/settings.js?v=mtlq3kut';
import { render as seo } from './screens/seo.js?v=mtlq3kut';

                   
              
             
                 
                  
                                                        
                   
                                     
                  
                         
                           
                 
                                                       
                                                                               
                                         
                                                                                                  
  

const SCREENS                                                                                       = [
  { id: 'projects', label: 'Проекты', primary: true, render: projectsScreen },
  { id: 'today', label: 'Сегодня', primary: true, render: today },
  { id: 'content', label: 'Публикации', primary: true, render: content },
  { id: 'calendar', label: 'Календарь', primary: true, render: calendar },
  { id: 'agents', label: 'Офис', primary: true, render: agents },
  { id: 'settings', label: 'Настройки', primary: true, render: settings },
  { id: 'seo', label: 'SEO', primary: false, render: seo },
  { id: 'approvals', label: 'Все решения', primary: false, render: approvals },
  { id: 'campaigns', label: 'Кампании', primary: false, render: campaigns },
  { id: 'tasks', label: 'Все задачи', primary: false, render: tasks },
  { id: 'analytics', label: 'Результаты', primary: false, render: analytics },
];

function parseHash()                                                  {
  const raw = location.hash.replace(/^#\/?/, '');
  const [screen, query = ''] = raw.split('?');
  const sel                         = {};
  for (const part of query.split('&')) { if (!part) continue; const [k, v] = part.split('='); sel[decodeURIComponent(k)] = decodeURIComponent(v ?? ''); }
  const known = SCREENS.some((s) => s.id === screen) ? screen : screen === 'overview' ? 'today' : 'today';
  return { screen: known, sel };
}

// Что ждёт решения владельца: материалы на согласовании, блокировки, одобренные без очереди, задания в очереди, ошибки публикации.
export function pendingDecisions(state     )         {
  if (!state) return 0;
  return state.artifacts.filter((a     ) => a.status === 'IN_REVIEW' || a.status === 'APPROVED' || a.status === 'FAILED').length
    + state.tasks.filter((t     ) => t.blockedReason && !t.archived).length
    + state.jobs.filter((j     ) => j.status === 'QUEUED').length;
}

const app      = {
  pid: '', state: null, catalog: [], projects: [], activeStep: null, running: false, sel: {},
  actor() { return app.state?.project?.approvers?.[0] ?? 'owner'; },
  setState(s) { app.state = s; app.render(); },
  async refresh() { app.state = await api.state(app.pid); app.render(); },
  render() {
    const { screen, sel } = parseHash();
    app.sel = { ...app.sel, ...sel };
    renderNav(screen);
    renderTopbar();
    const main = document.getElementById('main') ;
    main.innerHTML = '';
    if (!app.state) { main.appendChild(h('div', { class: 'empty' }, 'Загрузка состояния проекта…')); return; }
    main.appendChild(SCREENS.find((s) => s.id === screen) .render(app));
  },
  go(hash, sel) {
    const q = sel ? '?' + Object.entries(sel).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&') : '';
    if (sel) Object.assign(app.sel, sel);
    const next = `#/${hash}${q}`;
    if (location.hash === next) app.render(); else location.hash = next;
  },
  async act(fn, okMsg, kind = 'ok') {
    try {
      const out = await fn();
      if (out?.state) app.setState(out.state); else await app.refresh();
      if (okMsg) toast(okMsg, kind);
      return true;
    } catch (e) {
      const msg = e instanceof ApiError ? `${e.message} (${e.code})` : String(e);
      toast(msg, 'err');
      await app.refresh().catch(() => undefined);
      return false;
    }
  },
  async runDemo(taskId) {
    if (app.running) return;
    app.running = true;
    const pid = app.pid;
    try {
      for (let i = 0; i < 12; i++) {
        const task = app.state.tasks.find((t     ) => t.id === taskId);
        if (!task || pid !== app.pid) break;
        if (task.column === 'ideas') { if (!(await app.act(() => api.planTask(pid, taskId)))) break; await sleep(reduceMotion() ? 200 : 900); continue; }
        if (task.blockedReason || task.archived || task.column === 'in_review' || task.column === 'approved' || task.column === 'published') break;
        const roleId = task.route[task.stepIndex];
        app.activeStep = { taskId, roleId };
        app.render();
        await sleep(reduceMotion() ? 250 : 1500);
        const ok = await app.act(() => api.advance(pid, taskId));
        if (!ok) break;
      }
      const t = app.state?.tasks.find((x     ) => x.id === taskId);
      if (t?.blockedReason) toast(`Контролёр заблокировал «${t.title}»: ${t.blockedReason.slice(0, 120)}`, 'err');
      else if (t?.column === 'in_review') toast(`«${t.title}» ждёт вашего решения в «Согласованиях»`, 'human');
    } finally {
      app.activeStep = null;
      app.running = false;
      app.render();
    }
  },
  newTask(kind, asIdea = false, campaignId = null, presetTitle) { openTaskModal(app, kind, asIdea, campaignId, presetTitle); },
};

function renderNav(active        ) {
  const nav = document.querySelector('.nav') ;
  nav.innerHTML = '';
  nav.appendChild(h('div', { class: 'brand' }, h('span', { class: 'dot' }), h('div', null, h('b', null, 'Marketing Club'), h('span', null, 'ваши проекты'))));
  const pending = pendingDecisions(app.state);
  const inReview = app.state ? app.state.artifacts.filter((a     ) => a.status === 'IN_REVIEW').length : 0;
  const link = (sc                          ) => {
    const a = h('a', { href: `#/${sc.id}`, class: sc.id === active ? 'active' : '', 'aria-current': sc.id === active ? 'page' : null }, sc.label);
    if (sc.id === 'today' && pending) a.appendChild(h('span', { class: 'count', title: 'ждёт решения' }, String(pending)));
    if (sc.id === 'approvals' && inReview) a.appendChild(h('span', { class: 'count', title: 'на согласовании' }, String(inReview)));
    return a;
  };
  // Два уровня (указание владельца 2026-09-03): на экране «Проекты» проект не выбран —
  // сайдбар минимальный; полное меню появляется только внутри проекта.
  const inCabinet = active === 'projects';
  for (const sc of SCREENS.filter((x) => (inCabinet ? x.id === 'projects' : x.primary))) nav.appendChild(link(sc));
  // Направление Teamly (2026-09-03): координатор и сотрудники видны внутри проекта.
  if (!inCabinet && app.state) {
    const enabled = app.state.agents.filter((a     ) => a.status !== 'disabled');
    const coord = enabled.find((a     ) => a.roleId === 'marketing-director');
    const crew = enabled.filter((a     ) => a.roleId !== 'marketing-director');
    const defOf = (rid        ) => app.catalog.find((d     ) => d.id === rid);
    if (coord) {
      nav.appendChild(h('div', { class: 'nav-caps' }, 'Координатор'));
      nav.appendChild(h('a', { href: '#/agents?agent=marketing-director', class: 'crew-item crew-item--coord' },
        h('span', { class: 'crew-ava', style: { background: 'var(--ink)' } }, 'МК'),
        h('span', { class: 'crew-body' }, h('b', null, AGENT_NAME['marketing-director'] ?? 'Директор'), h('span', null, defOf('marketing-director')?.name ?? 'Маркетинг-директор')),
        h('span', { class: `crew-online${coord.status === 'error' ? ' err' : ''}` }, coord.status === 'error' ? 'STOP' : 'ONLINE')));
    }
    if (crew.length) {
      nav.appendChild(h('div', { class: 'nav-caps' }, `Сотрудники (${crew.length})`));
      const list = h('div', { class: 'crew-list' });
      for (const a of crew) {
        const def = defOf(a.roleId);
        list.appendChild(h('a', { href: `#/agents?agent=${a.roleId}`, class: 'crew-item', title: def?.purpose ?? '' },
          h('span', { class: 'crew-ava', style: { background: def?.avatar?.hue != null ? `hsl(${def.avatar.hue} 32% 38%)` : 'var(--ink-3)' } }, (AGENT_NAME[a.roleId] ?? def?.name ?? '?').slice(0, 2).toUpperCase()),
          h('span', { class: 'crew-body' }, h('b', null, AGENT_NAME[a.roleId] ?? def?.name ?? a.roleId), h('span', null, def?.name ?? a.roleId))));
      }
      nav.appendChild(list);
    }
  }
  const secondary = inCabinet ? [] : SCREENS.filter((x) => !x.primary);
  const activeSecondary = secondary.find((x) => x.id === active);
  if (secondary.length) nav.appendChild(h('details', { class: `nav-secondary${activeSecondary ? ' contains-active' : ''}` },
    h('summary', null, activeSecondary?.label ?? 'Ещё'),
    h('div', { class: 'nav-secondary-list' }, ...secondary.map(link))));
  nav.appendChild(h('div', { class: 'spacer' }));
  const cb = h('input', { type: 'checkbox', checked: reduceMotion(), onChange: (e       ) => { setReduceMotion((e.target                    ).checked); app.render(); } });
  nav.appendChild(h('label', { class: 'motion' }, cb, 'Меньше анимации'));
  nav.appendChild(h('div', { class: 'footer' }, 'Работает только на этом компьютере'));
}

function renderTopbar() {
  const bar = document.querySelector('.topbar') ;
  bar.innerHTML = '';
  // Выпадающий список проектов убран (указание владельца 2026-09-03): проекты — в левом меню.
  bar.appendChild(h('div', { class: 'project' },
    h('span', { class: 'muted small' }, 'Проект'),
    h('b', { class: 'project-title' }, app.state ? app.state.project.name : (app.projects.find((p) => p.id === app.pid)?.name ?? ''))));
  const st = app.state;
  if (!st) return;
  const share = st.budget.limitUsd ? Math.min(100, (st.budget.spentUsd / st.budget.limitUsd) * 100) : 0;
  const waiting = st.artifacts.filter((a     ) => a.status === 'IN_REVIEW').length;
  bar.appendChild(h('div', { class: 'owner-top' },
    waiting ? h('button', { class: 'btn human sm', onClick: () => app.go('approvals', { filter: 'pending' }) }, `Нужно решить: ${waiting}`) : h('span', { class: 'owner-clear' }, 'От вас ничего не требуется'),
    h('details', { class: 'topbar-details' },
      h('summary', null, 'О проекте'),
      h('div', { class: 'topbar-details-body' },
        h('div', { class: 'kv' }, h('span', { class: 'k' }, 'Неделя'), h('span', { class: 'v' }, st.project.currentWeek)),
        h('div', { class: 'kv' }, h('span', { class: 'k' }, 'Часовой пояс'), h('span', { class: 'v' }, st.project.timezone)),
        h('div', { class: 'kv' }, h('span', { class: 'k' }, 'Лимит'), h('span', { class: 'v' }, `${usd(st.budget.spentUsd)} из ${usd(st.budget.limitUsd)}`), h('div', { class: `meter${share > 80 ? ' hot' : ''}` }, h('i', { style: { width: `${share}%` } }))),
        h('span', { class: `health ${st.health.status}` }, st.health.status === 'ok' ? 'всё работает' : 'есть ошибки'),
        badge('внешние подключения выключены', '')))));
}

async function boot() {
  applyMotion();
  app.projects = await api.projects();
  let saved                = null;
  try { saved = localStorage.getItem('mc.pid'); } catch {}
  app.pid = app.projects.some((p) => p.id === saved) ? saved  : app.projects[0].id;
  window.addEventListener('hashchange', () => app.render());
  app.render();
  app.catalog = await api.catalog();
  await app.refresh();
}
boot().catch((e) => { document.getElementById('main') .textContent = `Не удалось загрузить панель: ${e.message}`; });
