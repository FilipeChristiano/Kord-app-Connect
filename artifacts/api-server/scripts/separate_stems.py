#!/usr/bin/env python3
# ─────────────────────────────────────────────────────────────────────────────
# Separação de alta qualidade (modo "máxima qualidade") do estúdio de áudio.
#
# Roda 100% local (sem serviço externo). Usa o Demucs (htdemucs) para separar a
# faixa em VOZ e INSTRUMENTAL. Uma única passada de inferência produz os dois:
#   • vocals.wav        → "voz em destaque"
#   • instrumental.wav  → "sem voz" (soma dos demais instrumentos)
#
# Salvamos via soundfile (PCM16, estéreo, 44100 Hz) para evitar a dependência
# opcional torchcodec que a CLI do Demucs usa apenas para gravar o arquivo.
#
# Uso: separate_stems.py <input_audio> <out_dir> [segment_seconds]
# Saída (stdout): JSON {"ok": true, "sr": 44100} ou {"ok": false, "error": "..."}
# ─────────────────────────────────────────────────────────────────────────────
import json
import os
import sys


def main() -> int:
    if len(sys.argv) < 3:
        print(json.dumps({"ok": False, "error": "usage: input out_dir [segment]"}))
        return 2

    inp = sys.argv[1]
    out_dir = sys.argv[2]
    segment = float(sys.argv[3]) if len(sys.argv) > 3 else 7.0

    os.makedirs(out_dir, exist_ok=True)

    try:
        import soundfile as sf
        import torch
        from demucs.apply import apply_model
        from demucs.audio import AudioFile, convert_audio
        from demucs.pretrained import get_model

        torch.set_num_threads(max(1, os.cpu_count() or 2))

        model = get_model("htdemucs")
        model.cpu().eval()
        sr = int(model.samplerate)

        wav = AudioFile(inp).read(
            streams=0, samplerate=sr, channels=model.audio_channels
        )
        # Normalização padrão do Demucs (estabiliza a inferência).
        ref = wav.mean(0)
        mean = ref.mean()
        std = ref.std() + 1e-8
        wav = (wav - mean) / std

        with torch.no_grad():
            sources = apply_model(
                model,
                wav[None],
                device="cpu",
                segment=segment,
                overlap=0.25,
                split=True,
                progress=False,
            )[0]
        sources = sources * std + mean

        names = list(model.sources)  # ex.: ['drums','bass','other','vocals']
        vidx = names.index("vocals")
        vocals = sources[vidx]
        instrumental = None
        for i, _name in enumerate(names):
            if i == vidx:
                continue
            instrumental = sources[i] if instrumental is None else instrumental + sources[i]
        if instrumental is None:
            instrumental = vocals * 0.0

        def to_np(t):
            # Demucs: [channels, samples] → soundfile espera [samples, channels].
            return t.transpose(0, 1).contiguous().cpu().numpy()

        sf.write(os.path.join(out_dir, "vocals.wav"), to_np(vocals), sr, subtype="PCM_16")
        sf.write(
            os.path.join(out_dir, "instrumental.wav"),
            to_np(instrumental),
            sr,
            subtype="PCM_16",
        )

        print(json.dumps({"ok": True, "sr": sr}))
        return 0
    except Exception as exc:  # noqa: BLE001
        print(json.dumps({"ok": False, "error": str(exc)[:500]}))
        return 1


if __name__ == "__main__":
    sys.exit(main())
