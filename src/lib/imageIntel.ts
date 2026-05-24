/**
 * Image Intel — server-side image analysis pipeline.
 *
 * Three independent panels:
 *   - exif()    : reads camera + GPS metadata from the file (free, fast)
 *   - aiVision(): asks Google Gemini "what is happening, where could this
 *                 have been taken, what objects are visible, is there text?"
 *
 * OCR runs on the client (tesseract.js in the browser) so the heavy WASM
 * download isn't paid for by every visitor. The result is sent back here
 * only as already-extracted strings if the user wants to attach them to
 * a dossier.
 */
import { env } from "./env";

/* ------------------------------------------------------------------ */
/* EXIF                                                                */
/* ------------------------------------------------------------------ */

export interface ExifReadout {
  camera?: string;
  lens?: string;
  software?: string;
  takenAt?: string;
  iso?: number;
  focalLength?: string;
  aperture?: string;
  shutterSpeed?: string;
  orientation?: number;
  width?: number;
  height?: number;
  gps?: {
    lat: number;
    lng: number;
    altitude?: number;
    direction?: number;
  };
  rawKeys: string[];
}

/**
 * Pull EXIF + GPS out of a base64 data URL.
 *
 * exifr is dynamically imported because it pulls in browser shims even on
 * Node, and we don't want to penalise cold start when the user hasn't
 * opened the Image Intel screen yet.
 */
export async function readExif(dataUrl: string): Promise<ExifReadout> {
  // The data URL prefix wraps the actual base64 payload; exifr only
  // accepts ArrayBuffer / Buffer / Blob server-side.
  const m = /^data:image\/[^;]+;base64,(.*)$/i.exec(dataUrl);
  if (!m) return { rawKeys: [] };
  const buf = Buffer.from(m[1]!, "base64");

  let parser: typeof import("exifr");
  try {
    parser = await import("exifr");
  } catch {
    return { rawKeys: [] };
  }

  try {
    const tags = (await parser.parse(buf, {
      gps: true,
      tiff: true,
      exif: true,
      iptc: true,
      mergeOutput: true,
    })) as Record<string, unknown> | null;

    if (!tags) return { rawKeys: [] };

    const out: ExifReadout = { rawKeys: Object.keys(tags) };

    if (tags.Make && tags.Model) {
      out.camera = `${String(tags.Make).trim()} ${String(tags.Model).trim()}`;
    } else if (tags.Model) {
      out.camera = String(tags.Model).trim();
    }
    if (tags.LensModel) out.lens = String(tags.LensModel);
    if (tags.Software) out.software = String(tags.Software);
    if (tags.DateTimeOriginal instanceof Date) {
      out.takenAt = (tags.DateTimeOriginal as Date).toISOString();
    } else if (typeof tags.DateTimeOriginal === "string") {
      out.takenAt = tags.DateTimeOriginal;
    } else if (tags.CreateDate instanceof Date) {
      out.takenAt = (tags.CreateDate as Date).toISOString();
    }
    if (typeof tags.ISO === "number") out.iso = tags.ISO;
    if (tags.FocalLength) out.focalLength = `${tags.FocalLength}mm`;
    if (typeof tags.FNumber === "number") out.aperture = `f/${tags.FNumber}`;
    if (typeof tags.ExposureTime === "number") {
      const t = tags.ExposureTime as number;
      out.shutterSpeed = t < 1 ? `1/${Math.round(1 / t)}s` : `${t}s`;
    }
    if (typeof tags.Orientation === "number") {
      out.orientation = tags.Orientation;
    }
    if (typeof tags.ExifImageWidth === "number")
      out.width = tags.ExifImageWidth;
    if (typeof tags.ExifImageHeight === "number")
      out.height = tags.ExifImageHeight;

    if (
      typeof tags.latitude === "number" &&
      typeof tags.longitude === "number" &&
      Number.isFinite(tags.latitude) &&
      Number.isFinite(tags.longitude)
    ) {
      out.gps = {
        lat: tags.latitude,
        lng: tags.longitude,
        altitude:
          typeof tags.GPSAltitude === "number" ? tags.GPSAltitude : undefined,
        direction:
          typeof tags.GPSImgDirection === "number"
            ? tags.GPSImgDirection
            : undefined,
      };
    }

    return out;
  } catch {
    return { rawKeys: [] };
  }
}

/* ------------------------------------------------------------------ */
/* AI Vision (Google Gemini OR OpenRouter)                             */
/* ------------------------------------------------------------------ */

export interface AiAnalysis {
  summary: string;
  scene: string | null;
  objects: string[];
  textsFound: string[];
  geoGuess: {
    country?: string;
    region?: string;
    city?: string;
    confidence?: "low" | "medium" | "high";
    reasoning?: string;
  } | null;
  raw: string;
  /** Which provider produced this analysis. */
  provider: "gemini" | "openrouter";
  /** Specific model used, e.g. "gemini-1.5-flash-latest". */
  model: string;
}

const PROMPT = `You are an OSINT analyst. Examine the attached image and produce a JSON object with the following keys, and ONLY this JSON, no prose around it:

{
  "summary": "one or two sentences describing the scene",
  "scene": "indoor|outdoor|street|nature|vehicle|document|portrait|object|other",
  "objects": ["short list of notable objects, animals, vehicles, brands, signs"],
  "textsFound": ["any clearly readable text in the image, transcribed verbatim"],
  "geoGuess": {
    "country": "best guess country name in English, or null",
    "region": "state/province/region, or null",
    "city": "best guess city, or null",
    "confidence": "low|medium|high",
    "reasoning": "1-2 sentence explanation of which clues led to this guess (architecture, signage, vegetation, license plates, language, …). Stay neutral, never claim certainty."
  }
}

Rules:
- If the image is not informative enough, set fields to null but always return the same shape.
- Never invent text that isn't actually visible.
- Never identify private individuals by name.
- Output strictly valid JSON.`;

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
  promptFeedback?: { blockReason?: string };
}

interface OpenAiCompatResponse {
  choices?: Array<{
    message?: { content?: string };
    finish_reason?: string;
  }>;
  error?: { message?: string };
}

/**
 * Pick which provider to call. OpenRouter wins when its key is set
 * because it gives access to multiple models with one credential.
 * Falls back to Gemini, then returns null when neither is configured.
 */
export async function aiVision(dataUrl: string): Promise<AiAnalysis | null> {
  const orKey = (process.env.OPENROUTER_API_KEY ?? "").trim();
  const geminiKey = (process.env.GEMINI_API_KEY ?? "").trim();

  if (orKey) return aiVisionOpenRouter(dataUrl, orKey);
  if (geminiKey) return aiVisionGemini(dataUrl, geminiKey);
  return null;
}

async function aiVisionGemini(
  dataUrl: string,
  apiKey: string,
): Promise<AiAnalysis | null> {
  const m = /^data:(image\/[^;]+);base64,(.*)$/i.exec(dataUrl);
  if (!m) return null;
  const mime = m[1]!;
  const base64 = m[2]!;

  const model = "gemini-1.5-flash-latest";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: PROMPT },
              { inline_data: { mime_type: mime, data: base64 } },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
        },
        safetySettings: [
          { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
          { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
          {
            category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
            threshold: "BLOCK_ONLY_HIGH",
          },
          {
            category: "HARM_CATEGORY_DANGEROUS_CONTENT",
            threshold: "BLOCK_ONLY_HIGH",
          },
        ],
      }),
    });
  } catch {
    return null;
  }

  if (!res.ok) {
    // eslint-disable-next-line no-console
    console.warn(
      `[imageIntel:gemini] ${res.status}: ${(await res.text()).slice(0, 200)}`,
    );
    return null;
  }

  const json = (await res.json()) as GeminiResponse;
  const txt = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  if (!txt) return null;
  return parseAiResponse(txt, "gemini", model);
}

async function aiVisionOpenRouter(
  dataUrl: string,
  apiKey: string,
): Promise<AiAnalysis | null> {
  const m = /^data:(image\/[^;]+);base64,(.*)$/i.exec(dataUrl);
  if (!m) return null;

  // OpenRouter exposes many vision models. We default to Gemini 2.0 Flash
  // (free tier) but allow the operator to override via env. The model name
  // must support OpenAI-style vision messages.
  const model =
    (process.env.OPENROUTER_VISION_MODEL ?? "google/gemini-2.0-flash-exp:free")
      .trim();

  let res: Response;
  try {
    res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        // Optional but recommended by OpenRouter — helps them attribute
        // traffic and gives us a higher rate limit on the free tier.
        "HTTP-Referer": process.env.OPENROUTER_SITE_URL ?? "https://aegis.local",
        "X-Title": "AEGIS / OwlSight",
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: 800,
        // Force JSON output where the model supports it. For free models
        // that don't, the prompt itself instructs JSON-only output.
        response_format: { type: "json_object" },
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: PROMPT },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
      }),
    });
  } catch {
    return null;
  }

  if (!res.ok) {
    // eslint-disable-next-line no-console
    console.warn(
      `[imageIntel:openrouter] ${res.status}: ${(await res.text()).slice(0, 200)}`,
    );
    return null;
  }

  const json = (await res.json()) as OpenAiCompatResponse;
  const txt = json.choices?.[0]?.message?.content ?? "";
  if (!txt) {
    if (json.error?.message) {
      // eslint-disable-next-line no-console
      console.warn(`[imageIntel:openrouter] ${json.error.message}`);
    }
    return null;
  }
  return parseAiResponse(txt, "openrouter", model);
}

/** Common JSON parser shared by both providers. */
function parseAiResponse(
  txt: string,
  provider: "gemini" | "openrouter",
  model: string,
): AiAnalysis {
  // Strip any markdown fence the model may have wrapped around the JSON.
  const cleaned = txt
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  let parsed: Partial<AiAnalysis> & { geoGuess?: AiAnalysis["geoGuess"] };
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return {
      summary: cleaned.slice(0, 600),
      scene: null,
      objects: [],
      textsFound: [],
      geoGuess: null,
      raw: txt,
      provider,
      model,
    };
  }

  return {
    summary: typeof parsed.summary === "string" ? parsed.summary : "",
    scene: typeof parsed.scene === "string" ? parsed.scene : null,
    objects: Array.isArray(parsed.objects)
      ? parsed.objects.filter((s): s is string => typeof s === "string")
      : [],
    textsFound: Array.isArray(parsed.textsFound)
      ? parsed.textsFound.filter((s): s is string => typeof s === "string")
      : [],
    geoGuess: parsed.geoGuess ?? null,
    raw: txt,
    provider,
    model,
  };
}

export function isAiConfigured(): boolean {
  return (
    !!(process.env.OPENROUTER_API_KEY ?? "").trim() ||
    !!(process.env.GEMINI_API_KEY ?? "").trim()
  );
}

// Make the active provider visible to UI labels without leaking the key.
export function aiProviderLabel(): string {
  if ((process.env.OPENROUTER_API_KEY ?? "").trim()) {
    const model =
      (process.env.OPENROUTER_VISION_MODEL ??
        "google/gemini-2.0-flash-exp:free").trim();
    return `OpenRouter · ${model}`;
  }
  if ((process.env.GEMINI_API_KEY ?? "").trim()) {
    return "Google Gemini 1.5 Flash";
  }
  return "AI offline";
}

// Re-export env so route handlers can warn the user when Gemini is missing
// without importing two modules.
export const _env = env;
