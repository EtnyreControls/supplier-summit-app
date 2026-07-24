"use client";
import * as React from "react";
import jsQR from "jsqr";

function extractToken(scanned: string) {
  try {
    return new URL(scanned).searchParams.get("t");
  } catch {
    // Not a URL — treat the raw scanned string as the token itself.
    return scanned || null;
  }
}

/**
 * In-app camera scanner for badge QR codes. Decodes frames client-side with
 * jsQR (no round-trip to a decoding service) and hands the extracted `t`
 * token to the caller, which routes it through the same handleQrScan used
 * by the /qr landing page — this is just a second way to reach that same
 * token, not a different verification path.
 *
 * Requires a secure context (HTTPS or localhost) — getUserMedia is blocked
 * by the browser on a plain-HTTP LAN address.
 */
export function BadgeScanner({ onScan }: { onScan: (token: string) => void }) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = React.useState<"starting" | "scanning" | "error">("starting");
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let stream: MediaStream | null = null;
    let rafId: number;
    let stopped = false;

    function tick() {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (stopped || !video || !canvas) return;

      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(frame.data, frame.width, frame.height);
          if (code?.data) {
            const token = extractToken(code.data);
            if (token) {
              stopped = true;
              onScan(token);
              return;
            }
          }
        }
      }
      rafId = requestAnimationFrame(tick);
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("error");
      setError("Camera access isn't available in this browser.");
      return;
    }

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" } })
      .then(async (s) => {
        if (stopped) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          await videoRef.current.play();
        }
        setStatus("scanning");
        tick();
      })
      .catch(() => {
        setStatus("error");
        setError("Camera access was blocked. Allow camera permission and make sure you're on HTTPS (or localhost).");
      });

    return () => {
      stopped = true;
      cancelAnimationFrame(rafId);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onScan]);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative aspect-square w-full max-w-xs overflow-hidden rounded-(--radius-control) bg-black">
        <video ref={videoRef} muted playsInline className="h-full w-full object-cover" />
      </div>
      <canvas ref={canvasRef} className="hidden" />
      {status === "starting" && <p className="text-sm text-grey-600">Starting camera…</p>}
      {status === "scanning" && <p className="text-sm text-grey-600">Point your camera at a badge QR</p>}
      {status === "error" && <p className="text-center text-sm text-red-600">{error}</p>}
    </div>
  );
}
