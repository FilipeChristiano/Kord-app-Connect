import { ReplitConnectors } from "@replit/connectors-sdk";
import { writeFileSync } from "node:fs";

async function main() {
  const client = new ReplitConnectors();
  const pfetch = client.createProxyFetch("elevenlabs");

  const voicesRes = await pfetch("/v1/voices", { method: "GET" });
  if (!voicesRes.ok) throw new Error(`voices: ${voicesRes.status} ${await voicesRes.text()}`);
  const voices = (await voicesRes.json()) as { voices: { voice_id: string; name: string; labels?: Record<string, string> }[] };
  const preferred =
    voices.voices.find((v) => /matilda|sarah|alice|jessica|laura/i.test(v.name)) ?? voices.voices[0];
  console.log("voz escolhida:", preferred.name, preferred.voice_id);

  const res = await pfetch(`/v1/text-to-speech/${preferred.voice_id}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: "Santo... santo pra sempre... Tu és santo, Senhor...",
      model_id: "eleven_multilingual_v2",
      voice_settings: { stability: 0.35, similarity_boost: 0.8, style: 0.6, speed: 0.8 },
    }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`tts: ${res.status} ${await res.text()}`);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync("/tmp/landing-voice.mp3", buf);
  console.log("ok /tmp/landing-voice.mp3", buf.length, "bytes");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
