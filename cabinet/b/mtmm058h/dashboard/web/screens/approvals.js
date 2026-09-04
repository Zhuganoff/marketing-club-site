// Экран «Согласования» — входящая очередь решений человека.
                                     
import { h, badge, statusBadge, fmtDate, fmtTime, short } from '../ui.js?v=mtmm058h';
import { materialCard } from '../components/material-card.js?v=mtmm058h';
import { orderReviewQueue } from '../review-queue.js?v=mtmm058h';

const FILTERS                                                      = [
  { id: 'pending', label: 'Ждут решения', statuses: ['IN_REVIEW'] },
  { id: 'approved', label: 'Одобрено', statuses: ['APPROVED', 'SCHEDULED'] },
  { id: 'failed', label: 'Ошибки', statuses: ['FAILED'] },
  { id: 'history', label: 'Все решения', statuses: [] },
];
const HISTORY_EVENTS = new Set(['approval.granted', 'approval.rejected', 'approval.revoked', 'artifact.declined']);

function historyTable(app     )              {
  const st = app.state;
  if (!st.approvals.length) return h('div', { class: 'empty' }, 'Решений пока не было');
  return h('table', { class: 'table' },
    h('thead', null, h('tr', null, h('th', null, 'Approval'), h('th', null, 'Материал'), h('th', null, 'Канал / время'), h('th', null, 'Кто и когда'), h('th', null, 'Хэш'), h('th', null, 'Статус'))),
    h('tbody', null, ...st.approvals.map((ap     ) => {
      const a = st.artifacts.find((x     ) => x.id === ap.artifactId);
      return h('tr', null, h('td', { class: 'mono' }, ap.id),
        h('td', null, h('a', { href: '#', onClick: (e       ) => { e.preventDefault(); app.go('content', { artifact: ap.artifactId }); } }, a?.title ?? ap.artifactId), ` v${ap.artifactVersion}`),
        h('td', { class: 'mono small' }, `${ap.channelId} · ${ap.scheduledAt} ${ap.timezone}`),
        h('td', null, ap.approvedBy, h('div', { class: 'muted small mono' }, fmtDate(ap.approvedAt))),
        h('td', { class: 'hash' }, short(ap.contentHash, 12)),
        h('td', null, statusBadge(ap.status), ap.revokedReason ? h('div', { class: 'muted small' }, ap.revokedReason) : null));
    })));
}

function timeline(app     )              {
  const evs = app.state.events.filter((e     ) => HISTORY_EVENTS.has(e.type)).slice(0, 15);
  if (!evs.length) return h('div', { class: 'muted small' }, 'Решений пока не было');
  return h('div', { class: 'tl' }, ...evs.map((e     ) => h('div', { class: 't' },
    h('span', { class: 'when' }, fmtDate(e.ts)), ' · ', h('span', { class: e.level === 'warn' ? 'warn-text' : '' }, e.message),
    h('div', { class: 'muted small' }, e.actor.kind === 'human' ? e.actor.name : e.actor.kind === 'agent' ? e.actor.roleId : 'система'))));
}

export function render(app     )              {
  const st = app.state;
  const requested = st.artifacts.find((a     ) => a.id === app.sel.artifact);
  const filterId = requested?.status === 'IN_REVIEW'
    ? 'pending'
    : FILTERS.some((f) => f.id === app.sel.filter) ? app.sel.filter  : 'pending';
  const filter = FILTERS.find((f) => f.id === filterId) ;
  const pending = st.artifacts.filter((a     ) => a.status === 'IN_REVIEW').length;
  const seg = h('div', { class: 'seg' }, ...FILTERS.map((f) => {
    const n = f.statuses.length ? st.artifacts.filter((a     ) => f.statuses.includes(a.status)).length : st.approvals.length;
    return h('button', { class: f.id === filterId ? 'active' : '', 'aria-pressed': f.id === filterId, onClick: () => app.go('approvals', { filter: f.id, artifact: '' }) }, f.label, n ? ` (${n})` : '');
  }));
  let main             ;
  if (filterId === 'history') {
    main = historyTable(app);
  } else if (filterId === 'pending') {
    const queue = orderReviewQueue(st.artifacts.filter((a     ) => a.status === 'IN_REVIEW'), st.reviewDeferrals ?? [], app.actor());
    const requestedIndex = queue.findIndex((x     ) => x.artifact.id === app.sel.artifact);
    const index = requestedIndex >= 0 ? requestedIndex : 0;
    const current = queue[index] ?? null;
    const goTo = (nextIndex        ) => {
      const item = queue[nextIndex];
      if (item) app.go('approvals', { filter: 'pending', artifact: item.artifact.id });
    };
    const afterDecision = () => {
      const next = queue[index + 1] ?? queue[index - 1] ?? null;
      app.go('approvals', { filter: 'pending', artifact: next?.artifact.id ?? '' });
    };
    const afterReviewLater = () => {
      if (queue.length < 2) return;
      const next = queue[(index + 1) % queue.length];
      if (next.artifact.id !== current?.artifact.id) app.go('approvals', { filter: 'pending', artifact: next.artifact.id });
    };
    main = current ? h('div', { class: 'review-workspace' },
      h('div', { class: 'review-progress' },
        h('button', { class: 'btn ghost', disabled: index === 0, 'aria-label': 'Предыдущий материал', onClick: () => goTo(index - 1) }, '← Предыдущий'),
        h('div', { class: 'review-counter', role: 'status', 'aria-live': 'polite' },
          h('b', null, `Материал ${index + 1} из ${queue.length}`),
          current.deferred ? h('span', null, 'На потом — снова в очереди') : h('span', null, 'Можно пропустить и вернуться позже')),
        h('button', { class: 'btn ghost', disabled: index === queue.length - 1, 'aria-label': 'Следующий материал', onClick: () => goTo(index + 1) }, 'Следующий →')),
      materialCard(app, current.artifact, { actions: true, deferred: current.deferred, onAfterDecision: afterDecision, onAfterReviewLater: afterReviewLater }))
      : h('div', { class: 'empty review-empty' }, h('b', null, 'Всё просмотрено'), h('span', null, 'Новых публикаций для решения пока нет.'));
  } else {
    const list = st.artifacts.filter((a     ) => filter.statuses.includes(a.status)).sort((a     , b     ) => b.updatedAt.localeCompare(a.updatedAt));
    main = list.length ? h('div', null, ...list.map((a     ) => materialCard(app, a, { actions: true })))
      : h('div', { class: 'empty' }, filterId === 'pending' ? 'Очередь пуста. Материалы приходят сюда после контроля качества.' : 'Материалов в этом состоянии нет.');
  }
  return h('div', { class: 'approvals' },
    h('div', { class: 'page-head' },
      h('div', null, h('h1', null, 'Решения по публикациям', pending ? [' ', badge(String(pending), 'human')] : null),
        h('div', { class: 'sub' }, 'Читайте по одной. Можно утвердить, вернуть на правку или оставить на потом.')),
      seg),
    main,
    h('details', { class: 'approval-history' }, h('summary', null, 'Недавние решения'), h('div', { class: 'card' }, timeline(app))));
}
