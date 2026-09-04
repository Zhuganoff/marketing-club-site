// Кампании: цель, период, каналы, UTM и связи с задачами, материалами и публикациями.
                                                                
import { DomainError } from './types.js?v=mtmlwy9c';
import { nextId } from './ids.js?v=mtmlwy9c';
import { pushEvent } from './events.js?v=mtmlwy9c';

                                                                                                                                                                                               

function slug(s        )         {
  return s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 40) || 'campaign';
}

export function createCampaign(state              , now        , input                  , actor       )           {
  if (actor.kind !== 'human') throw new DomainError('HUMAN_REQUIRED', 'Кампанию создаёт человек');
  if (!input.name?.trim()) throw new DomainError('NAME_REQUIRED', 'Укажите название кампании');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.from) || !/^\d{4}-\d{2}-\d{2}$/.test(input.to) || input.to < input.from) throw new DomainError('BAD_PERIOD', 'Период: даты ГГГГ-ММ-ДД, конец не раньше начала');
  const channelIds = (input.channelIds ?? []).filter((id) => state.channels.some((c) => c.id === id));
  const campaign           = {
    id: nextId(state, 'cmp'), projectId: state.project.id, name: input.name.trim(), goal: input.goal?.trim() || '', audience: input.audience?.trim() || state.project.audience,
    geography: input.geography?.trim() || state.project.geography, period: { from: input.from, to: input.to }, channelIds,
    utm: { source: input.utmSource?.trim() || 'marketing-club', medium: input.utmMedium?.trim() || 'social', campaign: slug(input.name) },
    status: now.slice(0, 10) < input.from ? 'planned' : now.slice(0, 10) > input.to ? 'finished' : 'active',
    metrics: { visits: 0, leads: 0, consultations: 0, contracts: 0 }, createdAt: now,
  };
  state.campaigns.unshift(campaign);
  pushEvent(state, now, actor, 'campaign.created', `Создана кампания «${campaign.name}» (${campaign.period.from} — ${campaign.period.to})`);
  return campaign;
}

export function campaignSummary(state              , campaignId        ) {
  const c = state.campaigns.find((x) => x.id === campaignId);
  if (!c) throw new DomainError('CAMPAIGN_NOT_FOUND', `Кампания ${campaignId} не найдена`);
  const tasks = state.tasks.filter((t) => t.campaignId === c.id);
  const artifacts = state.artifacts.filter((a) => a.campaignId === c.id);
  const artifactIds = new Set(artifacts.map((a) => a.id));
  const jobs = state.jobs.filter((j) => artifactIds.has(j.artifactId));
  return {
    campaign: c, tasks, artifacts, jobs,
    utmQuery: `utm_source=${encodeURIComponent(c.utm.source)}&utm_medium=${encodeURIComponent(c.utm.medium)}&utm_campaign=${encodeURIComponent(c.utm.campaign)}`,
    counts: { tasks: tasks.length, artifacts: artifacts.length, published: jobs.filter((j) => j.status === 'PUBLISHED').length, failed: jobs.filter((j) => j.status === 'FAILED').length, inReview: artifacts.filter((a) => a.status === 'IN_REVIEW').length },
  };
}
