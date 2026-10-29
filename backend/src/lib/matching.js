const fluent = (u) => [u.nativeLanguage, ...(u.knownLanguages || [])].filter(Boolean);

export function scoreMatch(me, other) {
  // guard: "" === "" would falsely count as a match for users with empty languages
  const theyTeachMe =
    Boolean(me.learningLanguage) && other.nativeLanguage === me.learningLanguage;
  const iTeachThem =
    Boolean(other.learningLanguage) && me.nativeLanguage === other.learningLanguage;

  let score = 0;
  let type = "none";

  if (theyTeachMe && iTeachThem) {
    score += 100;
    type = "mutual";
  } else if (theyTeachMe) {
    score += 50;
    type = "they_teach_me";
  } else if (iTeachThem) {
    score += 40;
    type = "i_teach_them";
  }

  if (!theyTeachMe && (other.knownLanguages || []).includes(me.learningLanguage)) score += 15;
  if (!iTeachThem && (me.knownLanguages || []).includes(other.learningLanguage)) score += 10;

  const mine = new Set(fluent(me));
  const commonLanguages = fluent(other).filter((l) => mine.has(l));
  if (commonLanguages.length) score += 15;

  return { score, type, commonLanguages };
}