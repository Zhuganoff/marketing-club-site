import { createHash } from '../_shim/node.js';
                                                  

// Канонический JSON: ключи в фиксированном порядке, без пробелов.
export function canonicalContent(a                                                                                                                                      )         {
  return JSON.stringify({
    artifactId: a.id,
    version: a.version,
    title: a.title,
    body: a.body,
    cta: a.cta,
    hashtags: [...a.hashtags],
    media: a.media.map((m) => ({ id: m.id, hash: m.hash })),
    channelId: a.channelId,
    scheduledAt: a.scheduledAt,
    timezone: a.timezone,
  });
}

export function sha256(text        )         {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

export function computeContentHash(a                                        )         {
  return sha256(canonicalContent(a));
}
