import { useState, useEffect, useRef, useCallback } from 'react';
import { playBeep } from '../utils/sound';

const HID_THRESHOLD = 50; // ms between keypresses to detect scanner

export function useBarcode({ onScan } = {}) {
  const [scannedCode, setScannedCode] = useState('');
  const [mode, setMode] = useState('hid'); // 'hid' | 'camera' | 'manual'
  const [isScanning, setIsScanning] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const inputRef = useRef(null);
  const bufferRef = useRef('');
  const lastKeyTime = useRef(0);
  const timerRef = useRef(null);
  const onScanRef = useRef(onScan);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  const handleScan = useCallback((code) => {
    setScannedCode(code);
    playBeep();
    if (onScanRef.current) onScanRef.current(code);
  }, []);

  // HID scanner detection
  useEffect(() => {
    if (mode !== 'hid') return;

    const handleKeyDown = (e) => {
      if (isCameraOpen) return;
      if (e.target.tagName === 'INPUT' && e.target !== inputRef.current) return;

      const now = Date.now();
      const elapsed = now - lastKeyTime.current;

      if (e.key === 'Enter' && bufferRef.current.length >= 3) {
        e.preventDefault();
        const code = bufferRef.current;
        bufferRef.current = '';
        setIsScanning(false);
        handleScan(code);
        setTimeout(() => inputRef.current?.focus(), 50);
        return;
      }

      if (e.key.length === 1) {
        if (elapsed < HID_THRESHOLD || bufferRef.current.length === 0) {
          bufferRef.current += e.key;
          setIsScanning(true);
        } else {
          bufferRef.current = e.key;
        }
        lastKeyTime.current = now;

        clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          bufferRef.current = '';
          setIsScanning(false);
        }, 300);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(timerRef.current);
    };
  }, [mode, isCameraOpen, handleScan]);

  // Manual mode: handle input submission
  const handleManualSubmit = useCallback((code) => {
    if (code && code.trim().length >= 1) {
      handleScan(code.trim());
    }
  }, [handleScan]);

  const openCamera = useCallback(() => {
    setMode('camera');
    setIsCameraOpen(true);
    setIsScanning(true);
  }, []);

  const closeCamera = useCallback(() => {
    setIsCameraOpen(false);
    setIsScanning(false);
    setMode('hid');
  }, []);

  // Called by camera component on each barcode detection
  // Does NOT close camera — continuous scanning mode
  const onCameraScan = useCallback((code) => {
    handleScan(code);
  }, [handleScan]);

  const resetCode = useCallback(() => setScannedCode(''), []);

  return {
    scannedCode,
    inputRef,
    isScanning,
    isCameraOpen,
    mode,
    setMode,
    openCamera,
    closeCamera,
    onCameraScan,
    handleManualSubmit,
    resetCode,
  };
}
