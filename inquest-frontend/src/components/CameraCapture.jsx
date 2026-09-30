import { useEffect, useRef, useState } from 'react';
import { Camera, RotateCcw } from 'lucide-react';

export default function CameraCapture({ onCapture, capturedFile }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [cameraError, setCameraError] = useState(null);

  useEffect(() => {
    if (!capturedFile) {
      startCamera();
    }
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startCamera() {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) {
      setCameraError('Camera access denied or unavailable. Please allow camera permission.');
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  function handleCapture() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);

    canvas.toBlob((blob) => {
      const file = new File([blob], 'id-card-scan.jpg', { type: 'image/jpeg' });
      setPreviewUrl(URL.createObjectURL(blob));
      onCapture(file);
      stopCamera();
    }, 'image/jpeg', 0.9);
  }

  function handleRetake() {
    setPreviewUrl(null);
    onCapture(null);
    startCamera();
  }

  return (
    <div className="space-y-2.5">
      <label className="block text-xs font-bold text-muted uppercase tracking-wider">
        Scan ID Card
      </label>

      <div className="relative rounded-xl overflow-hidden border border-border-strong bg-ink aspect-video">
        {previewUrl ? (
          <img src={previewUrl} alt="Captured ID" className="w-full h-full object-contain" />
        ) : cameraError ? (
          <div className="flex items-center justify-center h-full text-xs text-alert p-4 text-center">
            {cameraError}
          </div>
        ) : (
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
        )}
        <canvas ref={canvasRef} className="hidden" />
      </div>

      <div className="flex gap-2.5">
        {previewUrl ? (
          <button
            type="button"
            onClick={handleRetake}
            className="flex-1 flex items-center justify-center gap-2 bg-ink-lighter text-paper font-semibold px-4 py-2.5 rounded-lg text-sm border border-border-strong hover:bg-ink transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" /> Retake
          </button>
        ) : (
          <button
            type="button"
            onClick={handleCapture}
            disabled={!!cameraError}
            className="flex-1 flex items-center justify-center gap-2 bg-amber text-ink font-bold px-4 py-2.5 rounded-lg text-sm disabled:opacity-50 hover:bg-amber-light transition-colors cursor-pointer"
          >
            <Camera className="w-4 h-4" /> Capture ID Card
          </button>
        )}
      </div>
    </div>
  );
}
