// codes for Chrome's Translator API
export const LANG_CODES = {
  english: "en", spanish: "es", french: "fr", german: "de", mandarin: "zh",
  japanese: "ja", korean: "ko", hindi: "hi", russian: "ru", portuguese: "pt",
  arabic: "ar", italian: "it", turkish: "tr", dutch: "nl",
};

// locales for speech recognition (change "en-US" to "en-IN" if most speakers are Indian)
export const SPEECH_LOCALES = {
  english: "en-US", spanish: "es-ES", french: "fr-FR", german: "de-DE", mandarin: "zh-CN",
  japanese: "ja-JP", korean: "ko-KR", hindi: "hi-IN", russian: "ru-RU", portuguese: "pt-BR",
  arabic: "ar-SA", italian: "it-IT", turkish: "tr-TR", dutch: "nl-NL",
};

const translators = new Map(); // "hi>en" -> Translator

// "unsupported" | "unavailable" | "downloadable" | "downloading" | "available"
export async function packStatus(source, target) {
  if (typeof self === "undefined" || !("Translator" in self)) return "unsupported";
  try {
    return await self.Translator.availability({ sourceLanguage: source, targetLanguage: target });
  } catch {
    return "unavailable";
  }
}

// creating a translator needs a user click the first time (language pack download)
export async function getTranslator(source, target, onProgress) {
  const key = `${source}>${target}`;
  if (translators.has(key)) return translators.get(key);

  const translator = await self.Translator.create({
    sourceLanguage: source,
    targetLanguage: target,
    monitor(m) {
      m.addEventListener("downloadprogress", (e) => onProgress?.(e.loaded));
    },
  });
  translators.set(key, translator);
  return translator;
}