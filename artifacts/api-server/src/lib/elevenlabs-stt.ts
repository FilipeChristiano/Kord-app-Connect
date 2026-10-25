// ─────────────────────────────────────────────────────────────────────────────
// ElevenLabs Scribe (speech-to-text) via API direta (ELEVENLABS_API_KEY).
//
// Diferente do gpt-4o-transcribe (que devolve só o texto), o Scribe devolve
// timestamps por PALAVRA. Isso permite posicionar os acordes sobre a sílaba
// certa da letra — alinhamento preciso, não estimado.
// ─────────────────────────────────────────────────────────────────────────────

const ELEVENLABS_BASE_URL = "https://api.elevenlabs.io";

export interface ScribeWord {
  text: string;
  start: number;
  end: number;
}

export interface ScribeResult {
  language?: string;
  text: string;
  words: ScribeWord[];
}

export function isElevenLabsConfigured(): boolean {
  return Boolean(process.env.ELEVENLABS_API_KEY);
}

interface ScribeApiWord {
  text?: string;
  start?: number;
  end?: number;
  type?: string;
}

interface ScribeApiResponse {
  language_code?: string;
  text?: string;
  words?: ScribeApiWord[];
}

// Envia o áudio ao Scribe e devolve o texto + palavras com tempo (em segundos).
export async function transcribeWithElevenLabs(
  audio: Buffer,
  filename: string,
  contentType: string,
): Promise<ScribeResult> {
  const form = new FormData();
  const blob = new Blob([new Uint8Array(audio)], { type: contentType });
  form.append("file", blob, filename);
  form.append("model_id", "scribe_v1");
  form.append("timestamps_granularity", "word");
  form.append("diarize", "false");
  form.append("tag_audio_events", "false");

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error("ELEVENLABS_API_KEY não configurada");
  }

  const res = await fetch(`${ELEVENLABS_BASE_URL}/v1/speech-to-text`, {
    method: "POST",
    headers: { "xi-api-key": apiKey },
    body: form,
    signal: AbortSignal.timeout(5 * 60 * 1000),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    const err = new Error(`ElevenLabs STT ${res.status}: ${detail}`) as Error & {
      status?: number;
    };
    err.status = res.status;
    throw err;
  }

  const data = (await res.json()) as ScribeApiResponse;
  const words: ScribeWord[] = (data.words ?? [])
    .filter(
      (w): w is Required<Pick<ScribeApiWord, "start" | "end">> & ScribeApiWord =>
        (w.type ?? "word") === "word" &&
        typeof w.start === "number" &&
        typeof w.end === "number" &&
        typeof w.text === "string" &&
        w.text.trim().length > 0,
    )
    .map((w) => ({ text: (w.text ?? "").trim(), start: w.start, end: w.end }));

  return { language: data.language_code, text: (data.text ?? "").trim(), words };
}
