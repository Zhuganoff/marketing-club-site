// Обработчики /api/*. Транспорт-независимы: получают метод, путь, тело; возвращают объект.
                                              
import { ARCHIVE_TTL_DAYS, MODEL_LABELS } from '../core/store.js?v=mtlshmqq';
import { analyzeSite } from './site-audit.js?v=mtlshmqq';
import { DomainError } from '../core/types.js?v=mtlshmqq';
                                                                           
import { advanceTask, createTask, planTask, unblockTask, ROUTES, KIND_LABELS } from '../core/workflow.js?v=mtlshmqq';
import { approveArtifact, declineArtifact, deferArtifactDecision, editArtifact, rejectArtifact, rescheduleArtifact } from '../core/approval.js?v=mtlshmqq';
import { campaignSummary, createCampaign } from '../core/campaigns.js?v=mtlshmqq';
import { createPublishJob, retryPublish, runJob, recountApprovalShare } from '../core/publishing.js?v=mtlshmqq';
import { MOCK_MODES } from '../core/connectors.js?v=mtlshmqq';
import { teamCoverage, wizardTemplate } from '../core/project-factory.js?v=mtlshmqq';
import { recordSeoAudit, saveSeoProfile, ctaFromProfile } from '../core/seo.js?v=mtlshmqq';

                                                                     
                                                            

function human(body     , fallback        )        {
  const name = typeof body?.actor === 'string' && body.actor.trim() ? body.actor.trim() : fallback;
  return { kind: 'human', name };
}

export function projectState(store       , pid        ) {
  const s = store.get(pid);
  const agents = store.agentsView(pid);
  const spent = s.agents.reduce((sum, a) => sum + a.budget.spentUsd, 0);
  const modelSpend = (Object.keys(MODEL_LABELS)             ).map((model) => ({
    model, label: MODEL_LABELS[model], usd: Math.round(s.agents.filter((a) => a.model === model).reduce((sum, a) => sum + a.budget.spentUsd, 0) * 100) / 100,
  }));
  return {
    project: s.project, teams: s.teams, channels: s.channels, agents, tasks: s.tasks, artifacts: s.artifacts, approvals: s.approvals, reviewDeferrals: s.reviewDeferrals,
    jobs: s.jobs, campaigns: s.campaigns.map((c) => ({ ...c, summary: campaignSummary(s, c.id).counts })), events: s.events.slice(0, 120), seoAudits: s.seoAudits ?? [], seoProfile: s.seoProfile ?? null, seoCtaPreview: ctaFromProfile(s),
    analytics: { ...s.analytics, modelSpend, approvalShare: recountApprovalShare(s) },
    budget: { limitUsd: s.project.weeklyLimitUsd, spentUsd: Math.round(spent * 100) / 100 },
    health: {
      status: agents.some((a) => a.status === 'error') ? 'degraded' : 'ok',
      integrations: 'disabled', network: 'disabled', provider: 'mock', keys: 'none', serverBind: '127.0.0.1',
    },
    connectors: Object.values(store.connectors).map((c) => ({ id: c.id, name: c.name, platforms: c.platforms, mode: c.mode })),
    mockModes: MOCK_MODES,
    kinds: (Object.keys(ROUTES)              ).map((k) => ({ kind: k, label: KIND_LABELS[k], route: ROUTES[k] })),
    teamPresets: wizardTemplate(store.catalog).presets,
  };
}

export async function handleApi(store       , req            )                       {
  const parts = req.path.replace(/^\/api\/?/, '').split('/').filter(Boolean);
  const ok = (body         )              => ({ status: 200, body });
  try {
    if (parts[0] === 'catalog' && parts[1] === 'agents' && req.method === 'GET') return ok(store.definitions());
    if (parts[0] === 'catalog' && parts[1] === 'workflows' && req.method === 'GET') return ok(ROUTES);
    const projectList = () => store.projectIds().map((id) => { const p = store.get(id).project; return { id, name: p.name, language: p.language, timezone: p.timezone }; });
    if (parts[0] === 'projects' && parts.length === 1 && req.method === 'GET') return ok(projectList());
    if (parts[0] === 'projects' && parts[1] === 'template' && parts.length === 2 && req.method === 'GET') return ok(wizardTemplate(store.catalog, MODEL_LABELS));
    if (parts[0] === 'projects' && parts.length === 1 && req.method === 'POST') {
      const { actor: _a, ...input } = req.body ?? {};
      const state = store.addProject(input, human(req.body, 'Владелец проекта').name);
      const roles = state.project.enabledRoles.map((r) => r.roleId);
      return { status: 201, body: { project: state.project, projects: projectList(), team: { roles, ...teamCoverage(roles) } } };
    }
    if (parts[0] === 'archive' && parts.length === 1 && req.method === 'GET') return ok({ archives: store.listArchives(), ttlDays: ARCHIVE_TTL_DAYS });
    if (parts[0] === 'archive' && parts[2] === 'restore' && req.method === 'POST') { const state = store.restoreArchive(parts[1]); return ok({ project: state.project, projects: projectList(), archives: store.listArchives() }); }
    // Анализ сайта для мастера (сеть разрешена владельцем 2026-09-03; только чтение публичных страниц).
    if (parts[0] === 'analyze-site' && req.method === 'POST') { const audit = await analyzeSite(String(req.body?.url ?? '')); return ok({ audit }); }
    if (parts[0] === 'archive' && parts[2] === 'delete' && req.method === 'POST') { const entry = store.deleteArchive(parts[1]); return ok({ deleted: entry, projects: projectList(), archives: store.listArchives() }); }
    if (parts[0] !== 'projects' || !parts[1]) return { status: 404, body: { error: { code: 'NOT_FOUND', message: 'Нет такого маршрута API' } } };
    const pid = parts[1];
    store.get(pid); // 404 если проекта нет
    const rest = parts.slice(2);
    const fallbackApprover = store.get(pid).project.approvers[0] ?? 'owner';

    if (rest.length === 0 || rest[0] === 'state') return ok(projectState(store, pid));
    if (rest[0] === 'export' && req.method === 'GET') return ok(store.exportProject(pid));
    if (rest[0] === 'archive' && req.method === 'POST') {
      const archive = store.archiveProject(pid, human(req.body, fallbackApprover).name);
      store.purgeArchives();
      return ok({ archive, projects: projectList(), archives: store.listArchives() });
    }
    if (req.method === 'GET') {
      const s = store.get(pid);
      switch (rest[0]) {
        case 'tasks': return ok(s.tasks);
        case 'artifacts': return ok(s.artifacts);
        case 'approvals': return ok(s.approvals);
        case 'jobs': return ok(s.jobs);
        case 'events': return ok(s.events);
        case 'agents': return ok(store.agentsView(pid));
        case 'analytics': return ok(projectState(store, pid).analytics);
        case 'channels': return ok(s.channels);
        case 'campaigns': return rest[1] ? ok(campaignSummary(s, rest[1])) : ok(s.campaigns);
      }
    }
    if (req.method === 'POST') {
      const b = req.body ?? {};
      if (rest[0] === 'reset') { store.reset(pid); return ok(projectState(store, pid)); }
      if (rest[0] === 'seo-audit' && rest.length === 1) {
        // Сеть — только в analyzeSite (dashboard/api); в состояние проекта пишется готовый результат.
        const audit = await analyzeSite(String(b.url ?? ''));
        const entry = store.mutate(pid, (s, now) => recordSeoAudit(s, now, { url: audit.url, score: audit.score, okCount: audit.okCount, warnCount: audit.warnCount, errCount: audit.errCount, platform: audit.platform, checks: audit.checks }, human(b, fallbackApprover)));
        return ok({ entry, audit, state: projectState(store, pid) });
      }
      if (rest[0] === 'seo-profile' && rest.length === 1) {
        const profile = store.mutate(pid, (s, now) => saveSeoProfile(s, now, b, human(b, fallbackApprover)));
        return ok({ profile, state: projectState(store, pid) });
      }
      if (rest[0] === 'settings') { const { actor: _a, ...patch } = b; store.updateSettings(pid, patch, human(b, fallbackApprover).name); return ok({ state: projectState(store, pid) }); }
      if (rest[0] === 'campaigns' && rest.length === 1) { const campaign = store.mutate(pid, (s, now) => createCampaign(s, now, b, human(b, fallbackApprover))); return ok({ campaign, state: projectState(store, pid) }); }
      if (rest[0] === 'artifacts' && rest[2] === 'review-later') { const reviewDeferral = store.mutate(pid, (s, now) => deferArtifactDecision(s, now, rest[1], human(b, fallbackApprover))); return ok({ reviewDeferral, state: projectState(store, pid) }); }
      if (rest[0] === 'artifacts' && rest[2] === 'reschedule') { const a = store.mutate(pid, (s, now) => rescheduleArtifact(s, now, rest[1], human(b, fallbackApprover), b.scheduledAt, b.channelId)); return ok({ artifact: a, state: projectState(store, pid) }); }
      if (rest[0] === 'artifacts' && rest[2] === 'decline') { const a = store.mutate(pid, (s, now) => declineArtifact(s, now, rest[1], human(b, fallbackApprover), b.note ?? '')); return ok({ artifact: a, state: projectState(store, pid) }); }
      if (rest[0] === 'tasks' && rest.length === 1) {
        const task = store.mutate(pid, (s, now) => createTask(s, now, store.catalog, { title: b.title, kind: b.kind, goal: b.goal, asIdea: Boolean(b.asIdea), demo: b.demo, campaignId: b.campaignId ?? null, plannedAt: b.plannedAt ?? null }, human(b, fallbackApprover)));
        return ok({ task, state: projectState(store, pid) });
      }
      if (rest[0] === 'tasks' && rest[2] === 'plan') { const task = store.mutate(pid, (s, now) => planTask(s, now, store.catalog, rest[1])); return ok({ task, state: projectState(store, pid) }); }
      if (rest[0] === 'tasks' && rest[2] === 'advance') { const r = store.mutate(pid, (s, now) => advanceTask(s, now, store.catalog, rest[1])); return ok({ ...r, state: projectState(store, pid) }); }
      if (rest[0] === 'tasks' && rest[2] === 'unblock') { const task = store.mutate(pid, (s, now) => unblockTask(s, now, rest[1], human(b, fallbackApprover), b.note ?? '')); return ok({ task, state: projectState(store, pid) }); }
      if (rest[0] === 'artifacts' && rest[2] === 'edit') { const a = store.mutate(pid, (s, now) => editArtifact(s, now, rest[1], human(b, fallbackApprover), b.patch ?? {}, b.reason)); return ok({ artifact: a, state: projectState(store, pid) }); }
      if (rest[0] === 'artifacts' && rest[2] === 'approve') { const ap = store.mutate(pid, (s, now) => approveArtifact(s, now, rest[1], human(b, fallbackApprover), { channelId: b.channelId, scheduledAt: b.scheduledAt, timezone: b.timezone })); return ok({ approval: ap, state: projectState(store, pid) }); }
      if (rest[0] === 'artifacts' && rest[2] === 'reject') { const a = store.mutate(pid, (s, now) => rejectArtifact(s, now, rest[1], human(b, fallbackApprover), b.note ?? 'без комментария')); return ok({ artifact: a, state: projectState(store, pid) }); }
      if (rest[0] === 'artifacts' && rest[2] === 'publish') { const job = store.mutate(pid, (s, now) => createPublishJob(s, now, rest[1], human(b, fallbackApprover))); return ok({ job, state: projectState(store, pid) }); }
      if (rest[0] === 'artifacts' && rest[2] === 'retry') { const job = store.mutate(pid, (s, now) => retryPublish(s, now, rest[1], human(b, fallbackApprover))); return ok({ job, state: projectState(store, pid) }); }
      if (rest[0] === 'jobs' && rest[2] === 'run') { const job = await store.mutateAsync(pid, (s) => runJob(s, () => store.now(), rest[1], store.connectors)); return ok({ job, state: projectState(store, pid) }); }
      if (rest[0] === 'channels' && rest[2] === 'mock-mode') {
        const mode = b.mode            ;
        if (!MOCK_MODES.includes(mode)) throw new DomainError('BAD_MODE', `Допустимые режимы: ${MOCK_MODES.join(', ')}`);
        store.mutate(pid, (s) => { const c = s.channels.find((x) => x.id === rest[1]); if (!c) throw new DomainError('NOT_FOUND', 'Канал не найден'); c.mockMode = mode; c.status = mode === 'success' || mode === 'delay' ? 'mock_ready' : 'mock_disconnected'; });
        return ok({ state: projectState(store, pid) });
      }
    }
    return { status: 404, body: { error: { code: 'NOT_FOUND', message: 'Нет такого маршрута API' } } };
  } catch (e) {
    if (e instanceof DomainError) return { status: e.code === 'NOT_FOUND' || e.code === 'PROJECT_NOT_FOUND' ? 404 : 409, body: { error: { code: e.code, message: e.message } } };
    if (e instanceof Error && (e                         ).code === 'ENOENT') return { status: 404, body: { error: { code: 'NOT_FOUND', message: e.message } } };
    const msg = e instanceof Error ? e.message : String(e);
    return { status: 500, body: { error: { code: 'INTERNAL', message: msg } } };
  }
}
