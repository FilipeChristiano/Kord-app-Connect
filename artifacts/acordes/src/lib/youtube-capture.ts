// Captura o áudio do player oficial do YouTube incorporado na própria página
// (não baixa nada no servidor — toca normalmente, com a sessão/IP de quem
// está usando o app, e grava o som da aba). Exige autorização explícita do
// navegador (seletor "compartilhar esta aba" com áudio) e só funciona em
// navegadores desktop com suporte a captura de aba (Chrome/Edge).

export interface YoutubeCaptureResult {
  ok: boolean;
  blob?: Blob;
  reason?: "unsupported" | "cancelled" | "error";
}

export function isYoutubeCaptureSupported(): boolean {
  return typeof navigator !== "undefined" && !!navigator.mediaDevices?.getDisplayMedia;
}

function postCommand(iframe: HTMLIFrameElement, func: string) {
  iframe.contentWindow?.postMessage(JSON.stringify({ event: "command", func, args: [] }), "*");
}

export function captureYoutubeAudio(
  iframe: HTMLIFrameElement,
  opts: { maxDurationMs?: number } = {},
): Promise<YoutubeCaptureResult> {
  return new Promise((resolve) => {
    if (!isYoutubeCaptureSupported()) {
      resolve({ ok: false, reason: "unsupported" });
      return;
    }

    let settled = false;
    let safetyTimer: number | null = null;

    const onMessage = (e: MessageEvent) => {
      if (typeof e.data !== "string") return;
      let data: { event?: string; info?: { playerState?: number } };
      try {
        data = JSON.parse(e.data);
      } catch {
        return;
      }
      // playerState 0 = vídeo terminou (API do IFrame Player do YouTube).
      if (data.event === "infoDelivery" && data.info?.playerState === 0) {
        stopCapture();
      }
    };
    window.addEventListener("message", onMessage);

    const finish = (result: YoutubeCaptureResult) => {
      if (settled) return;
      settled = true;
      window.removeEventListener("message", onMessage);
      if (safetyTimer !== null) window.clearTimeout(safetyTimer);
      resolve(result);
    };

    let recorder: MediaRecorder | null = null;

    function stopCapture() {
      if (recorder && recorder.state !== "inactive") recorder.stop();
    }

    safetyTimer = window.setTimeout(stopCapture, opts.maxDurationMs ?? 10 * 60 * 1000);

    navigator.mediaDevices
      .getDisplayMedia({ video: true, audio: true })
      .then((stream) => {
        const audioTracks = stream.getAudioTracks();
        if (audioTracks.length === 0) {
          stream.getTracks().forEach((t) => t.stop());
          finish({ ok: false, reason: "error" });
          return;
        }
        const audioOnly = new MediaStream(audioTracks);
        const chunks: BlobPart[] = [];
        recorder = new MediaRecorder(audioOnly);
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data);
        };
        recorder.onstop = () => {
          stream.getTracks().forEach((t) => t.stop());
          const blob = new Blob(chunks, { type: chunks[0] instanceof Blob ? (chunks[0] as Blob).type : "audio/webm" });
          if (blob.size === 0) {
            finish({ ok: false, reason: "error" });
            return;
          }
          finish({ ok: true, blob });
        };
        // Se a pessoa parar o compartilhamento manualmente (botão do navegador).
        stream.getVideoTracks()[0]?.addEventListener("ended", stopCapture);

        recorder.start();
        postCommand(iframe, "playVideo");
      })
      .catch(() => {
        finish({ ok: false, reason: "cancelled" });
      });
  });
}
