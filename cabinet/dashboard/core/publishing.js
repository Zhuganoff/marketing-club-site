// Исполнитель публикации и задания. См. docs/PUBLISHING_CONTRACT.md §4.
                                                                                                                   
import { DomainError } from './types.js?v=mtmjsdom';
import { computeContentHash } from './hash.js?v=mtmjsdom';
import { nextId } from './ids.js?v=mtmjsdom';
import { pushEvent } from './events.js?v=mtmjsdom';
import { getArtifact } from './approval.js?v=mtmjsdom';

export const MAX_FAILED_ATTEMPTS = 3;
const EXECUTOR        = { kind: 'agent', roleId: 'publisher-executor' };

// UTM-контракт (решение владельца 03.09, из анализа SMM-модуля): каждая ссылка публикации
// несёт utm_source=<площадка>, utm_medium/campaign — из кампании (или social/<id проекта>),
// utm_content=<id материала>. Разметка — транспортная: добавляется в payload задания,
// материал и его согласованный хэш не меняются. Сторонние сокращатели не используются.
export function utmQueryFor(state              , artifactId        , campaignId               , platform        )         {
  const cmp = campaignId ? state.campaigns.find((c) => c.id === campaignId) : null;
  const enc = encodeURIComponent;
  return `utm_source=${enc(platform)}&utm_medium=${enc(cmp?.utm.medium ?? 'social')}&utm_campaign=${enc(cmp?.utm.campaign ?? state.project.id)}&utm_content=${enc(artifactId)}`;
}

export function withUtm(text        , utmQuery        )         {
  return text.replace(/https?:\/\/[^\s"'<>)\]]+/g, (link) => {
    if (/[?&]utm_source=/.test(link)) return link;
    const clean = link.replace(/[.,;:!?]+$/, '');
    const tail = link.slice(clean.length);
    return clean + (clean.includes('?') ? '&' : '?') + utmQuery + tail;
  });
}

export function createPublishJob(state              , now        , artifactId        , actor       )             {
  const a = getArtifact(state, artifactId);
  if (actor.kind !== 'human') throw new DomainError('HUMAN_REQUIRED', 'Отправить в очередь публикации может только человек');
  if (a.status !== 'APPROVED') throw new DomainError('WRONG_STATUS', `Материал в статусе ${a.status}; в очередь можно взять только APPROVED`);
  const approval = state.approvals.find((x) => x.id === a.approvalId);
  if (!approval || approval.status !== 'active' || approval.artifactVersion !== a.version) {
    throw new DomainError('NO_ACTIVE_APPROVAL', 'Нет действующего согласования для этой версии материала');
  }
  const currentHash = computeContentHash(a);
  if (approval.contentHash !== currentHash) throw new DomainError('HASH_MISMATCH', 'Хэш содержания не совпадает с согласованным — материал изменялся');
  if (!a.channelId || approval.channelId !== a.channelId) throw new DomainError('CHANNEL_MISMATCH', 'Канал материала не совпадает с согласованным');
  const channel = state.channels.find((c) => c.id === a.channelId);
  if (!channel) throw new DomainError('CHANNEL_NOT_FOUND', 'Канал не найден');
  if (state.jobs.some((j) => j.artifactId === a.id && (j.status === 'QUEUED' || j.status === 'PUBLISHING'))) {
    throw new DomainError('JOB_EXISTS', 'Для материала уже есть активное задание');
  }

  const utmQuery = utmQueryFor(state, a.id, a.campaignId, channel.platform);
  const payload                 = {
    artifactId: a.id, version: a.version, contentHash: currentHash,
    title: a.title, body: withUtm(a.body, utmQuery), cta: withUtm(a.cta, utmQuery), hashtags: [...a.hashtags], media: a.media.map((m) => ({ ...m })),
    platform: channel.platform, scheduledAt: approval.scheduledAt, timezone: approval.timezone, utmQuery,
  };
  const job             = {
    id: nextId(state, 'job'), projectId: state.project.id, artifactId: a.id, approvalId: approval.id,
    channelId: channel.id, connectorId: channel.connectorId, status: 'QUEUED', attempt: 1, payload,
    log: [{ ts: now, level: 'info', message: `Задание создано исполнителем по решению ${actor.name}; approval ${approval.id}, hash ${currentHash.slice(0, 8)}` }],
    scheduledAt: approval.scheduledAt, result: null, createdBy: actor.name, createdAt: now, finishedAt: null,
  };
  state.jobs.unshift(job);
  a.status = 'SCHEDULED';
  a.updatedAt = now;
  pushEvent(state, now, EXECUTOR, 'job.created', `Задание ${job.id} поставлено в очередь: «${a.title}» → ${channel.name}`, { taskId: a.taskId, artifactId: a.id, approvalId: approval.id, jobId: job.id, channelId: channel.id });
  return job;
}

export async function runJob(state              , now              , jobId        , connectors                                         )                      {
  const job = state.jobs.find((j) => j.id === jobId);
  if (!job) throw new DomainError('NOT_FOUND', `Задание ${jobId} не найдено`);
  if (job.status !== 'QUEUED') throw new DomainError('WRONG_STATUS', `Задание в статусе ${job.status}; выполнить можно только QUEUED`);
  const a = getArtifact(state, job.artifactId);
  const approval = state.approvals.find((x) => x.id === job.approvalId);
  if (!approval || approval.status !== 'active' || approval.contentHash !== computeContentHash(a)) {
    job.status = 'FAILED';
    job.finishedAt = now();
    job.log.push({ ts: job.finishedAt, level: 'error', message: 'Согласование недействительно на момент публикации — задание остановлено' });
    a.status = 'IN_REVIEW';
    pushEvent(state, job.finishedAt, EXECUTOR, 'job.failed', `Задание ${job.id} остановлено: согласование недействительно`, { artifactId: a.id, jobId: job.id, taskId: a.taskId }, 'error');
    return job;
  }
  const channel = state.channels.find((c) => c.id === job.channelId);
  const connector = connectors[job.connectorId];
  const mockMode = channel?.mockMode ?? 'success';
  job.status = 'PUBLISHING';
  a.status = 'PUBLISHING';
  const startTs = now();
  job.log.push({ ts: startTs, level: 'info', message: `Вызов ${connector.name}, режим mock: ${mockMode}` });
  pushEvent(state, startTs, EXECUTOR, 'job.publishing', `Публикация ${job.id} через ${connector.name} (mock: ${mockMode})`, { artifactId: a.id, jobId: job.id, taskId: a.taskId });
  const executor = state.agents.find((ag) => ag.roleId === 'publisher-executor');
  if (executor) { executor.status = 'working'; executor.currentTaskId = a.taskId; }

  const result = await connector.publish(job, job.payload, mockMode);
  const endTs = now();
  job.result = result;
  job.finishedAt = endTs;
  if (executor) { executor.status = result.ok ? 'idle' : 'error'; executor.currentTaskId = null; executor.lastRunAt = endTs; executor.runs += 1; executor.errorMessage = result.ok ? undefined : result.message; }
  const task = state.tasks.find((t) => t.id === a.taskId);
  if (result.ok) {
    job.status = 'PUBLISHED';
    a.status = 'PUBLISHED';
    a.failedAttempts = 0;
    job.log.push({ ts: endTs, level: 'info', message: `Опубликовано (mock), внешний id ${result.externalId}` });
    if (task) { task.column = 'published'; task.updatedAt = endTs; }
    pushEvent(state, endTs, EXECUTOR, 'job.published', `«${a.title}» опубликован (mock) в канале ${channel?.name ?? job.channelId}`, { artifactId: a.id, jobId: job.id, taskId: a.taskId, channelId: job.channelId });
    pushEvent(state, endTs, { kind: 'agent', roleId: 'funnel-analyst' }, 'analytics.received', `Аналитик получил статус публикации ${job.id} (агрегированные данные, mock)`, { jobId: job.id, taskId: a.taskId });
    state.analytics.approvalShare = recountApprovalShare(state);
  } else {
    job.status = 'FAILED';
    a.status = 'FAILED';
    a.failedAttempts += 1;
    job.log.push({ ts: endTs, level: 'error', message: `${result.code}: ${result.message}. Автоповтор отключён; повтор — только по решению человека` });
    pushEvent(state, endTs, EXECUTOR, 'job.failed', `Публикация ${job.id} не удалась: ${result.code} — ${result.message}`, { artifactId: a.id, jobId: job.id, taskId: a.taskId, channelId: job.channelId }, 'error');
    if (a.failedAttempts >= MAX_FAILED_ATTEMPTS) {
      a.status = 'IN_REVIEW';
      approval.status = 'revoked';
      approval.revokedReason = `три неудачные публикации подряд`;
      approval.revokedAt = endTs;
      if (task) task.column = 'in_review';
      pushEvent(state, endTs, { kind: 'system' }, 'approval.revoked', `Согласование ${approval.id} отозвано после ${MAX_FAILED_ATTEMPTS} неудач — требуется повторное решение человека`, { artifactId: a.id, approvalId: approval.id }, 'warn');
    }
  }
  a.updatedAt = endTs;
  return job;
}

// Повтор после FAILED — только человек, только новое задание, только при действующем согласовании.
export function retryPublish(state              , now        , artifactId        , actor       )             {
  const a = getArtifact(state, artifactId);
  if (actor.kind !== 'human') throw new DomainError('HUMAN_REQUIRED', 'Повтор публикации — только по решению человека');
  if (a.status !== 'FAILED') throw new DomainError('WRONG_STATUS', `Повторить можно только материал в статусе FAILED (сейчас ${a.status})`);
  if (a.failedAttempts >= MAX_FAILED_ATTEMPTS) throw new DomainError('RETRY_LIMIT', 'Лимит повторов исчерпан — материал вернулся на согласование');
  a.status = 'APPROVED';
  pushEvent(state, now, actor, 'job.retry', `${actor.name} запросил повторную публикацию «${a.title}» (попытка ${a.failedAttempts + 1})`, { artifactId: a.id, taskId: a.taskId }, 'warn');
  return createPublishJob(state, now, artifactId, actor);
}

export function recountApprovalShare(state              )                                      {
  const counts                         = {};
  for (const a of state.artifacts) if (a.kind === 'draft' || a.kind === 'weekly_report') counts[a.status] = (counts[a.status] ?? 0) + 1;
  return Object.entries(counts).map(([status, count]) => ({ status, count }));
}
