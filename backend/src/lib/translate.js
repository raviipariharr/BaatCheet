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

const MAX_BYTES = 450; // MyMemory allows 500 bytes per request
const MAX_CHUNKS = 6;
const LIMIT_MESSAGE = "Daily translation limit reached. Please try again tomorrow.";

const byteLen = (s) => Buffer.byteLength(s, "utf8");

// MyMemory returns some characters as HTML entities
const decodeEntities = (s) =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

// split into pieces of at most MAX_BYTES, preferably at sentence ends
function chunkText(text) {
  const sentences = text.split(/(?<=[.!?।。！？\n])\s*/).filter(Boolean);
  const chunks = [];
  let current = "";

  const push = (piece) => {
    if (byteLen(current + piece) <= MAX_BYTES) {
      current += piece;
      return;
    }
    if (current) chunks.push(current);
    current = piece;
  };

  for (const s of sentences) {
    const sentence = s + " ";
    if (byteLen(sentence) <= MAX_BYTES) {
      push(sentence);
      continue;
    }
    // one huge sentence: cut by characters
    let buf = "";
    for (const ch of s) {
      if (byteLen(buf + ch) > MAX_BYTES) {
        push(buf);
        buf = "";
      }
      buf += ch;
    }
    if (buf) push(buf);
  }
  if (current) chunks.push(current);

  return chunks.map((c) => c.trim()).filter(Boolean);
}

async function translateChunk(text, target) {
  const params = new URLSearchParams({ q: text, langpair: `Autodetect|${target}` });
  // an email raises the free limit from 5,000 to 50,000 characters/day (no verification needed)
  if (process.env.MYMEMORY_EMAIL) params.set("de", process.env.MYMEMORY_EMAIL);

  let res;
  try {
    res = await fetch(`https://api.mymemory.translated.net/get?${params}`, {
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new TranslationError("Translation service timed out. Please try again.");
  }

  if (res.status === 429) throw new TranslationError(LIMIT_MESSAGE, 429);
  if (!res.ok) {
    console.error("MyMemory HTTP error:", res.status);
    throw new TranslationError("Translation service is unavailable right now.");
  }

  const data = await res.json();
  const out = data?.responseData?.translatedText || "";
  const status = Number(data?.responseStatus);

  if (status === 429 || /MYMEMORY WARNING/i.test(out)) {
    throw new TranslationError(LIMIT_MESSAGE, 429);
  }
  // the API refuses to "translate" a language into itself
  if (/DISTINCT LANGUAGES/i.test(out)) {
    return { translatedText: text, detected: target, sameLanguage: true };
  }
  if (status !== 200 || !out) {
    console.error("MyMemory error:", status, out.slice(0, 200));
    throw new TranslationError("Translation service is unavailable right now.");
  }

  return {
    translatedText: decodeEntities(out),
    detected: data.responseData.detectedLanguage || "",
    sameLanguage: false,
  };
}

export async function translateText(text, targetLanguage) {
  const target = LANGUAGE_CODES[targetLanguage];
  if (!target) throw new TranslationError("Unsupported target language", 400);

  const chunks = chunkText(text);
  if (chunks.length === 0) throw new TranslationError("Nothing to translate", 400);
  if (chunks.length > MAX_CHUNKS) {
    throw new TranslationError("This message is too long to translate", 400);
  }

  const results = [];
  for (const chunk of chunks) results.push(await translateChunk(chunk, target)); // one by one, gentler on a free API

  const translatedText = results.map((r) => r.translatedText).join(" ");
  const targetBase = target.split("-")[0].toLowerCase();
  const detectedBase = (results[0].detected || "").split("-")[0].toLowerCase();

  const sameLanguage =
    results.every((r) => r.sameLanguage) ||
    detectedBase === targetBase ||
    translatedText.trim().toLowerCase() === text.trim().toLowerCase();

  return { translatedText, sameLanguage };
}