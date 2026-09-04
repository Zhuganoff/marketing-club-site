// Предпросмотр материала под площадки — mock-вид поста, ничего не публикует.
                                     
import { h, badge, PLATFORMS, PLATFORM_LABEL, timeOf } from '../ui.js?v=mtmlkoru';

function textFor(artifact     , platform        )         {
  const v = (artifact.channelVersions ?? []).find((x     ) => x.platform === platform);
  if (v) return v.body;
  return [artifact.body, artifact.cta].filter(Boolean).join('\n\n');
}

function channelName(app     , artifact     , platform        )         {
  const st = app.state;
  const own = artifact.channelId ? st.channels.find((c     ) => c.id === artifact.channelId) : null;
  if (own && own.platform === platform) return own.name;
  const any = st.channels.find((c     ) => c.platform === platform);
  return any ? any.name : st.project.name;
}

export function platformPreview(app     , artifact     , platform        )              {
  const text = textFor(artifact, platform);
  const tags = (artifact.hashtags ?? []).join(' ');
  const name = channelName(app, artifact, platform);
  const hasMedia = (artifact.media ?? []).length > 0;
  const mediaDesc = hasMedia ? artifact.media.map((m     ) => `${m.kind}: ${m.description}`).join('; ') : 'медиа не задано';
  const firstLine = (text.split('\n').find((l        ) => l.trim()) ?? artifact.title).trim();
  const note = h('div', { class: 'note' }, 'предпросмотр — mock, публикация не выполняется');
  const who = (opts                                       = {}) => h('div', { class: 'who' },
    opts.avatar === false ? null : h('i'), h('span', null, name), h('span', { class: 'muted small' }, `· ${PLATFORM_LABEL[platform] ?? platform}`),
    opts.extra ? h('span', { class: 'mono muted small', style: { marginLeft: 'auto' } }, opts.extra) : null);

  switch (platform) {
    case 'telegram':
      return h('div', { class: 'preview telegram' }, who({ avatar: false, extra: timeOf(artifact.scheduledAt) }),
        hasMedia ? h('div', { class: 'media-ph sm', style: { marginBottom: '8px' } }, mediaDesc) : null,
        h('div', { class: 'txt' }, text), tags ? h('div', { class: 'tags' }, tags) : null, note);
    case 'instagram':
      return h('div', { class: 'preview instagram' }, who(),
        h('div', { class: 'media-ph', style: { marginBottom: '8px' } }, hasMedia ? mediaDesc : 'квадрат 1:1 — медиа обязательно'),
        h('div', { class: 'txt clamp-2' }, h('b', null, name), ' ', text), h('div', { class: 'muted small' }, 'ещё'),
        tags ? h('div', { class: 'tags' }, tags) : null, note);
    case 'tiktok':
      return h('div', { class: 'preview tiktok' },
        h('div', { class: 'vertical-ph' }, h('div', { class: 'onscreen' }, firstLine), h('div', { class: 'small preview-muted' }, hasMedia ? mediaDesc : 'вертикальное видео 9:16')),
        h('div', { class: 'who', style: { marginTop: '8px' } }, h('i'), h('span', null, `@${name.replace(/\s+/g, '').toLowerCase().slice(0, 20)}`)),
        h('div', { class: 'txt' }, text.split('\n').slice(0, 2).join(' ')), tags ? h('div', { class: 'tags preview-tags' }, tags) : null, note);
    case 'youtube':
      return h('div', { class: 'preview youtube' },
        h('div', { class: 'media-ph sm', style: { marginBottom: '8px' } }, hasMedia ? mediaDesc : 'обложка 16:9'),
        h('div', { class: 'yt-title' }, artifact.title), who({ avatar: true }),
        h('div', { class: 'txt muted small' }, text), tags ? h('div', { class: 'tags' }, tags) : null, note);
    case 'facebook':
      return h('div', { class: 'preview facebook' }, who(), h('div', { class: 'txt' }, text), tags ? h('div', { class: 'tags' }, tags) : null,
        hasMedia ? h('div', { class: 'media-ph sm', style: { marginTop: '8px' } }, mediaDesc) : null,
        h('div', { class: 'actions-line' }, 'Нравится · Комментировать'), note);
    case 'vk':
    default:
      return h('div', { class: 'preview vk' }, who(), h('div', { class: 'txt' }, text), tags ? h('div', { class: 'tags' }, tags) : null,
        hasMedia ? h('div', { class: 'media-ph sm', style: { marginTop: '8px' } }, mediaDesc) : null,
        h('div', { class: 'actions-line' }, 'Нравится · Поделиться'), note);
  }
}

export function previewTabs(app     , artifact     , active        , onChange                     )              {
  const st = app.state;
  const has = new Set(st.channels.map((c     ) => c.platform));
  const current = PLATFORMS.includes(active) ? active : PLATFORMS[0];
  const seg = h('div', { class: 'seg preview-seg' }, ...PLATFORMS.map((p) => h('button', { class: p === current ? 'active' : '', title: has.has(p) ? 'в проекте есть канал' : 'канала в проекте нет', onClick: () => onChange(p) }, PLATFORM_LABEL[p] ?? p, has.has(p) ? h('span', { class: 'has-dot', 'aria-label': 'есть канал' }) : null)));
  const chan = st.channels.find((c     ) => c.platform === current);
  return h('div', { class: 'preview-wrap' }, seg,
    h('div', { class: 'row small', style: { margin: '8px 0' } }, chan ? badge('есть канал', 'ok') : badge('канала нет', ''), chan ? h('span', { class: 'muted' }, `${chan.name} · ${chan.timezone}`) : h('span', { class: 'muted' }, 'версия подготовлена редактором каналов, канал не подключён')),
    platformPreview(app, artifact, current));
}
