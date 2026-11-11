// An unparseable or malformed response cannot prove that a profile was removed.
export function classifyEvidence(doc, entry, config) {
  if (!doc || typeof doc !== "object" || doc.odp !== 1 || !Array.isArray(doc.profiles)) return "UNREADABLE";
  for (const profile of doc.profiles) {
    if (!profile || typeof profile !== "object" || Array.isArray(profile) ||
        typeof profile.profileId !== "string" ||
        typeof (profile.registry ?? doc.registry) !== "string" ||
        !Number.isSafeInteger(profile.chainId ?? doc.chainId)) return "UNREADABLE";
  }
  return doc.profiles.some((profile) => profile.profileId === entry.profileId &&
    (profile.registry ?? doc.registry).toLowerCase() === config.registryAddress.toLowerCase() &&
    (profile.chainId ?? doc.chainId) === config.chainId) ? "OK" : "MISSING";
}

// A previous success only applies to the same site and registry generation.
export function stateForEvidence(previous, entry, config) {
  const source = `${config.chainId}:${config.registryAddress.toLowerCase()}:${entry.evidenceHost.toLowerCase()}`;
  if (previous?.source !== source) return { source, consecutiveFailures: 0, everFound: false };
  return previous;
}
