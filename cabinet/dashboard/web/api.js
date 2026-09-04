// Клиент локального API. Все запросы — только к текущему origin (127.0.0.1).
export class ApiError extends Error { code        ; constructor(code        , message        ) { super(message); this.code = code; } }

import { handleApi } from '../api/routes.js';
import { Store } from '../core/store.js';
const __store = new Store({ hideDemo: true });
async function call(method, path, body) {
  const out = await handleApi(__store, { method, path, body: body ?? null });
  const data = out.body ?? {};
  if (out.status >= 400) throw new ApiError(data?.error?.code ?? 'HTTP', data?.error?.message ?? ('HTTP ' + out.status));
  return JSON.parse(JSON.stringify(data));
}


export const api = {
  projects: () => call('GET', '/api/projects'),
  projectTemplate: () => call('GET', '/api/projects/template'),
  createProject: (input     , actor        ) => call('POST', '/api/projects', { ...input, actor }),
  catalog: () => call('GET', '/api/catalog/agents'),
  state: (p        ) => call('GET', `/api/projects/${p}/state`),
  createTask: (p        , input     ) => call('POST', `/api/projects/${p}/tasks`, input),
  planTask: (p        , t        ) => call('POST', `/api/projects/${p}/tasks/${t}/plan`),
  advance: (p        , t        ) => call('POST', `/api/projects/${p}/tasks/${t}/advance`),
  unblock: (p        , t        , note        , actor        ) => call('POST', `/api/projects/${p}/tasks/${t}/unblock`, { note, actor }),
  edit: (p        , a        , patch     , actor        , reason         ) => call('POST', `/api/projects/${p}/artifacts/${a}/edit`, { patch, actor, reason }),
  approve: (p        , a        , input     ) => call('POST', `/api/projects/${p}/artifacts/${a}/approve`, input),
  reject: (p        , a        , note        , actor        ) => call('POST', `/api/projects/${p}/artifacts/${a}/reject`, { note, actor }),
  publish: (p        , a        , actor        ) => call('POST', `/api/projects/${p}/artifacts/${a}/publish`, { actor }),
  retry: (p        , a        , actor        ) => call('POST', `/api/projects/${p}/artifacts/${a}/retry`, { actor }),
  runJob: (p        , j        ) => call('POST', `/api/projects/${p}/jobs/${j}/run`),
  mockMode: (p        , c        , mode        ) => call('POST', `/api/projects/${p}/channels/${c}/mock-mode`, { mode }),
  reset: (p        ) => call('POST', `/api/projects/${p}/reset`),
  createCampaign: (p        , input     , actor        ) => call('POST', `/api/projects/${p}/campaigns`, { ...input, actor }),
  campaign: (p        , c        ) => call('GET', `/api/projects/${p}/campaigns/${c}`),
  reviewLater: (p        , a        , actor        ) => call('POST', `/api/projects/${p}/artifacts/${a}/review-later`, { actor }),
  reschedule: (p        , a        , scheduledAt        , channelId               , actor        ) => call('POST', `/api/projects/${p}/artifacts/${a}/reschedule`, { scheduledAt, channelId, actor }),
  decline: (p        , a        , note        , actor        ) => call('POST', `/api/projects/${p}/artifacts/${a}/decline`, { note, actor }),
  settings: (p        , patch     , actor        ) => call('POST', `/api/projects/${p}/settings`, { ...patch, actor }),
  exportProject: (p        ) => call('GET', `/api/projects/${p}/export`),
  archiveProject: (p        , actor        ) => call('POST', `/api/projects/${p}/archive`, { actor }),
  archives: () => call('GET', '/api/archive'),
  restoreArchive: (name        ) => call('POST', `/api/archive/${name}/restore`),
  deleteArchive: (name        ) => call('POST', `/api/archive/${name}/delete`),
  analyzeSite: (url        ) => call('POST', '/api/analyze-site', { url }),
  seoAudit: (p        , url        , actor        ) => call('POST', `/api/projects/${p}/seo-audit`, { url, actor }),
  saveSeoProfile: (p        , profile     , actor        ) => call('POST', `/api/projects/${p}/seo-profile`, { ...profile, actor }),
};
