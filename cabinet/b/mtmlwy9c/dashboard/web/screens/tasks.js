// Задачи: канбан, карточка задачи с маршрутом и мини-картой агентов, форма создания.
                                     
import { api } from '../api.js?v=mtmlwy9c';
import { h, badge, statusBadge, kindChip, fmtDate, COLUMNS, COLUMN_LABEL, KIND_LABEL, ART_KIND, short } from '../ui.js?v=mtmlwy9c';
import { agentMap } from '../components/agent-map.js?v=mtmlwy9c';
import { taskForm } from '../components/task-form.js?v=mtmlwy9c';

export function routeView(app     , task     )              {
  const steps                = [];
  const add = (label        , cls        ) => { if (steps.length) steps.push(h('span', { class: 'arrow' }, '→')); steps.push(h('span', { class: `step ${cls}` }, label)); };
  add('director', 'done');
  task.route.forEach((r        , i        ) => add(r, app.activeStep?.taskId === task.id && app.activeStep.roleId === r ? 'now' : i < task.stepIndex ? 'done' : ''));
  add('человек', ['in_review', 'approved', 'published'].includes(task.column) ? 'human' : '');
  if (task.kind === 'post' || task.kind === 'reels') add('publisher', task.column === 'published' ? 'done' : '');
  return h('div', { class: 'route' }, ...steps);
}

export function handoffList(app     , task     )              {
  if (!task.handoffs.length) return h('div', { class: 'empty' }, 'Передач ещё нет');
  return h('div', { class: 'list' }, ...task.handoffs.map((ho     ) => h('div', { class: 'item' },
    h('div', { class: 'body' },
      h('div', { class: 'row' }, badge(ho.from, 'agent'), h('span', { class: 'muted' }, '→'), badge(ho.to === 'approval_queue' ? 'очередь согласования' : ho.to, ho.to === 'approval_queue' ? 'human' : 'agent'), statusBadge(ho.status), h('span', { class: 'muted small mono' }, fmtDate(ho.createdAt)), ho.costUsd ? h('span', { class: 'muted small mono' }, `$${ho.costUsd.toFixed(2)}`) : null),
      h('div', { style: { marginTop: '4px' } }, ho.summary),
      h('div', { class: 'sub' }, `факты: ${ho.facts.length} · источники: ${ho.sources.length} · допущения: ${ho.assumptions.length} · риски: ${ho.risks.length}`, ho.deliverableId ? [' · ', h('a', { href: '#', onClick: (e       ) => { e.preventDefault(); app.go('content', { artifact: ho.deliverableId }); } }, `результат ${ho.deliverableId} (${ART_KIND[ho.deliverableKind] ?? ho.deliverableKind})`)] : null),
      ho.risks.length ? h('div', { class: 'sub' }, 'риски: ', ho.risks.join('; ')) : null))));
}

function taskDetail(app     , task     )              {
  const st = app.state; const actor = app.actor();
  const primary = st.artifacts.find((a     ) => a.id === task.primaryArtifactId);
  const campaign = task.campaignId ? st.campaigns.find((c     ) => c.id === task.campaignId) : null;
  const canRun = !task.archived && !task.blockedReason && ['ideas', 'planned', 'in_progress', 'quality_control'].includes(task.column) && !app.running;
  const actions = h('div', { class: 'actions' },
    task.column === 'ideas' && !task.archived ? h('button', { class: 'btn', onClick: () => app.act(() => api.planTask(app.pid, task.id), 'Директор выбрал маршрут') }, 'Запланировать (директор)') : null,
    canRun ? h('button', { class: 'btn primary', onClick: () => app.runDemo(task.id) }, task.column === 'ideas' ? 'Запустить' : 'Продолжить маршрут') : null,
    canRun && task.column !== 'ideas' ? h('button', { class: 'btn', onClick: () => app.act(() => api.advance(app.pid, task.id)) }, 'Один шаг') : null,
    task.blockedReason && !task.archived ? h('button', { class: 'btn human', onClick: () => app.act(() => api.unblock(app.pid, task.id, 'переработать по замечаниям', actor), 'Возвращено редактору', 'human') }, 'Снять блокировку и вернуть редактору') : null,
    primary ? h('button', { class: 'btn', onClick: () => app.go('content', { artifact: primary.id }) }, 'Открыть материал') : null,
    task.column === 'in_review' ? h('button', { class: 'btn human', onClick: () => app.go('approvals') }, 'К согласованию') : null,
  );
  const mapOpen = app.activeStep?.taskId === task.id;
  return h('div', { class: 'card' },
    h('div', { class: 'head' }, h('div', null, h('h2', null, task.title), h('div', { class: 'muted small mono' }, `${task.id} · ${KIND_LABEL[task.kind]} · создал: ${task.createdBy} · ${fmtDate(task.createdAt)}`)),
      h('div', { class: 'row' }, task.archived ? badge('отклонено', 'err') : null, badge(COLUMN_LABEL[task.column], task.column === 'in_review' || task.column === 'approved' ? 'human' : ''))),
    task.blockedReason ? h('div', { class: 'callout err', style: { marginBottom: '10px' } }, h('b', null, 'Причина блокировки: '), task.blockedReason) : null,
    task.column === 'in_review' ? h('div', { class: 'callout human', style: { marginBottom: '10px' } }, 'Материал прошёл контроль и ждёт решения в «Согласованиях».') : null,
    task.archived ? h('div', { class: 'callout', style: { marginBottom: '10px' } }, 'Задача отклонена и архивирована: маршрут не продолжается.') : null,
    h('div', { class: 'stack' },
      h('div', { class: 'row' }, kindChip(task.kind), campaign ? kindChip('campaign', campaign.name) : h('span', { class: 'muted small' }, 'без кампании'), task.plannedAt ? h('span', { class: 'muted small mono' }, `план: ${task.plannedAt.replace('T', ' ')}`) : null),
      h('div', null, h('h3', null, 'Маршрут'), task.route.length ? routeView(app, task) : h('div', { class: 'muted small' }, 'маршрут появится после планирования директором')),
      task.plan ? h('div', null, h('h3', null, 'План директора'), h('div', { class: 'small' }, h('div', null, h('b', null, 'Цель: '), task.plan.goal), h('div', null, h('b', null, 'Критерии: '), task.plan.criteria.join('; ')))) : null,
      actions,
      h('details', { open: mapOpen }, h('summary', { class: 'muted small' }, 'Маршрут на карте агентов'), h('div', { style: { marginTop: '8px' } }, agentMap(app))),
      h('div', null, h('h3', null, 'История передач'), handoffList(app, task)),
      task.returnNotes.length ? h('div', null, h('h3', null, 'Замечания и возвраты'), h('ul', { class: 'small' }, ...task.returnNotes.map((n        ) => h('li', null, n)))) : null,
      h('div', null, h('h3', null, 'Материалы задачи'), task.artifactIds.length ? h('div', { class: 'list' }, ...task.artifactIds.map((id        ) => { const a = st.artifacts.find((x     ) => x.id === id); return a ? h('div', { class: 'item' }, h('div', { class: 'body' }, h('a', { href: '#', onClick: (e       ) => { e.preventDefault(); app.go('content', { artifact: a.id }); } }, a.title), ' ', badge(ART_KIND[a.kind] ?? a.kind), ' ', statusBadge(a.status), h('div', { class: 'sub' }, `источников: ${a.sources.length} · v${a.version} · ${short(a.contentHash)}`))) : null; })) : h('div', { class: 'muted small' }, 'материалов пока нет')),
    ));
}

export function render(app     )              {
  const st = app.state;
  const showArchived = app.sel.archived === '1';
  const visible = st.tasks.filter((t     ) => showArchived || !t.archived);
  const selected = st.tasks.find((t     ) => t.id === app.sel.task) ?? null;
  const archivedCount = st.tasks.filter((t     ) => t.archived).length;
  const kanban = h('div', { class: 'kanban' }, ...COLUMNS.map((col) => {
    const items = visible.filter((t     ) => t.column === col);
    return h('div', { class: 'col' }, h('h4', null, COLUMN_LABEL[col], h('span', null, String(items.length))),
      ...items.map((t     ) => h('div', { class: `tcard${t.blockedReason ? ' blocked' : ''}${selected?.id === t.id ? ' selected' : ''}${t.archived ? ' archived' : ''}`, onClick: () => app.go('tasks', { task: t.id }) },
        h('div', { class: 't' }, t.title),
        h('div', { class: 'm' }, kindChip(t.kind), t.route.length ? h('span', { class: 'muted small mono' }, `${Math.min(t.stepIndex, t.route.length)}/${t.route.length}`) : null, t.blockedReason ? badge('блок', 'err') : null, t.archived ? badge('отклонено', 'err') : null, app.activeStep?.taskId === t.id ? badge(app.activeStep.roleId, 'agent') : null))));
  }));
  return h('div', null,
    h('div', { class: 'page-head' }, h('div', null, h('h1', null, 'Задачи'), h('div', { class: 'sub' }, 'Директор выбирает короткий маршрут; контролёр — последний перед человеком; ни один материал не публикуется без решения человека.')),
      h('div', { class: 'row' },
        archivedCount ? h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: showArchived, onChange: (e       ) => app.go('tasks', { archived: (e.target                    ).checked ? '1' : '0' }) }), `Показать отклонённые (${archivedCount})`) : null,
        h('button', { class: 'btn primary sm', onClick: () => app.newTask('post') }, 'Создать задачу'))),
    kanban,
    h('div', { class: 'grid detail', style: { marginTop: '16px' } },
      selected ? taskDetail(app, selected) : h('div', { class: 'empty' }, 'Выберите задачу на канбане или создайте новую справа'),
      h('div', { class: 'card' }, h('h3', null, 'Создать задачу'), taskForm(app, { onDone: (t) => app.go('tasks', { task: t.id }) }))));
}
