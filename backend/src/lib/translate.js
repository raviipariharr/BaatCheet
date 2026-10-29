export class TranslationError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.status = status;
  }
}

const LANGUAGE_CODES = {
  english: "en", spanish: "es", french: "fr", german: "de", mandarin: "zh-CN",
  japanese: "ja", korean: "ko", hindi: "hi", russian: "ru", portuguese: "pt",
  arabic: "ar", italian: "it", turkish: "tr", dutch: "nl",
};

export async function translateText(text, targetLanguage) {
  const target = LANGUAGE_CODES[targetLanguage];
  if (!target) throw new TranslationError("Unsupported target language", 400);

  let res;
  try {
    res = await fetch(
      `https://translation.googleapis.com/language/translate/v2?key=${process.env.TRANSLATE_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: text, target, format: "text" }),
        signal: AbortSignal.timeout(8000),
      }
    );
  } catch {
    // network error or timeout (never log the URL, it contains the key)
    throw new TranslationError("Translation service timed out. Please try again.");
  }

  if (!res.ok) {
    console.error("Translation API error, status:", res.status);
    throw new TranslationError(
      res.status === 429
        ? "Translation limit reached. Please try again later."
        : "Translation service is unavailable right now."
    );
  }

  const data = await res.json();
  const result = data?.data?.translations?.[0];
  if (!result?.translatedText) throw new TranslationError("Empty response from translation service");

  const detected = result.detectedSourceLanguage || "";
  return {
    translatedText: result.translatedText,
    sameLanguage: detected.split("-")[0] === target.split("-")[0],
  };
}