import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from '../i18n';
import { hapticLight } from '../utils/haptic';

const isNative = typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform?.();

const COOLDOWN_MS = 1000;
const WEB_SCAN_INTERVAL = 120;
const CONFIRM_READS = 3; // web: require N consecutive matching reads

// Pre-cache MLKit module
let _mlkitMod = null;
const getMLKit = async () => {
  if (!_mlkitMod) {
    _mlkitMod = await import('@capacitor-mlkit/barcode-scanning');
  }
  return _mlkitMod;
};

const NATIVE_FORMATS = ['EAN_13', 'EAN_8', 'CODE_128', 'CODE_39', 'CODE_93', 'QR_CODE', 'UPC_A', 'UPC_E'];

// Pre-warm MLKit on native
if (isNative) { getMLKit().catch(() => {}); }

// ─── Check digit validation for EAN / UPC barcodes ──────────────────
function validateCheckDigit(code) {
  if (!/^\d+$/.test(code)) return true; // non-numeric (QR, etc.) — accept
  const len = code.length;
  if (len !== 8 && len !== 12 && len !== 13) return true; // not EAN/UPC — accept

  let sum = 0;
  for (let i = 0; i < len - 1; i++) {
    const d = +code[i];
    if (len === 13) {
      sum += d * (i % 2 === 0 ? 1 : 3);
    } else {
      sum += d * (i % 2 === 0 ? 3 : 1);
    }
  }
  const check = (10 - (sum % 10)) % 10;
  return check === +code[len - 1];
}

export default function BarcodeScanner({ isOpen, onScan, onClose }) {
  const { t } = useTranslation();
  const [error, setError] = useState('');
  const [scanCount, setScanCount] = useState(0);
  const [lastCode, setLastCode] = useState('');
  const activeRef = useRef(false);
  const lastCodeRef = useRef('');
  const lastTimeRef = useRef(0);
  const closedRef = useRef(false);
  const readBufferRef = useRef([]);

  // Deduplicate scans — same barcode within COOLDOWN_MS is ignored
  const shouldProcess = useCallback((code) => {
    if (!code || code.length < 3) return false;
    const now = Date.now();
    if (code === lastCodeRef.current && now - lastTimeRef.current < COOLDOWN_MS) {
      return false;
    }
    lastCodeRef.current = code;
    lastTimeRef.current = now;
    return true;
  }, []);

  const handleDetection = useCallback((code) => {
    if (!shouldProcess(code)) return;
    hapticLight();
    setLastCode(code);
    setScanCount((c) => c + 1);
    onScan(code);
  }, [onScan, shouldProcess]);

  // Multi-read confirmation for web scanner
  const confirmRead = useCallback((code) => {
    if (!code || code.length < 3) return null;
    if (!validateCheckDigit(code)) return null;

    const buf = readBufferRef.current;
    buf.push(code);
    if (buf.length > 20) buf.shift();

    if (buf.length >= CONFIRM_READS) {
      const recent = buf.slice(-CONFIRM_READS);
      if (recent.every((c) => c === code)) {
        buf.length = 0;
        return code;
      }
    }
    return null;
  }, []);

  // ─── Native ML Kit scanner (modal scan() with auto-retry) ─────────
  const startNativeLoop = useCallback(async () => {
    let BarcodeScanning;
    try {
      const mod = await getMLKit();
      BarcodeScanning = mod.BarcodeScanner;
    } catch {
      setError('Barcode scanner not available');
      return;
    }

    try {
      const permResult = await BarcodeScanning.requestPermissions();
      if (permResult.camera !== 'granted') {
        setError(t('camera_permission_denied') || 'Camera permission denied');
        return;
      }
    } catch (err) {
      setError(err?.message || 'Permission error');
      return;
    }

    activeRef.current = true;
    closedRef.current = false;

    // Try to enable torch automatically
    try { await BarcodeScanning.enableTorch(); } catch {}

    // MLKit handles barcode validation internally — accept whatever it returns
    try {
      const result = await BarcodeScanning.scan({ formats: NATIVE_FORMATS });
      console.log('MLKit scan result:', JSON.stringify(result));
      if (result.barcodes && result.barcodes.length > 0) {
        const barcode = result.barcodes[0];
        const code = barcode.rawValue || barcode.displayValue || barcode.value || '';
        console.log('Barcode detected:', code, 'format:', barcode.format, 'all keys:', Object.keys(barcode));
        if (code && code.length >= 3) {
          handleDetection(code);
        }
      }
    } catch (err) {
      console.error('Native scan error:', err?.message, err?.code, JSON.stringify(err));
      if (err?.message !== 'scan canceled' && err?.code !== 'SCAN_CANCELED') {
        setError(`Scan error: ${err?.message || 'Unknown'}`);
      }
    }

    activeRef.current = false;
    onClose();
  }, [handleDetection, onClose, t]);

  const stopNativeScan = useCallback(async () => {
    closedRef.current = true;
    activeRef.current = false;
    try {
      const mod = await getMLKit();
      await mod.BarcodeScanner.stopScan();
    } catch {}
  }, []);

  // ─── Web fallback (getUserMedia + BarcodeDetector) ────────────────
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const detectorRef = useRef(null);
  const scanningRef = useRef(false);
  const scanTimerRef = useRef(null);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);

  const stopWebCamera = useCallback(() => {
    scanningRef.current = false;
    clearTimeout(scanTimerRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const webScanLoop = useCallback(() => {
    if (!scanningRef.current) return;
    const video = videoRef.current;
    const detector = detectorRef.current;
    if (video && detector && video.readyState >= 2) {
      detector
        .detect(video)
        .then((codes) => {
          if (codes.length > 0) {
            const confirmed = confirmRead(codes[0].rawValue);
            if (confirmed) {
              handleDetection(confirmed);
            }
          }
          if (scanningRef.current) {
            scanTimerRef.current = setTimeout(webScanLoop, WEB_SCAN_INTERVAL);
          }
        })
        .catch(() => {
          if (scanningRef.current) {
            scanTimerRef.current = setTimeout(webScanLoop, WEB_SCAN_INTERVAL);
          }
        });
    } else {
      if (scanningRef.current) requestAnimationFrame(webScanLoop);
    }
  }, [handleDetection, confirmRead]);

  const startWebCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          focusMode: { ideal: 'continuous' },
          exposureMode: { ideal: 'continuous' },
          whiteBalanceMode: { ideal: 'continuous' },
        },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      const track = stream.getVideoTracks()[0];
      const caps = track.getCapabilities?.();
      const hasTorch = !!caps?.torch;
      if (hasTorch) setTorchSupported(true);

      try {
        const advConstraints = {};
        if (caps?.focusMode?.includes('continuous')) advConstraints.focusMode = 'continuous';
        if (caps?.exposureMode?.includes('continuous')) advConstraints.exposureMode = 'continuous';
        // Auto-enable torch for better barcode readability
        if (hasTorch) advConstraints.torch = true;
        if (Object.keys(advConstraints).length > 0) {
          await track.applyConstraints({ advanced: [advConstraints] });
          if (hasTorch) setTorchOn(true);
        }
      } catch {}

      if ('BarcodeDetector' in window) {
        detectorRef.current = new BarcodeDetector({
          formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'code_93', 'qr_code', 'upc_a', 'upc_e'],
        });
      }
      readBufferRef.current = [];
      scanningRef.current = true;
      webScanLoop();
    } catch (err) {
      console.error('Camera access failed:', err);
      setError(err?.message || 'Camera access failed');
    }
  }, [webScanLoop]);

  const toggleTorch = useCallback(async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({ advanced: [{ torch: next }] });
      setTorchOn(next);
    } catch {}
  }, [torchOn]);

  // ─── Lifecycle ────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    setError('');
    setScanCount(0);
    setLastCode('');
    lastCodeRef.current = '';
    lastTimeRef.current = 0;
    readBufferRef.current = [];

    if (isNative) {
      startNativeLoop();
      return () => { stopNativeScan(); };
    } else {
      startWebCamera();
      return () => { stopWebCamera(); setTorchOn(false); };
    }
  }, [isOpen, startNativeLoop, stopNativeScan, startWebCamera, stopWebCamera]);

  if (!isOpen) return null;

  // Native: MLKit opens its own camera UI (with built-in torch, focus, etc.)
  if (isNative) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
        {error ? (
          <div className="text-center p-6">
            <p className="text-red-400 text-sm mb-4">{error}</p>
            <button onClick={onClose} className="px-6 py-2 rounded-lg bg-white/20 text-white font-bold">
              {t('close') || 'Close'}
            </button>
          </div>
        ) : (
          <div className="text-center">
            <div className="animate-spin w-8 h-8 border-4 border-white/30 border-t-white rounded-full mx-auto mb-3" />
            <p className="text-white/70 text-sm">{t('opening_camera') || 'Opening camera...'}</p>
            {scanCount > 0 && (
              <p className="text-green-400 text-sm mt-2 font-bold">{scanCount} {t('scanned') || 'scanned'}</p>
            )}
          </div>
        )}
      </div>
    );
  }

  // Web: video feed with continuous scan + overlay
  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" playsInline muted autoPlay />

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
          <div className="text-center p-6">
            <p className="text-red-400 text-sm mb-4">{error}</p>
            <button onClick={onClose} className="px-6 py-2 rounded-lg bg-white/20 text-white font-bold">
              {t('close') || 'Close'}
            </button>
          </div>
        </div>
      )}

      {/* Scan guide */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-72 h-44 border-2 border-white/70 rounded-xl relative">
          <div className="absolute -top-0.5 -left-0.5 w-6 h-6 border-t-4 border-l-4 border-green-400 rounded-tl-lg" />
          <div className="absolute -top-0.5 -right-0.5 w-6 h-6 border-t-4 border-r-4 border-green-400 rounded-tr-lg" />
          <div className="absolute -bottom-0.5 -left-0.5 w-6 h-6 border-b-4 border-l-4 border-green-400 rounded-bl-lg" />
          <div className="absolute -bottom-0.5 -right-0.5 w-6 h-6 border-b-4 border-r-4 border-green-400 rounded-br-lg" />
          <div className="absolute left-2 right-2 top-1/2 h-0.5 bg-green-400/60 animate-pulse" />
        </div>
      </div>

      {/* Last scanned badge */}
      {lastCode && (
        <div className="absolute top-16 left-0 right-0 flex justify-center pointer-events-none">
          <div
            className="bg-green-500/90 text-white px-4 py-1.5 rounded-full text-sm font-bold shadow-lg"
            style={{ animation: 'scaleIn 0.2s ease-out' }}
          >
            {lastCode} ({scanCount})
          </div>
        </div>
      )}

      {/* Bottom hint */}
      <div className="absolute bottom-20 left-0 right-0 text-center">
        <p className="text-white/80 text-sm">{t('continuous_scan_hint') || 'Keep scanning — items add automatically'}</p>
      </div>

      {/* Controls: torch + close */}
      <div className="absolute top-4 right-4 flex gap-3">
        {torchSupported && (
          <button
            onClick={toggleTorch}
            className={`w-10 h-10 rounded-full flex items-center justify-center ${
              torchOn ? 'bg-yellow-400 text-black' : 'bg-black/50 text-white'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </button>
        )}
        <button
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Scan count badge */}
      {scanCount > 0 && (
        <div className="absolute top-4 left-4">
          <div className="bg-green-500 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shadow-lg">
            {scanCount}
          </div>
        </div>
      )}
    </div>
  );
}
