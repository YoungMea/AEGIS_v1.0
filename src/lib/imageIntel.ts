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
/* AI Vision (Google Gemini)                                          */
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

export async function aiVision(dataUrl: string): Promise<AiAnalysis | null> {
  const apiKey = (process.env.GEMINI_API_KEY ?? "").trim();
  if (!apiKey) return null;

  const m = /^data:(image\/[^;]+);base64,(.*)$/i.exec(dataUrl);
  if (!m) return null;
  const mime = m[1]!;
  const base64 = m[2]!;

  // Gemini 1.5 flash is the cheapest, supports vision and is on the free tier.
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;

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
  };
}

export function isAiConfigured(): boolean {
  return !!(process.env.GEMINI_API_KEY ?? "").trim();
}

// Make the env-derived API name available to humans without leaking secrets.
export function aiProviderLabel(): string {
  return "Google Gemini 1.5 Flash";
}

// Re-export env so route handlers can warn the user when Gemini is missing
// without importing two modules.
export const _env = env;
