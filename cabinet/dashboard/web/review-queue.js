// Единый порядок очереди решений: новые материалы сверху, личные «на потом» —
// внизу от самого давно отложенного к последнему. Неверсияные отметки игнорируются.
                                                                                        
                                                                                                             

export function orderReviewQueue                         (
  artifacts              ,
  deferrals                                             ,
  actor        ,
)                                       {
  const deferredAt = new Map                ();
  for (const d of deferrals ?? []) {
    if (d.deferredBy !== actor) continue;
    const key = `${d.artifactId}\u0000${d.artifactVersion}`;
    const previous = deferredAt.get(key);
    if (!previous || previous < d.deferredAt) deferredAt.set(key, d.deferredAt);
  }

  return artifacts
    .filter((a) => a.status === 'IN_REVIEW')
    .map((artifact) => ({ artifact, at: deferredAt.get(`${artifact.id}\u0000${artifact.version}`) ?? null }))
    .sort((a, b) => {
      if (a.at === null && b.at !== null) return -1;
      if (a.at !== null && b.at === null) return 1;
      const timeOrder = a.at === null
        ? b.artifact.updatedAt.localeCompare(a.artifact.updatedAt)
        : a.at .localeCompare(b.at );
      return timeOrder || a.artifact.id.localeCompare(b.artifact.id);
    })
    .map(({ artifact, at }) => ({ artifact, deferred: at !== null }));
}
