// Экран «Сегодня» — рабочий стол владельца: решения, активные задачи, ближайшие 7 дней, публикации и ошибки.
                                     
import { api } from '../api.js?v=mtmm058h';
import { h, badge, kindChip, fmtTime, usd, dateKey, timeOf, fmtDay, addDays, todayKey, COLUMN_LABEL, ART_STATUS_SHORT } from '../ui.js?v=mtmm058h';
import { materialCard } from '../components/material-card.js?v=mtmm058h';
import { orderReviewQueue } from '../review-queue.js?v=mtmm058h';

const PUBLICATION_EVENTS = new Set(['job.published', 'job.failed', 'quality.block', 'approval.granted', 'approval.revoked']);

function decisions(app     )              {
  const st = app.state; const actor = app.actor();
  const items                = [];
  const reviewQueue = orderReviewQueue(st.artifacts.filter((x     ) => x.status === 'IN_REVIEW'), st.reviewDeferrals ?? [], actor);
  const firstReview = reviewQueue[0];
  if (firstReview) {
    items.push(materialCard(app, firstReview.artifact, {
      compact: true,
      actions: true,
      deferred: firstReview.deferred,
      onAfterDecision: () => app.go('today'),
      onAfterReviewLater: () => app.go('today'),
    }));
    if (reviewQueue.length > 1) {
      items.push(h('div', { class: 'review-more' },
        h('span', { class: 'muted small' }, `Ещё ${reviewQueue.length - 1} ${reviewQueue.length - 1 === 1 ? 'публикация ждёт' : 'публикации ждут'} решения`),
        h('button', { class: 'btn ghost sm', onClick: () => app.go('approvals', { filter: 'pending', artifact: firstReview.artifact.id }) }, 'Разобрать по одной')));
    }
  }
  for (const t of st.tasks.filter((x     ) => x.blockedReason && !x.archived)) {
    items.push(h('div', { class: 'callout err' },
      h('div', { class: 'row' }, h('b', null, `Заблокировано: ${t.title}`), kindChip(t.kind)),
      h('div', { class: 'small' }, t.blockedReason),
      h('div', { class: 'actions', style: { marginTop: '8px' } },
        h('button', { class: 'btn sm', onClick: () => app.act(() => api.unblock(app.pid, t.id, 'переработать по замечаниям контролёра', actor), 'Возвращено редактору', 'human') }, 'Снять блокировку'),
        h('button', { class: 'btn ghost sm', onClick: () => app.go('tasks', { task: t.id }) }, 'К задаче'))));
  }
  for (const a of st.artifacts.filter((x     ) => x.status === 'APPROVED')) {
    items.push(h('div', { class: 'decision' }, h('div', { class: 'title' }, a.title), h('div', { class: 'sub' }, 'одобрено · можно ставить в очередь публикации'),
      h('div', { class: 'actions', style: { marginTop: '8px' } }, h('button', { class: 'btn human sm', onClick: () => app.act(() => api.publish(app.pid, a.id, actor), 'Задание поставлено в очередь') }, 'В очередь публикации'))));
  }
  for (const j of st.jobs.filter((x     ) => x.status === 'QUEUED')) {
    const channel = st.channels.find((c     ) => c.id === j.channelId);
    items.push(h('div', { class: 'decision' }, h('div', { class: 'title' }, `Задание ${j.id}`), h('div', { class: 'sub' }, `${channel?.name ?? j.channelId} · ${j.connectorId}`),
      h('div', { class: 'actions', style: { marginTop: '8px' } }, h('button', { class: 'btn primary sm', onClick: () => app.act(() => api.runJob(app.pid, j.id)) }, 'Выполнить публикацию (mock)'))));
  }
  for (const a of st.artifacts.filter((x     ) => x.status === 'FAILED')) {
    items.push(h('div', { class: 'decision failed' }, h('div', { class: 'title' }, `Не опубликовано: ${a.title}`), h('div', { class: 'sub' }, `попыток: ${a.failedAttempts} · автоповтора нет`),
      h('div', { class: 'actions', style: { marginTop: '8px' } },
        h('button', { class: 'btn sm', onClick: () => app.act(() => api.retry(app.pid, a.id, actor), 'Новое задание создано') }, 'Повторить'),
        h('button', { class: 'btn ghost sm', onClick: () => app.go('content', { artifact: a.id }) }, 'Открыть'))));
  }
  if (!items.length) return h('div', { class: 'empty' }, 'Решений не требуется. Создайте идею или пост — материал вернётся сюда после контроля качества.');
  return h('div', { class: 'stack' }, ...items);
}

function activeTasks(app     )              {
  const st = app.state;
  const active = st.tasks.filter((t     ) => !t.archived && ['planned', 'in_progress', 'quality_control', 'in_review'].includes(t.column));
  if (!active.length) return h('div', { class: 'empty' }, 'Активных задач нет');
  return h('div', { class: 'list' }, ...active.map((t     ) => {
    const running = app.activeStep?.taskId === t.id;
    return h('div', { class: `item${running ? ' running' : ''}` },
      h('div', { class: 'body' },
        h('div', { class: 'row' }, h('a', { href: '#', class: 'title', onClick: (e       ) => { e.preventDefault(); app.go('tasks', { task: t.id }); } }, t.title), kindChip(t.kind),
          t.route.length ? h('span', { class: 'muted small' }, `этап ${Math.min(t.stepIndex, t.route.length)} из ${t.route.length}`) : null,
          t.blockedReason ? badge('нужна помощь', 'err') : null, running ? badge('сейчас в работе', 'agent') : null),
        h('div', { class: 'sub' }, COLUMN_LABEL[t.column], t.blockedReason ? ` · ${t.blockedReason}` : '')));
  }));
}

function stats(app     )              {
  const st = app.state;
  const publishable = st.artifacts.filter((a     ) => a.kind === 'draft' || a.kind === 'weekly_report');
  const inReview = publishable.filter((a     ) => a.status === 'IN_REVIEW').length;
  const published = publishable.filter((a     ) => a.status === 'PUBLISHED').length;
  const failed = publishable.filter((a     ) => a.status === 'FAILED').length;
  const share = st.budget.limitUsd ? st.budget.spentUsd / st.budget.limitUsd : 0;
  const stat = (n        , l        , cls = '') => h('div', { class: `stat ${cls}` }, h('div', { class: 'n' }, n), h('div', { class: 'l' }, l));
  return h('div', { class: 'stat-row' },
    stat(String(publishable.length), 'материалов'),
    stat(String(inReview), 'на согласовании', inReview ? 'warn' : ''),
    stat(String(published), 'опубликовано'),
    stat(String(failed), 'ошибок публикации', failed ? 'err' : ''),
    stat(`${usd(st.budget.spentUsd)}`, `расход / ${usd(st.budget.limitUsd)}`, share > 0.8 ? 'warn' : ''));
}

function nextSevenDays(app     )              {
  const st = app.state;
  const start = todayKey();
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const publishable = st.artifacts.filter((a     ) => a.kind === 'draft' || a.kind === 'weekly_report');
  const rows = days.map((day) => {
    const campaigns = st.campaigns.filter((c     ) => c.period.from <= day && day <= c.period.to);
    const items = publishable.filter((a     ) => dateKey(a.scheduledAt) === day).sort((a     , b     ) => String(a.scheduledAt).localeCompare(String(b.scheduledAt)));
    return h('div', { class: `day-row${day === start ? ' today' : ''}` },
      h('div', { class: 'day-label' }, fmtDay(day)),
      h('div', { class: 'day-items' },
        campaigns.length ? h('div', { class: 'muted small' }, `идёт кампания: ${campaigns.map((c     ) => c.name).join(', ')}`) : null,
        ...items.map((a     ) => {
          const task = st.tasks.find((t     ) => t.id === a.taskId);
          return h('div', { class: 'day-chip', onClick: () => app.go('content', { artifact: a.id }) }, h('span', { class: 'mono' }, timeOf(a.scheduledAt)), ' ', kindChip(task?.kind ?? 'post', a.title), h('span', { class: 'muted small' }, ART_STATUS_SHORT[a.status] ?? a.status));
        }),
        !items.length && !campaigns.length ? h('span', { class: 'muted small' }, '—') : null));
  });
  return h('div', { class: 'days' }, ...rows, h('div', { style: { marginTop: '8px' } }, h('a', { href: '#', onClick: (e       ) => { e.preventDefault(); app.go('calendar'); } }, 'Открыть календарь')));
}

function recentPublications(app     )              {
  const evs = app.state.events.filter((e     ) => PUBLICATION_EVENTS.has(e.type)).slice(0, 10);
  if (!evs.length) return h('div', { class: 'empty' }, 'Публикаций и ошибок пока нет');
  return h('div', { class: 'list' }, ...evs.map((e     ) => h('div', { class: 'item' },
    h('span', { class: 'ev-time' }, fmtTime(e.ts)),
    h('span', { class: `ev-dot ${e.level === 'error' ? 'error' : e.level === 'warn' ? 'warn' : e.actor.kind}` }),
    h('div', { class: 'body' }, h('div', null, e.message), h('div', { class: 'sub' }, e.actor.kind === 'agent' ? e.actor.roleId : e.actor.kind === 'human' ? e.actor.name : 'система', ' · ', h('span', { class: 'mono' }, e.type))))));
}

export function render(app     )              {
  const st = app.state;
  const pending = st.artifacts.filter((a     ) => ['IN_REVIEW', 'APPROVED', 'FAILED'].includes(a.status)).length + st.tasks.filter((t     ) => t.blockedReason && !t.archived).length + st.jobs.filter((j     ) => j.status === 'QUEUED').length;
  return h('div', { class: 'today owner-home' },
    h('div', { class: 'page-head' },
      h('div', null, h('h1', null, st.project.name), h('div', { class: 'sub' }, 'Главное на сегодня — без лишних отчётов')),
      h('details', { class: 'owner-create' },
        h('summary', { class: 'btn primary' }, '＋ Создать'),
        h('div', { class: 'owner-create-menu' },
          h('button', { class: 'btn ghost', onClick: () => app.newTask('post', true) }, 'Новую идею'),
          h('button', { class: 'btn ghost', onClick: () => app.newTask('post') }, 'Публикацию'),
          h('button', { class: 'btn ghost', onClick: () => app.newTask('reels') }, 'Reels'),
          h('button', { class: 'btn ghost', onClick: () => app.go('campaigns', { new: '1' }) }, 'Кампанию')))),
    h('section', { class: 'owner-question owner-question-main', 'aria-labelledby': 'owner-decisions-title' },
      h('div', { class: 'owner-question-head' },
        h('div', null, h('span', { class: 'question-number' }, '1'), h('h2', { id: 'owner-decisions-title' }, 'Что нужно от меня?')),
        h('div', { class: 'row' }, pending ? badge(`${pending} дел`, 'human') : badge('ничего', 'ok'), h('button', { class: 'btn ghost sm', onClick: () => app.go('approvals', { filter: 'pending' }) }, 'Открыть по одной'))),
      decisions(app)),
    h('div', { class: 'owner-question-grid' },
      h('section', { class: 'owner-question', 'aria-labelledby': 'owner-team-title' },
        h('div', { class: 'owner-question-head' },
          h('div', null, h('span', { class: 'question-number' }, '2'), h('h2', { id: 'owner-team-title' }, 'Что делает команда?')),
          h('button', { class: 'btn ghost sm', onClick: () => app.go('tasks') }, 'Все задачи')),
        activeTasks(app)),
      h('section', { class: 'owner-question', 'aria-labelledby': 'owner-week-title' },
        h('div', { class: 'owner-question-head' },
          h('div', null, h('span', { class: 'question-number' }, '3'), h('h2', { id: 'owner-week-title' }, 'Что выйдет на этой неделе?'))),
        nextSevenDays(app))),
    h('details', { class: 'owner-more' },
      h('summary', null, 'Показатели и последние события'),
      h('div', { class: 'owner-more-body' },
        h('div', { class: 'card' }, h('h3', null, 'Показатели'), stats(app)),
        h('div', { class: 'card' }, h('h3', null, 'Последние публикации и ошибки'), recentPublications(app)))));
}
