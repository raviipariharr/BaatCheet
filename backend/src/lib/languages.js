export const SUPPORTED_LANGUAGES = [
  "english", "spanish", "french", "german", "mandarin", "japanese", "korean",
  "hindi", "russian", "portuguese", "arabic", "italian", "turkish", "dutch",
];

export const MAX_KNOWN_LANGUAGES = 5;

export function parseLanguages(body) {
  const clean = (v) => (typeof v === "string" ? v.trim().toLowerCase() : "");

  const nativeLanguage = clean(body.nativeLanguage);
  const learningLanguage = clean(body.learningLanguage);
  const knownLanguages = Array.isArray(body.knownLanguages)
    ? [...new Set(body.knownLanguages.map(clean))] // lowercase + dedupe
    : [];

  if (!SUPPORTED_LANGUAGES.includes(nativeLanguage))
    return { error: "Invalid native language" };
  if (!SUPPORTED_LANGUAGES.includes(learningLanguage))
    return { error: "Invalid learning language" };
  if (nativeLanguage === learningLanguage)
    return { error: "Native and learning language can't be the same" };
  if (knownLanguages.some((l) => !SUPPORTED_LANGUAGES.includes(l)))
    return { error: "One or more known languages are invalid" };
  if (knownLanguages.length > MAX_KNOWN_LANGUAGES)
    return { error: `You can add at most ${MAX_KNOWN_LANGUAGES} other languages` };

  // known languages must not repeat native/learning
  const filteredKnown = knownLanguages.filter(
    (l) => l !== nativeLanguage && l !== learningLanguage
  );

  return { data: { nativeLanguage, learningLanguage, knownLanguages: filteredKnown } };
}