import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, ScanLine, Upload, RotateCcw } from 'lucide-react';
import { verifyEmployee } from '../api/client';

const VERIFY_STAGES = [
  'Uploading document…',
  'Analyzing document…',
  'Checking NIET identity card…',
  'Comparing with reference template…',
  'Finalizing verification…',
];

function mapCameraError(err) {
  const name = err?.name || '';
  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return 'Camera access was denied. Please allow camera permissions in your browser settings to scan your ID.';
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return 'No camera device was detected. Please connect a camera or use "Upload photo instead" below.';
    case 'NotReadableError':
    case 'TrackStartError':
      return 'Camera is in use by another application or tab. Please close other camera apps and click Try Again.';
    case 'OverconstrainedError':
    case 'ConstraintNotSatisfiedError':
      return 'Requested camera settings could not be satisfied. Retrying with basic video settings…';
    case 'SecurityError':
      return 'Camera access was blocked by browser security policy. Please ensure the page is served over HTTPS or localhost.';
    case 'AbortError':
      return 'Camera initialization was aborted. Please click Try Again.';
    default:
      return err?.message
        ? `Camera access error (${err.message}). Please use "Upload photo instead" below.`
        : 'Camera could not be started. Please check permissions or use "Upload photo instead" below.';
  }
}

export default function IDScanner({ name, email, adminPassword, onVerified, onCancel }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const activeRef = useRef(true);
  const isVerifyingRef = useRef(false);
  const stageTimerRef = useRef(null);
  const fileInputRef = useRef(null);

  // Camera states: 'CAMERA_STARTING' | 'CAMERA_READY' | 'CAMERA_ERROR'
  const [cameraStatus, setCameraStatus] = useState('CAMERA_STARTING');
  const [cameraError, setCameraError] = useState(null);

  // Workflow phases: 'idle' | 'uploading' | 'verifying' | 'success' | 'rejected' | 'error'
  const [phase, setPhase] = useState('idle');
  const [stageIndex, setStageIndex] = useState(0);
  const [reason, setReason] = useState(null);
  const [capturedPreview, setCapturedPreview] = useState(null);

  useEffect(() => {
    activeRef.current = true;
    startCamera();
    return () => {
      activeRef.current = false;
      clearInterval(stageTimerRef.current);
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function stopCamera() {
    if (streamRef.current) {
      try {
        streamRef.current.getTracks().forEach((track) => {
          track.stop();
        });
      } catch (err) {
        console.warn('[IDScanner] stopCamera error:', err);
      }
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }

  async function startCamera() {
    // Stop and detach any existing stream before requesting a new one
    stopCamera();
    setCameraStatus('CAMERA_STARTING');
    setCameraError(null);

    let stream = null;
    try {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
      } catch (firstErr) {
        // Fallback to basic video without resolution/facingMode constraints
        if (
          firstErr.name === 'OverconstrainedError' ||
          firstErr.name === 'ConstraintNotSatisfiedError' ||
          firstErr.name === 'NotFoundError'
        ) {
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        } else {
          throw firstErr;
        }
      }

      if (!activeRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
        } catch (playErr) {
          console.warn('[IDScanner] video.play() notice:', playErr);
        }
      }
      setCameraStatus('CAMERA_READY');
    } catch (err) {
      if (!activeRef.current) return;
      stopCamera();
      const mappedMsg = mapCameraError(err);
      setCameraError(mappedMsg);
      setCameraStatus('CAMERA_ERROR');
    }
  }

  function startStageProgress() {
    setStageIndex(0);
    clearInterval(stageTimerRef.current);
    stageTimerRef.current = setInterval(() => {
      setStageIndex((prev) => (prev < VERIFY_STAGES.length - 1 ? prev + 1 : prev));
    }, 400);
  }

  function stopStageProgress() {
    clearInterval(stageTimerRef.current);
  }

  function drawGuideRegionToCanvas() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return null;

    const vw = video.videoWidth || 640;
    const vh = video.videoHeight || 480;

    canvas.width = vw;
    canvas.height = vh;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, vw, vh);
    return canvas;
  }

  async function processVerification(file, previewUrl = null) {
    // Ensure only one verification request can be in-flight at any time
    if (isVerifyingRef.current) return;
    isVerifyingRef.current = true;
    setReason(null);
    setCapturedPreview(previewUrl);

    setPhase('uploading');
    startStageProgress();
    setPhase('verifying');

    try {
      const res = await verifyEmployee({
        file,
        employeeName: name,
        employeeEmail: email,
        adminPassword,
      });

      if (!activeRef.current) return;
      stopStageProgress();

      if (res.data && res.data.verified) {
        setPhase('success');
        stopCamera();
        setTimeout(() => {
          if (activeRef.current) {
            onVerified(res.data);
          }
        }, 1200);
      } else {
        const failReason =
          res.data?.reason ||
          'Verification failed. This document does not match the valid NIET ID card reference.';
        setReason(failReason);
        setPhase('rejected');
      }
    } catch (err) {
      if (!activeRef.current) return;
      stopStageProgress();
      const isTimeout = /timeout|timed out/i.test(err.message || '');
      const errMsg = isTimeout
        ? 'Verification timed out. Please try again.'
        : err.message || 'Verification could not be completed. Please try again.';
      setReason(errMsg);
      setPhase('error');
    } finally {
      isVerifyingRef.current = false;
    }
  }

  function handleCapture() {
    if (isVerifyingRef.current || phase === 'uploading' || phase === 'verifying') return;

    const canvas = drawGuideRegionToCanvas();
    if (!canvas) {
      setReason('Unable to capture camera frame. Please ensure camera is ready or use file upload.');
      setPhase('error');
      return;
    }

    const previewUrl = canvas.toDataURL('image/jpeg', 0.85);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setReason('Failed to capture image. Please try again.');
          setPhase('error');
          return;
        }
        const file = new File([blob], 'id-capture.jpg', { type: 'image/jpeg' });
        processVerification(file, previewUrl);
      },
      'image/jpeg',
      0.92
    );
  }

  function handleFileUpload(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (isVerifyingRef.current || phase === 'uploading' || phase === 'verifying') return;

    const previewUrl = URL.createObjectURL(file);
    processVerification(file, previewUrl);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleRetry() {
    isVerifyingRef.current = false;
    setPhase('idle');
    setReason(null);
    setCapturedPreview(null);
    // Fresh stream requested for retry session
    await startCamera();
  }

  const isBusy = phase === 'uploading' || phase === 'verifying';
  const showVideo = cameraStatus === 'CAMERA_READY';

  return (
    <div className="space-y-3.5">
      <div className="relative rounded-xl overflow-hidden border border-border bg-ink-inset aspect-video shadow-xs">
        {/* Camera starting spinner */}
        {cameraStatus === 'CAMERA_STARTING' && !capturedPreview && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 text-xs text-muted z-10 bg-ink-inset">
            <span className="w-6 h-6 border-2 border-amber/40 border-t-amber rounded-full animate-spin" />
            <span>Initializing camera…</span>
          </div>
        )}

        {/* Camera error state */}
        {cameraStatus === 'CAMERA_ERROR' && !capturedPreview && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-xs text-alert p-5 text-center gap-2.5 z-10 bg-ink-inset">
            <AlertTriangle className="w-6 h-6 text-amber" />
            <span className="leading-relaxed max-w-sm">{cameraError}</span>
            <button
              type="button"
              onClick={startCamera}
              className="mt-1 bg-amber/20 hover:bg-amber/30 text-amber font-semibold px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer"
            >
              Retry Camera Access
            </button>
          </div>
        )}

        {/* Captured Preview Overlay (rendered on top without unmounting video element) */}
        {capturedPreview && phase !== 'idle' && (
          <img
            src={capturedPreview}
            alt="Captured ID"
            className="absolute inset-0 w-full h-full object-contain bg-ink-inset z-10"
          />
        )}

        {/* Permanent Video Element (never unmounted to avoid stale ref and detached srcObject) */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-contain ${showVideo ? 'opacity-100' : 'opacity-0'}`}
        />

        {/* Scanning Guide Overlay */}
        {phase !== 'success' && cameraStatus === 'CAMERA_READY' && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
            <div className="relative w-[85%] h-[75%]">
              {[
                'top-0 left-0 border-t-2 border-l-2',
                'top-0 right-0 border-t-2 border-r-2',
                'bottom-0 left-0 border-b-2 border-l-2',
                'bottom-0 right-0 border-b-2 border-r-2',
              ].map((cls, i) => (
                <div
                  key={i}
                  className={`absolute ${cls} w-7 h-7 rounded-sm transition-all duration-200 ${
                    phase === 'rejected' || phase === 'error'
                      ? 'border-alert'
                      : isBusy
                      ? 'border-amber scale-98'
                      : 'border-amber/80'
                  }`}
                />
              ))}

              {phase === 'idle' && (
                <div className="absolute left-0 right-0 h-0.5 bg-amber/80 shadow-[0_0_12px_2px_rgba(217,119,6,0.6)] scanline" />
              )}

              {isBusy && (
                <div className="absolute inset-0 border-2 border-amber rounded-md bg-amber/10 lock-pulse" />
              )}
            </div>
          </div>
        )}

        {/* Status Pills */}
        <div className="absolute bottom-2.5 left-0 right-0 flex justify-center px-4 z-20">
          {phase === 'idle' && cameraStatus === 'CAMERA_READY' && (
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-paper bg-ink/80 px-3 py-1 rounded-full backdrop-blur-xs border border-border">
              <ScanLine className="w-3 h-3 text-amber" />
              Align NIET ID card inside frame
            </span>
          )}

          {isBusy && (
            <span className="flex items-center gap-2 text-[11px] font-semibold text-paper bg-ink/90 px-3 py-1.5 rounded-full backdrop-blur-xs border border-amber/30 shadow-md">
              <span className="w-2.5 h-2.5 border-2 border-amber/40 border-t-amber rounded-full animate-spin" />
              {VERIFY_STAGES[stageIndex] || 'Verifying ID…'}
            </span>
          )}

          {phase === 'rejected' && (
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-alert bg-ink/90 px-3 py-1.5 rounded-full backdrop-blur-xs border border-alert/30 shadow-md">
              <XCircle className="w-3.5 h-3.5" />
              Verification Rejected
            </span>
          )}

          {phase === 'error' && (
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-alert bg-ink/90 px-3 py-1.5 rounded-full backdrop-blur-xs border border-alert/30 shadow-md">
              <AlertTriangle className="w-3.5 h-3.5 text-alert" />
              Verification Error
            </span>
          )}
        </div>

        {/* Success Screen */}
        {phase === 'success' && (
          <div className="absolute inset-0 bg-ink/95 flex flex-col items-center justify-center gap-2.5 z-30">
            <CheckCircle2 className="w-12 h-12 text-verified pop-in" />
            <span className="text-sm font-bold text-verified">NIET ID Verified</span>
            <span className="text-xs text-muted">Access Granted</span>
          </div>
        )}

        <canvas ref={canvasRef} className="hidden" />
      </div>

      {/* Explanatory Rejection / Error Message */}
      {reason && (phase === 'rejected' || phase === 'error') && (
        <div className="text-xs text-alert bg-alert-dim border border-alert/30 rounded-lg p-3 text-center leading-relaxed">
          {reason}
        </div>
      )}

      {/* Action Controls */}
      {phase !== 'success' && (
        <div className="space-y-2">
          {phase === 'idle' && (
            <>
              <button
                type="button"
                id="btn-capture-verify"
                disabled={isBusy || cameraStatus !== 'CAMERA_READY'}
                onClick={handleCapture}
                className="w-full bg-amber text-ink font-bold px-4 py-2.5 rounded-lg text-xs hover:bg-amber-light disabled:opacity-50 transition-all cursor-pointer shadow-xs flex items-center justify-center gap-1.5"
              >
                <ScanLine className="w-3.5 h-3.5" /> Capture & Verify ID
              </button>

              <button
                type="button"
                id="btn-upload-photo"
                disabled={isBusy}
                onClick={() => fileInputRef.current && fileInputRef.current.click()}
                className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-amber hover:text-amber-light disabled:opacity-50 cursor-pointer py-1.5 transition-colors"
              >
                <Upload className="w-3.5 h-3.5" /> Upload photo instead
              </button>
            </>
          )}

          {isBusy && (
            <button
              type="button"
              disabled
              className="w-full bg-ink-inset border border-border text-muted font-semibold px-4 py-2.5 rounded-lg text-xs flex items-center justify-center gap-2 cursor-not-allowed"
            >
              <span className="w-3 h-3 border-2 border-amber/40 border-t-amber rounded-full animate-spin" />
              {VERIFY_STAGES[stageIndex] || 'Processing…'}
            </button>
          )}

          {(phase === 'rejected' || phase === 'error') && (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                id="btn-retry-verify"
                onClick={handleRetry}
                className="w-full bg-amber text-ink font-bold px-3 py-2 rounded-lg text-xs hover:bg-amber-light transition-all cursor-pointer shadow-xs flex items-center justify-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Try Again
              </button>

              <button
                type="button"
                id="btn-retry-upload"
                onClick={() => fileInputRef.current && fileInputRef.current.click()}
                className="w-full bg-ink-inset text-paper border border-border font-semibold px-3 py-2 rounded-lg text-xs hover:bg-ink transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Upload className="w-3.5 h-3.5 text-amber" /> Upload Other
              </button>
            </div>
          )}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileUpload}
      />

      <button
        type="button"
        id="btn-cancel-verify"
        disabled={isBusy}
        onClick={onCancel}
        className="w-full bg-ink-inset text-paper font-semibold px-4 py-2 rounded-lg text-xs border border-border hover:bg-ink disabled:opacity-50 transition-colors cursor-pointer"
      >
        Cancel
      </button>
    </div>
  );
}
