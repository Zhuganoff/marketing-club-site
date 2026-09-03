// Согласование человеком и сброс согласования при правке. См. docs/PUBLISHING_CONTRACT.md §2–3.
                                                                                                       
import { DomainError } from './types.js?v=mtlslcfn';
import { computeContentHash } from './hash.js?v=mtlslcfn';
import { nextId } from './ids.js?v=mtlslcfn';
import { pushEvent } from './events.js?v=mtlslcfn';

export function getArtifact(state              , artifactId        )                  {
  const a = state.artifacts.find((x) => x.id === artifactId);
  if (!a) throw new DomainError('NOT_FOUND', `Материал ${artifactId} не найден в проекте ${state.project.id}`);
  return a;
}

export function getTask(state              , taskId        )       {
  const t = state.tasks.find((x) => x.id === taskId);
  if (!t) throw new DomainError('NOT_FOUND', `Задача ${taskId} не найдена в проекте ${state.project.id}`);
  return t;
}

export function activeApproval(state              , artifact                 )                  {
  if (!artifact.approvalId) return null;
  const ap = state.approvals.find((x) => x.id === artifact.approvalId);
  return ap && ap.status === 'active' ? ap : null;
}

                                                                                         

export function approveArtifact(state              , now        , artifactId        , actor       , input              )           {
  const a = getArtifact(state, artifactId);
  if (actor.kind !== 'human') {
    throw new DomainError('AGENT_CANNOT_APPROVE', 'Одобрять материал может только человек-согласующий; агенты и исполнитель не имеют такого права');
  }
  if (!state.project.approvers.includes(actor.name)) {
    throw new DomainError('NOT_AN_APPROVER', `«${actor.name}» не входит в список согласующих проекта`);
  }
  if (actor.name === a.authorRoleId) {
    throw new DomainError('SELF_APPROVAL_FORBIDDEN', 'Автор не может одобрить собственный материал');
  }
  if (a.status !== 'IN_REVIEW') {
    throw new DomainError('WRONG_STATUS', `Материал в статусе ${a.status}; одобрить можно только IN_REVIEW`);
  }
  if (!a.qualityReport || a.qualityReport.verdict !== 'pass' || a.qualityReport.artifactVersion !== a.version) {
    throw new DomainError('NO_QUALITY_PASS', 'Нет действующего вердикта контролёра качества «pass» для этой версии');
  }
  const channel = state.channels.find((c) => c.id === input.channelId);
  if (!channel) throw new DomainError('CHANNEL_NOT_FOUND', `Канал ${input.channelId} не найден в проекте`);
  if (!input.scheduledAt) throw new DomainError('SCHEDULE_REQUIRED', 'Укажите время публикации');

  a.channelId = channel.id;
  a.scheduledAt = input.scheduledAt;
  a.timezone = input.timezone ?? channel.timezone;
  a.contentHash = computeContentHash(a);
  a.status = 'APPROVED';
  a.updatedAt = now;

  const approval           = {
    id: nextId(state, 'ap'),
    projectId: state.project.id,
    artifactId: a.id,
    artifactVersion: a.version,
    contentHash: a.contentHash,
    channelId: channel.id,
    scheduledAt: a.scheduledAt,
    timezone: a.timezone,
    approvedBy: actor.name,
    approvedAt: now,
    status: 'active',
    revokedReason: null,
    revokedAt: null,
  };
  state.approvals.unshift(approval);
  a.approvalId = approval.id;

  const task = state.tasks.find((t) => t.id === a.taskId);
  if (task) { task.column = 'approved'; task.updatedAt = now; }
  for (const ag of state.agents) if (ag.status === 'waiting_approval' && ag.currentTaskId === a.taskId) { ag.status = 'idle'; ag.currentTaskId = null; }

  pushEvent(state, now, actor, 'approval.granted',
    `Материал «${a.title}» v${a.version} одобрен для канала «${channel.name}» на ${a.scheduledAt} (${a.timezone})`,
    { taskId: a.taskId, artifactId: a.id, approvalId: approval.id, channelId: channel.id });
  return approval;
}

export function rejectArtifact(state              , now        , artifactId        , actor       , note        )                  {
  const a = getArtifact(state, artifactId);
  if (actor.kind !== 'human') throw new DomainError('AGENT_CANNOT_DECIDE', 'Возврат с согласования — решение человека');
  if (a.status !== 'IN_REVIEW' && a.status !== 'APPROVED') throw new DomainError('WRONG_STATUS', `Нельзя вернуть материал в статусе ${a.status}`);
  revokeApproval(state, now, a, `возвращён человеком: ${note}`);
  a.status = 'DRAFT';
  a.updatedAt = now;
  const task = state.tasks.find((t) => t.id === a.taskId);
  if (task) {
    task.column = 'in_progress';
    task.returnNotes.push(`${actor.name}: ${note}`);
    const editorIdx = task.route.indexOf('chief-editor');
    task.stepIndex = editorIdx >= 0 ? editorIdx : 0;
    task.blockedReason = null;
    task.updatedAt = now;
  }
  pushEvent(state, now, actor, 'approval.rejected', `Материал «${a.title}» возвращён на доработку: ${note}`, { taskId: a.taskId, artifactId: a.id }, 'warn');
  return a;
}

// «Решить позже» меняет только личный порядок очереди согласующего. Материал,
// задача, агенты, согласования и задания публикации остаются неизменными.
export function deferArtifactDecision(state              , now        , artifactId        , actor       )                 {
  const a = getArtifact(state, artifactId);
  if (actor.kind !== 'human') throw new DomainError('HUMAN_REQUIRED', 'Оставить материал на потом может только человек-согласующий');
  if (!state.project.approvers.includes(actor.name)) throw new DomainError('NOT_AN_APPROVER', `«${actor.name}» не входит в список согласующих проекта`);
  if (a.status !== 'IN_REVIEW') throw new DomainError('WRONG_STATUS', `Материал в статусе ${a.status}; оставить на потом можно только материал, ожидающий решения`);

  const existing = state.reviewDeferrals.find((d) => d.artifactId === a.id && d.artifactVersion === a.version && d.deferredBy === actor.name);
  const deferral                 = existing ?? {
    projectId: state.project.id,
    artifactId: a.id,
    artifactVersion: a.version,
    deferredBy: actor.name,
    deferredAt: now,
  };
  deferral.deferredAt = now;
  if (!existing) state.reviewDeferrals.push(deferral);
  pushEvent(state, now, actor, 'review.deferred', `Материал «${a.title}» оставлен на потом в очереди согласования`, { taskId: a.taskId, artifactId: a.id });
  return deferral;
}

export function revokeApproval(state              , now        , a                 , reason        )                  {
  const ap = activeApproval(state, a);
  if (!ap) return null;
  ap.status = 'revoked';
  ap.revokedReason = reason;
  ap.revokedAt = now;
  pushEvent(state, now, { kind: 'system' }, 'approval.revoked', `Согласование ${ap.id} отозвано: ${reason}`, { taskId: a.taskId, artifactId: a.id, approvalId: ap.id }, 'warn');
  return ap;
}

                                                                                                                                                       

// Любая правка содержания, канала, времени или пояса пересчитывает хэш; несовпадение с approval → отзыв и IN_REVIEW.
export function editArtifact(state              , now        , artifactId        , actor       , patch               , reason = 'правка')                  {
  const a = getArtifact(state, artifactId);
  if (a.status === 'PUBLISHING' || a.status === 'PUBLISHED') {
    throw new DomainError('IMMUTABLE', `Материал в статусе ${a.status} нельзя править; создайте новую версию как отдельный материал`);
  }
  const before = a.contentHash;
  a.versions.push({ version: a.version, title: a.title, body: a.body, cta: a.cta, hashtags: [...a.hashtags], contentHash: a.contentHash, savedAt: now, reason });
  Object.assign(a, patch);
  a.version += 1;
  a.contentHash = computeContentHash(a);
  a.updatedAt = now;

  const ap = activeApproval(state, a);
  if (ap && ap.contentHash !== a.contentHash) {
    revokeApproval(state, now, a, 'content changed');
    a.status = 'IN_REVIEW';
    if (a.qualityReport) a.qualityReport = { ...a.qualityReport, verdict: 'return', reason: 'Материал изменён после проверки — требуется повторная проверка контролёра' };
    const task = state.tasks.find((t) => t.id === a.taskId);
    if (task) {
      task.column = 'quality_control';
      const qcIdx = task.route.indexOf('quality-controller');
      task.stepIndex = qcIdx >= 0 ? qcIdx : task.stepIndex;
      task.updatedAt = now;
    }
    // отменяем задания в очереди, привязанные к отозванному согласованию
    for (const job of state.jobs) {
      if (job.approvalId === ap.id && job.status === 'QUEUED') {
        job.status = 'FAILED';
        job.finishedAt = now;
        job.log.push({ ts: now, level: 'warn', message: 'Задание отменено: согласование отозвано после правки' });
      }
    }
  } else if (a.status === 'IN_REVIEW' && a.qualityReport && a.qualityReport.artifactVersion !== a.version) {
    a.qualityReport = { ...a.qualityReport, verdict: 'return', reason: 'Материал изменён после проверки — требуется повторная проверка контролёра' };
    const task = state.tasks.find((t) => t.id === a.taskId);
    if (task) { task.column = 'quality_control'; const i = task.route.indexOf('quality-controller'); if (i >= 0) task.stepIndex = i; }
  }
  pushEvent(state, now, actor, 'artifact.edited', `Материал «${a.title}» изменён (v${a.version}); хэш ${before.slice(0, 8)} → ${a.contentHash.slice(0, 8)}`, { taskId: a.taskId, artifactId: a.id });
  return a;
}

// Перенос даты публикации из календаря. Одобренный материал переносить нельзя: время зафиксировано согласованием.
export function rescheduleArtifact(state              , now        , artifactId        , actor       , scheduledAt        , channelId                )                  {
  const a = getArtifact(state, artifactId);
  if (actor.kind !== 'human') throw new DomainError('HUMAN_REQUIRED', 'Переносить публикации может только человек');
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(scheduledAt)) throw new DomainError('BAD_DATE', 'Дата в формате ГГГГ-ММ-ДДTЧЧ:мм');
  if (a.status !== 'DRAFT' && a.status !== 'IN_REVIEW') {
    throw new DomainError('APPROVAL_LOCKS_SCHEDULE', `Нельзя перенести: материал в статусе ${a.status}, время ${a.scheduledAt ?? '—'} зафиксировано согласованием. Откройте материал и измените время правкой — согласование будет отозвано и потребуется повторное решение`);
  }
  const before = a.scheduledAt;
  a.scheduledAt = scheduledAt;
  if (channelId !== undefined && channelId !== null) {
    if (!state.channels.some((c) => c.id === channelId)) throw new DomainError('CHANNEL_NOT_FOUND', 'Канал не найден');
    a.channelId = channelId;
  }
  a.contentHash = computeContentHash(a);
  a.updatedAt = now;
  const task = state.tasks.find((t) => t.id === a.taskId);
  if (task) { task.plannedAt = scheduledAt; task.updatedAt = now; }
  pushEvent(state, now, actor, 'artifact.rescheduled', `«${a.title}» перенесён: ${before ?? '—'} → ${scheduledAt}`, { taskId: a.taskId, artifactId: a.id });
  return a;
}

// Отклонить материал: человек снимает его с работы; задача архивируется, согласование (если было) отзывается.
export function declineArtifact(state              , now        , artifactId        , actor       , note        )                  {
  const a = getArtifact(state, artifactId);
  if (actor.kind !== 'human') throw new DomainError('HUMAN_REQUIRED', 'Отклонить материал может только человек');
  if (a.status === 'PUBLISHING' || a.status === 'PUBLISHED') throw new DomainError('WRONG_STATUS', `Материал в статусе ${a.status} нельзя отклонить`);
  revokeApproval(state, now, a, `отклонён человеком: ${note || 'без комментария'}`);
  for (const job of state.jobs) if (job.artifactId === a.id && job.status === 'QUEUED') { job.status = 'FAILED'; job.finishedAt = now; job.log.push({ ts: now, level: 'warn', message: 'Задание отменено: материал отклонён' }); }
  a.status = 'DRAFT';
  a.updatedAt = now;
  const task = state.tasks.find((t) => t.id === a.taskId);
  if (task) { task.archived = true; task.returnNotes.push(`${actor.name}: отклонено — ${note || 'без комментария'}`); task.updatedAt = now; for (const ag of state.agents) if (ag.currentTaskId === task.id) { ag.status = 'idle'; ag.currentTaskId = null; } }
  pushEvent(state, now, actor, 'artifact.declined', `«${a.title}» отклонён: ${note || 'без комментария'}`, { taskId: a.taskId, artifactId: a.id }, 'warn');
  return a;
}
