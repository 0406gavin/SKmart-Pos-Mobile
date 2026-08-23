import React, { useEffect, useRef, useState, useCallback, memo } from 'react';
import { 
  BrowserMultiFormatReader, 
  BarcodeFormat, 
  DecodeHintType,
  Result
} from '@zxing/library';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { 
  Camera, 
  X, 
  AlertCircle, 
  Volume2, 
  VolumeX, 
  Repeat, 
  Upload, 
  Image as ImageIcon, 
  CheckCircle2, 
  RefreshCw, 
  Zap,
  ArrowLeft,
  Settings,
  Keyboard,
  Smartphone,
  Loader2
} from 'lucide-react';
import { Product } from '../types';
import { cameraPrewarmer } from '../utils/cameraPrewarmer';
import { NativeBarcodeScannerService } from '../services/nativeBarcodeScannerService';
import { validateBarcode, BarcodeStabilityTracker } from '../utils/barcodeValidator';
import { backNavigationManager } from '../utils/backNavigationManager';

interface CameraScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (barcode: string) => void;
  products?: Product[];
  currencySymbol?: string;
  mode?: 'single' | 'continuous';
  title?: string;
  subtitle?: string;
}

const CameraScannerModalComponent: React.FC<CameraScannerModalProps> = ({
  isOpen,
  onClose,
  onScanSuccess,
  products = [],
  currencySymbol = '₹',
  mode = 'continuous',
  title,
  subtitle,
}) => {
  // References
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const zxingReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const lastScannedTimeRef = useRef<Map<string, number>>(new Map());
  const isScanningRef = useRef<boolean>(false);
  const pauseUntilRef = useRef<number>(0);
  const activeStreamRef = useRef<MediaStream | null>(null);
  const scanLoopAnimationFrameRef = useRef<number | null>(null);
  const scanLoopTimeoutRef = useRef<any>(null);
  const stabilityTrackerRef = useRef<BarcodeStabilityTracker>(new BarcodeStabilityTracker(400, 2));

  // Settings State (stored in React state for UI + synced to Refs for zero-lag background scan loop)
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [isContinuousMode, setIsContinuousMode] = useState<boolean>(mode === 'continuous');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [vibrationEnabled, setVibrationEnabled] = useState<boolean>(true);
  const [isTorchOn, setIsTorchOn] = useState<boolean>(false);
  const [isTorchSupported, setIsTorchSupported] = useState<boolean>(true);
  const [isNativeSupported, setIsNativeSupported] = useState<boolean>(() => NativeBarcodeScannerService.isSupportedNative());

  // Synced Refs to eliminate React re-render stalls inside high-fps camera detection loop
  const isContinuousModeRef = useRef<boolean>(isContinuousMode);
  const soundEnabledRef = useRef<boolean>(soundEnabled);
  const vibrationEnabledRef = useRef<boolean>(vibrationEnabled);
  const productsRef = useRef<Product[]>(products);
  const onScanSuccessRef = useRef<(barcode: string) => void>(onScanSuccess);
  const onCloseRef = useRef<() => void>(onClose);

  useEffect(() => { isContinuousModeRef.current = isContinuousMode; }, [isContinuousMode]);
  useEffect(() => { soundEnabledRef.current = soundEnabled; }, [soundEnabled]);
  useEffect(() => { vibrationEnabledRef.current = vibrationEnabled; }, [vibrationEnabled]);
  useEffect(() => { productsRef.current = products; }, [products]);
  useEffect(() => { onScanSuccessRef.current = onScanSuccess; }, [onScanSuccess]);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  const [isMobileView, setIsMobileView] = useState<boolean>(() => typeof window !== 'undefined' && window.innerWidth < 768);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isManualInputOpen, setIsManualInputOpen] = useState<boolean>(false);
  const [manualBarcode, setManualBarcode] = useState<string>('');
  const [hardwareScannerActive, setHardwareScannerActive] = useState<boolean>(false);
  const [isSlowLoading, setIsSlowLoading] = useState<boolean>(false);

  // UI Diagnostics State
  const [statusMsg, setStatusMsg] = useState<string>('Initializing Camera...');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'camera' | 'image'>('camera');
  const [lastScannedResult, setLastScannedResult] = useState<{
    text: string;
    barcode: string;
    isRegistered: boolean;
    price?: number;
    format: string;
    time: string;
  } | null>(null);
  const [unregisteredError, setUnregisteredError] = useState<{
    barcode: string;
    time: string;
  } | null>(null);
  const [scanHistoryCount, setScanHistoryCount] = useState<number>(0);
  const [flashSuccess, setFlashSuccess] = useState<boolean>(false);
  const [streamResolution, setStreamResolution] = useState<string>('1080p HD (30 FPS)');
  const [dragActive, setDragActive] = useState<boolean>(false);

  // Clear state and enforce mode when modal opens
  useEffect(() => {
    if (isOpen) {
      stabilityTrackerRef.current.reset();
      setLastScannedResult(null);
      setUnregisteredError(null);
      setFlashSuccess(false);
      setIsSlowLoading(false);
      if (mode === 'single') {
        setIsContinuousMode(false);
      } else if (mode === 'continuous') {
        setIsContinuousMode(true);
      }
      // Pre-warm camera immediately on open trigger
      cameraPrewarmer.preload();
    }
  }, [isOpen, mode]);

  // Detect window resize
  useEffect(() => {
    const handleResize = () => {
      if (typeof window !== 'undefined') {
        setIsMobileView(window.innerWidth < 768);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Audio Context POS Beep Synthesizer
  const playPosBeep = useCallback(() => {
    if (!soundEnabledRef.current) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(2500, ctx.currentTime);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } catch {
      // Audio fallback safe
    }
  }, []);

  // Audio Context Error Tone
  const playPosErrorBeep = useCallback(() => {
    if (!soundEnabledRef.current) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(320, ctx.currentTime);
      osc.frequency.setValueAtTime(160, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.35, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } catch {
      // Safe fallback
    }
  }, []);

  // Haptic Vibration Feedback
  const triggerHaptic = useCallback(async () => {
    if (!vibrationEnabledRef.current) return;
    try {
      await Haptics.impact({ style: ImpactStyle.Medium });
    } catch {
      try {
        if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
          window.navigator.vibrate(40);
        }
      } catch {
        // Fallback
      }
    }
  }, []);

  // Find product by barcode
  const findProductByBarcode = useCallback((code: string) => {
    const list = productsRef.current;
    if (!list || list.length === 0) return null;
    const q = code.trim().toLowerCase();
    return list.find(p => 
      (p.barcode && p.barcode.trim().toLowerCase() === q) ||
      p.id.toLowerCase() === q ||
      p.variants?.some(v => v.barcode && v.barcode.trim().toLowerCase() === q)
    );
  }, []);

  // Cleanly Stop Stream & Release Scanner Engine
  const stopCameraStream = useCallback(() => {
    isScanningRef.current = false;
    setIsTorchOn(false);

    if (scanLoopAnimationFrameRef.current !== null) {
      cancelAnimationFrame(scanLoopAnimationFrameRef.current);
      scanLoopAnimationFrameRef.current = null;
    }
    if (scanLoopTimeoutRef.current) {
      clearTimeout(scanLoopTimeoutRef.current);
      scanLoopTimeoutRef.current = null;
    }

    if (zxingReaderRef.current) {
      try {
        zxingReaderRef.current.reset();
      } catch {
        // Reset safe
      }
    }

    if (activeStreamRef.current) {
      activeStreamRef.current.getTracks().forEach(track => {
        try {
          track.stop();
        } catch {
          // Track release
        }
      });
      activeStreamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    stabilityTrackerRef.current.reset();
    cameraPrewarmer.release();
  }, []);

  // Instant non-blocking close helper for back button and close controls
  const handleInstantClose = useCallback(() => {
    isScanningRef.current = false;
    stabilityTrackerRef.current.reset();
    onCloseRef.current();
    setTimeout(() => {
      stopCameraStream();
    }, 0);
  }, [stopCameraStream]);

  // Toggle Flashlight / Torch
  const toggleTorch = useCallback(async () => {
    if (isNativeSupported) {
      const active = await NativeBarcodeScannerService.toggleTorch();
      setIsTorchOn(active);
      return;
    }

    const nextState = !isTorchOn;
    const success = await cameraPrewarmer.setTorch(nextState);
    if (success) {
      setIsTorchOn(nextState);
    } else {
      // Direct track fallback
      if (activeStreamRef.current) {
        const track = activeStreamRef.current.getVideoTracks()[0];
        if (track) {
          try {
            await track.applyConstraints({ advanced: [{ torch: nextState }] as any });
            setIsTorchOn(nextState);
            return;
          } catch {
            // ignore
          }
        }
      }
      setStatusMsg('Flashlight not supported on this camera');
      setTimeout(() => setStatusMsg('Live Barcode Scanner Active'), 2000);
    }
  }, [isTorchOn, isNativeSupported]);

  // Handle Barcode Captured (Validates product, triggers beep/vibe, updates state)
  const handleBarcodeCaptured = useCallback((barcodeText: string, formatName: string = 'BARCODE') => {
    const validation = validateBarcode(barcodeText, formatName);
    if (!validation.isValid) {
      return;
    }
    const cleaned = validation.normalizedCode;
    const finalFormat = validation.normalizedFormat;
    const now = Date.now();

    if (now < pauseUntilRef.current) {
      return;
    }

    const lastTime = lastScannedTimeRef.current.get(cleaned) || 0;
    if (now - lastTime < 1800) {
      return;
    }

    lastScannedTimeRef.current.set(cleaned, now);
    pauseUntilRef.current = now + 1200; // 1.2s pause before next scan for same item

    const isSingleScanMode = mode === 'single' || !isContinuousModeRef.current;
    const matchedProduct = findProductByBarcode(cleaned);
    const isRegistered = !!matchedProduct;
    const timeStr = new Date().toLocaleTimeString();

    if (mode === 'single' || isRegistered) {
      // In single mode (e.g. Add New Product / Stock-In / Barcode Registration) OR when registered product scanned:
      playPosBeep();
      triggerHaptic();

      setUnregisteredError(null);
      setFlashSuccess(true);
      setTimeout(() => setFlashSuccess(false), 800);

      setLastScannedResult({
        text: matchedProduct ? matchedProduct.name : `Barcode: ${cleaned}`,
        barcode: cleaned,
        isRegistered: isRegistered,
        price: matchedProduct ? matchedProduct.sellingPrice : undefined,
        format: finalFormat,
        time: timeStr
      });
      setScanHistoryCount(prev => prev + 1);

      onScanSuccessRef.current(cleaned);

      if (isSingleScanMode) {
        handleInstantClose();
      }
    } else {
      // UNREGISTERED ITEM BARCODE (Continuous cashier billing mode only)
      playPosErrorBeep();
      triggerHaptic();

      setFlashSuccess(false);
      setUnregisteredError({
        barcode: cleaned,
        time: timeStr
      });

      setTimeout(() => {
        setUnregisteredError(null);
      }, 2500);

      setLastScannedResult({
        text: `Barcode: ${cleaned}`,
        barcode: cleaned,
        isRegistered: false,
        format: finalFormat,
        time: timeStr
      });

      onScanSuccessRef.current(cleaned);

      if (!isContinuousModeRef.current) {
        handleInstantClose();
      }
    }
  }, [mode, findProductByBarcode, playPosBeep, playPosErrorBeep, triggerHaptic, handleInstantClose]);

  // Quick Test Scan helper for testing without physical camera attached
  const triggerQuickDemoScan = useCallback(() => {
    const list = productsRef.current;
    let targetCode = '8901234567890';
    if (list && list.length > 0) {
      const withBarcode = list.find(p => p.barcode);
      if (withBarcode && withBarcode.barcode) {
        targetCode = withBarcode.barcode;
      }
    }
    handleBarcodeCaptured(targetCode, 'SAMPLE_DEMO');
  }, [handleBarcodeCaptured]);

  // Native Android MLKit Scanner execution
  const triggerNativeScan = useCallback(async () => {
    try {
      setErrorMsg(null);
      setStatusMsg('Opening Native Google MLKit Barcode Scanner...');
      const res = await NativeBarcodeScannerService.scanBarcode();
      if (res && res.barcode) {
        handleBarcodeCaptured(res.barcode, res.format);
        if (isContinuousModeRef.current) {
          // Continuous native loop
          setTimeout(() => triggerNativeScan(), 300);
        }
      }
    } catch (err: any) {
      console.warn('Native MLKit scanner fallback to web stream:', err);
      setErrorMsg(`Native scanner notice: ${err?.message || 'Using high-speed Web camera engine'}`);
    }
  }, [handleBarcodeCaptured]);

  // Initialize ZXing fallback engine once
  useEffect(() => {
    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
      BarcodeFormat.CODE_128,
      BarcodeFormat.CODE_39,
      BarcodeFormat.CODE_93,
      BarcodeFormat.ITF,
      BarcodeFormat.QR_CODE
    ]);
    hints.set(DecodeHintType.TRY_HARDER, true);

    zxingReaderRef.current = new BrowserMultiFormatReader(hints, 100);

    return () => {
      if (zxingReaderRef.current) {
        zxingReaderRef.current.reset();
        zxingReaderRef.current = null;
      }
    };
  }, []);

  // Start High-Performance Ultra-Fast Camera Stream & Decoder Loop
  const startCameraStream = useCallback(async (deviceId?: string) => {
    if (!isOpen || activeTab !== 'camera') return;

    // Show loading spinner ONLY if startup takes > 300ms
    const slowTimer = setTimeout(() => {
      setIsSlowLoading(true);
    }, 300);

    try {
      setErrorMsg(null);
      setStatusMsg('Opening Camera...');

      // 1. Get warm preloaded stream or fetch new stream
      let stream = cameraPrewarmer.getWarmStream();
      if (!stream) {
        stream = await cameraPrewarmer.preload({ deviceId });
      }

      // Direct fallback if prewarmer returned null
      if (!stream && typeof navigator !== 'undefined' && navigator?.mediaDevices?.getUserMedia) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: 'environment' } },
            audio: false,
          });
        } catch {
          try {
            stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
          } catch {
            // Permission denied or no camera hardware
          }
        }
      }

      clearTimeout(slowTimer);
      setIsSlowLoading(false);

      if (!stream) {
        setErrorMsg('Camera hardware unavailable or permission denied.');
        return;
      }

      activeStreamRef.current = stream;

      // Detect available devices asynchronously
      if (navigator.mediaDevices?.enumerateDevices) {
        navigator.mediaDevices.enumerateDevices().then(devices => {
          const videoDevs = devices.filter(d => d.kind === 'videoinput');
          setVideoDevices(videoDevs);
        }).catch(() => {});
      }

      // Check torch capabilities & apply continuous focus
      const track = stream.getVideoTracks()[0];
      if (track) {
        const caps = (track.getCapabilities?.() || {}) as any;
        setIsTorchSupported(prev => prev || !!(caps.torch || 'torch' in caps));

        if (caps.focusMode && Array.isArray(caps.focusMode) && caps.focusMode.includes('continuous')) {
          track.applyConstraints({
            advanced: [{ focusMode: 'continuous' }] as any,
          }).catch(() => {});
        }

        const settings = track.getSettings();
        if (settings.deviceId) {
          setSelectedDeviceId(settings.deviceId);
        }
        setStreamResolution(`${settings.width || 1280}x${settings.height || 720} @ 30FPS`);
      }

      const videoEl = videoRef.current;
      if (!videoEl) return;

      videoEl.srcObject = stream;
      await videoEl.play().catch(() => {});

      // Ensure video is playing and dimensions exist
      await new Promise<void>((resolve) => {
        if (videoEl.videoWidth > 0 && videoEl.videoHeight > 0) {
          resolve();
          return;
        }
        const onMeta = () => {
          videoEl.removeEventListener('loadedmetadata', onMeta);
          resolve();
        };
        videoEl.addEventListener('loadedmetadata', onMeta);
        setTimeout(resolve, 150);
      });

      isScanningRef.current = true;
      setStatusMsg('Live Barcode Scanner Active');

      // 2. High Speed Decoder Loop (Hybrid: Native BarcodeDetector -> ZXing fallback)
      const isNativeSupported = typeof window !== 'undefined' && 'BarcodeDetector' in window;

      if (isNativeSupported) {
        // NATIVE HARDWARE ACCELERATED BARCODE DETECTOR (Android C++/GPU MLKit engine - 0ms UI Lag)
        const formats = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'code_93', 'itf', 'qr_code'];
        const nativeDetector = new (window as any).BarcodeDetector({ formats });

        const nativeScanLoop = async () => {
          if (!isScanningRef.current || !videoEl) return;

          if (videoEl.readyState >= 2 && videoEl.videoWidth > 0) {
            try {
              const barcodes = await nativeDetector.detect(videoEl);
              if (barcodes && barcodes.length > 0) {
                for (const bc of barcodes) {
                  if (bc.rawValue) {
                    const fmt = bc.format ? bc.format.toUpperCase().replace('_', '-') : 'BARCODE';
                    const stability = stabilityTrackerRef.current.processFrame(bc.rawValue, fmt);
                    if (stability.accepted && stability.barcode) {
                      handleBarcodeCaptured(stability.barcode, stability.format || fmt);
                      break;
                    }
                  }
                }
              }
            } catch {
              // Frame scan safe
            }
          }

          if (isScanningRef.current) {
            // Throttled 50ms interval = ~20 FPS barcode analysis (Smooth UI + Low Battery)
            scanLoopTimeoutRef.current = setTimeout(() => {
              if (isScanningRef.current) {
                scanLoopAnimationFrameRef.current = requestAnimationFrame(nativeScanLoop);
              }
            }, 50);
          }
        };

        nativeScanLoop();
      } else if (zxingReaderRef.current) {
        // ZXING ENGINE FALLBACK
        const zxingReader = zxingReaderRef.current;
        zxingReader.decodeFromStream(
          stream,
          videoEl,
          (result: Result | null) => {
            if (result && isScanningRef.current) {
              const barcodeVal = result.getText();
              const formatName = BarcodeFormat[result.getBarcodeFormat()] || 'BARCODE';
              const stability = stabilityTrackerRef.current.processFrame(barcodeVal, formatName);
              if (stability.accepted && stability.barcode) {
                handleBarcodeCaptured(stability.barcode, stability.format || formatName);
              }
            }
          }
        );
      }

    } catch (err: any) {
      clearTimeout(slowTimer);
      setIsSlowLoading(false);
      console.error('Camera Scanner error:', err);
      stopCameraStream();

      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrorMsg('Camera permission denied. Allow camera access or use a Hardware Scanner.');
      } else {
        setErrorMsg(`Camera error: ${err?.message || 'Failed to start camera'}`);
      }
    }
  }, [isOpen, activeTab, stopCameraStream, handleBarcodeCaptured]);

  // Effect: Start stream on modal open & Handle App Visibility change (battery optimization)
  useEffect(() => {
    if (isOpen && activeTab === 'camera') {
      startCameraStream();

      // Pause scanning when app goes to background
      const handleVisibilityChange = () => {
        if (document.hidden) {
          isScanningRef.current = false;
          if (videoRef.current) videoRef.current.pause();
        } else {
          isScanningRef.current = true;
          if (videoRef.current) videoRef.current.play().catch(() => {});
        }
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);

      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        stopCameraStream();
      };
    } else {
      stopCameraStream();
    }
  }, [isOpen, activeTab, startCameraStream, stopCameraStream]);

  // Global Hardware USB / Bluetooth Barcode Scanner Listener
  useEffect(() => {
    if (!isOpen) return;

    let buffer = '';
    let lastKeyTime = Date.now();

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleInstantClose();
        return;
      }

      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'SELECT') {
        return;
      }

      const currentTime = Date.now();

      if (currentTime - lastKeyTime > 80) {
        buffer = '';
      }
      lastKeyTime = currentTime;

      if (e.key === 'Enter') {
        if (buffer.length >= 3) {
          e.preventDefault();
          setHardwareScannerActive(true);
          handleBarcodeCaptured(buffer, 'USB_HARDWARE_SCANNER');
          buffer = '';
        }
      } else if (e.key.length === 1) {
        buffer += e.key;
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isOpen, handleBarcodeCaptured, handleInstantClose]);

  // Physical Android Back Button & Browser PopState listener for 0ms Instant Modal Closure
  useEffect(() => {
    if (!isOpen) return;

    // Register with central back navigation manager at high priority (100)
    const unregisterBack = backNavigationManager.register('camera-scanner-modal', () => {
      handleInstantClose();
      return true;
    }, 100);

    const handlePopState = () => {
      handleInstantClose();
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      unregisterBack();
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isOpen, handleInstantClose]);

  // Decode Barcode from Image File
  const decodeBarcodeFromImageFile = async (file: File) => {
    try {
      setErrorMsg(null);
      setStatusMsg('Scanning Image File...');

      const imageUrl = URL.createObjectURL(file);
      const image = new Image();
      image.src = imageUrl;

      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = reject;
      });

      if (zxingReaderRef.current) {
        try {
          const result = await zxingReaderRef.current.decodeFromImageUrl(imageUrl);
          if (result) {
            const code = result.getText();
            const formatName = BarcodeFormat[result.getBarcodeFormat()] || 'BARCODE';
            handleBarcodeCaptured(code, formatName);
            setStatusMsg(`Scanned: ${code}`);
            URL.revokeObjectURL(imageUrl);
            return;
          }
        } catch {
          // Fallthrough
        }
      }

      const canvas = canvasRef.current || document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx || !image.width || !image.height) throw new Error('Canvas unavailable');

      canvas.width = image.width;
      canvas.height = image.height;
      ctx.drawImage(image, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      for (let i = 0; i < data.length; i += 4) {
        const v = (data[i] + data[i + 1] + data[i + 2]) / 3 > 128 ? 255 : 0;
        data[i] = v;
        data[i + 1] = v;
        data[i + 2] = v;
      }
      ctx.putImageData(imageData, 0, 0);

      const processedUrl = canvas.toDataURL('image/jpeg');
      if (zxingReaderRef.current) {
        const result = await zxingReaderRef.current.decodeFromImageUrl(processedUrl);
        if (result) {
          const code = result.getText();
          const formatName = BarcodeFormat[result.getBarcodeFormat()] || 'BARCODE';
          handleBarcodeCaptured(code, formatName);
          setStatusMsg(`Scanned: ${code}`);
          URL.revokeObjectURL(imageUrl);
          return;
        }
      }

      setErrorMsg('No barcode found in image. Ensure barcode is clear.');
      URL.revokeObjectURL(imageUrl);
    } catch {
      setErrorMsg('Unable to decode barcode from image.');
    }
  };

  if (!isOpen) return null;

  // --- MOBILE FULLSCREEN GOOGLE LENS / PHONEPE STYLE SCANNER ---
  if (isMobileView) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col justify-between text-white overflow-hidden animate-in fade-in duration-200">
        
        {/* TOP BAR */}
        <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between p-3.5 pt-6 sm:pt-8 bg-gradient-to-b from-black/85 via-black/50 to-transparent">
          <button
            onClick={handleInstantClose}
            className="p-2.5 rounded-full bg-slate-900/80 backdrop-blur-md text-white border border-white/10 active:scale-90 transition flex items-center justify-center shadow-lg min-h-[44px] min-w-[44px]"
            title="Close Scanner"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="text-center px-2 min-w-0">
            <h3 className="font-bold text-sm sm:text-base text-white tracking-wide truncate">
              {title || (mode === 'single' ? 'Scan Product Barcode' : 'Scan Product')}
            </h3>
            {mode === 'single' ? (
              <span className="inline-block text-[10px] bg-emerald-500/25 text-emerald-300 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider border border-emerald-500/40">
                Single Scan Mode
              </span>
            ) : (
              subtitle && <p className="text-[10px] text-slate-400 truncate">{subtitle}</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Flashlight toggle */}
            <button
              onClick={toggleTorch}
              className={`px-3 py-2 rounded-full transition active:scale-90 flex items-center gap-1.5 shadow-lg text-xs font-bold min-h-[44px] ${
                isTorchOn
                  ? 'bg-amber-400 text-slate-950 border border-amber-300'
                  : 'bg-slate-900/80 backdrop-blur-md text-white border border-white/10'
              }`}
              title="Toggle Flashlight"
            >
              <Zap className={`w-4 h-4 ${isTorchOn ? 'fill-current' : ''}`} />
              <span>{isTorchOn ? 'Flash On' : '⚡ Flash'}</span>
            </button>

            {/* Hidden Settings Toggle */}
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-2.5 rounded-full bg-slate-900/80 backdrop-blur-md text-white border border-white/10 active:scale-90 transition flex items-center justify-center shadow-lg min-h-[44px] min-w-[44px]"
              title="Scanner Settings"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* FULLSCREEN CAMERA VIEWPORT & GUIDE FRAME */}
        <div className="relative w-full h-[75vh] my-auto flex items-center justify-center bg-black">
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            playsInline
            muted
          />

          {/* Sub-300ms Async Loading Spinner */}
          {isSlowLoading && (
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm z-20 flex flex-col items-center justify-center gap-3 text-emerald-400">
              <Loader2 className="w-8 h-8 animate-spin" />
              <span className="text-xs font-mono font-bold">Initializing POS Camera Stream...</span>
            </div>
          )}

          {/* Registered Product Added Success Popup Card Overlay */}
          {flashSuccess && (
            <div className="absolute inset-0 bg-black/40 backdrop-blur-xs z-30 flex items-center justify-center p-4 animate-in zoom-in-95 duration-150">
              <div className="bg-slate-900/95 border-2 border-emerald-400 rounded-2xl p-4 shadow-2xl flex items-center gap-3.5 max-w-xs w-full text-white">
                <div className="p-2.5 rounded-full bg-emerald-500 text-slate-950 font-bold shrink-0 shadow-lg shadow-emerald-500/40">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-extrabold uppercase tracking-wider">
                    <span>✔ Product Added</span>
                  </div>
                  <div className="font-mono font-bold text-sm text-white truncate">
                    {lastScannedResult?.text}
                  </div>
                  <div className="text-[11px] text-emerald-300 font-semibold">
                    {lastScannedResult?.price !== undefined ? `${currencySymbol}${lastScannedResult.price} • ` : ''}Added to cart
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Unregistered Item Warning Overlay */}
          {unregisteredError && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-xs z-30 flex items-center justify-center p-4 animate-in zoom-in-95 duration-150">
              <div className="bg-rose-950/95 border-2 border-rose-500 rounded-2xl p-4 shadow-2xl flex items-center gap-3.5 max-w-xs w-full text-white">
                <div className="p-2.5 rounded-full bg-rose-600 text-white font-bold shrink-0 shadow-lg shadow-rose-600/40">
                  <AlertCircle className="w-7 h-7" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 text-rose-300 text-xs font-extrabold uppercase tracking-wider">
                    <span>❌ No Such Item in Inventory</span>
                  </div>
                  <div className="font-mono font-bold text-sm text-white truncate mt-0.5">
                    Barcode: {unregisteredError.barcode}
                  </div>
                  <div className="text-[11px] text-rose-200/90 font-medium mt-0.5">
                    Unregistered barcode • Not found in stock
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Target Frame Overlay */}
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center z-10 px-6">
            <div className="w-[290px] h-[220px] sm:w-[340px] sm:h-[240px] border-2 border-emerald-400 rounded-3xl relative shadow-[0_0_30px_rgba(16,185,129,0.35)] bg-emerald-950/10">
              
              {/* Corner brackets */}
              <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-emerald-400 rounded-tl-xl" />
              <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-emerald-400 rounded-tr-xl" />
              <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-emerald-400 rounded-bl-xl" />
              <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-emerald-400 rounded-br-xl" />

              {/* Animated laser scan line */}
              <div className="w-full h-0.5 bg-emerald-400 shadow-[0_0_12px_#34d399] absolute top-1/2 -translate-y-1/2 animate-[ping_1.5s_infinite]" />

              {/* Centered instruction tag */}
              <div className="absolute inset-x-0 -bottom-10 text-center">
                <span className="inline-block bg-slate-950/80 text-emerald-300 text-xs px-3.5 py-1 rounded-full font-mono font-bold tracking-wider border border-emerald-500/30 backdrop-blur-md shadow-lg">
                  Align barcode inside the frame
                </span>
              </div>
            </div>
          </div>

          {/* Diagnostic message overlay */}
          {errorMsg && (
            <div className="absolute top-20 inset-x-4 z-20 p-4 rounded-2xl bg-slate-950/95 border border-amber-500/60 text-slate-100 text-xs backdrop-blur-md flex flex-col gap-3 shadow-2xl animate-in zoom-in-95 duration-150">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 shrink-0 text-amber-400 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-amber-300 text-sm">Camera Hardware Notice</p>
                  <p className="text-slate-300 text-xs mt-0.5">{errorMsg}</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800">
                <button
                  onClick={() => startCameraStream()}
                  className="px-3 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-bold transition flex items-center gap-1.5 active:scale-95 min-h-[36px]"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Retry Camera
                </button>

                <button
                  onClick={() => setIsManualInputOpen(true)}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 active:scale-95 min-h-[36px]"
                >
                  <Keyboard className="w-3.5 h-3.5 text-emerald-400" />
                  Manual Entry
                </button>

                <button
                  onClick={triggerQuickDemoScan}
                  className="px-3 py-2 bg-emerald-600/30 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/40 rounded-xl text-xs font-bold transition flex items-center gap-1.5 active:scale-95 min-h-[36px]"
                >
                  <Zap className="w-3.5 h-3.5" />
                  Test Demo Scan
                </button>
              </div>
            </div>
          )}

          {/* Last Scanned Result Pill */}
          {lastScannedResult && !flashSuccess && !unregisteredError && (
            <div className={`absolute bottom-6 inset-x-6 z-20 p-2.5 rounded-2xl backdrop-blur-md flex items-center justify-between text-xs shadow-xl animate-in fade-in duration-150 border ${
              lastScannedResult.isRegistered
                ? 'bg-slate-950/90 border-emerald-500/50 text-emerald-300'
                : 'bg-rose-950/90 border-rose-500/50 text-rose-300'
            }`}>
              <div className="flex items-center gap-2 min-w-0 flex-1">
                {lastScannedResult.isRegistered ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                )}
                <span className="font-mono font-bold text-xs truncate">{lastScannedResult.text}</span>
              </div>
              <span className={`px-2 py-0.5 rounded font-bold text-[10px] shrink-0 ml-2 ${
                lastScannedResult.isRegistered
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : 'bg-rose-500/20 text-rose-300'
              }`}>
                {lastScannedResult.isRegistered ? `Added (${scanHistoryCount})` : 'Not in Inventory'}
              </span>
            </div>
          )}
        </div>

        {/* BOTTOM ACTION BAR */}
        <div className="absolute bottom-0 left-0 right-0 z-30 p-4 pb-6 sm:pb-8 bg-gradient-to-t from-black/95 via-black/80 to-transparent flex flex-col items-center gap-3">
          
          {/* Hardware Scanner Status Badge */}
          <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-950/80 border border-emerald-500/40 rounded-full text-[11px] font-mono font-bold text-emerald-300 shadow-md backdrop-blur-md">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>{hardwareScannerActive ? '🟢 Hardware Scanner Connected • Ready' : '📷 Hardware POS Scanner Active'}</span>
          </div>

          {/* Bottom Action Controls */}
          <div className="flex items-center justify-center gap-3 w-full max-w-sm">
            {/* Gallery Upload */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-slate-900/90 hover:bg-slate-800 backdrop-blur-md text-slate-200 border border-white/10 rounded-2xl text-xs font-bold active:scale-95 transition shadow-lg min-h-[46px]"
            >
              <ImageIcon className="w-4 h-4 text-emerald-400" />
              <span>Gallery</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => {
                if (e.target.files?.[0]) decodeBarcodeFromImageFile(e.target.files[0]);
              }}
            />

            {/* Manual Entry */}
            <button
              onClick={() => setIsManualInputOpen(true)}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-slate-900/90 hover:bg-slate-800 backdrop-blur-md text-slate-200 border border-white/10 rounded-2xl text-xs font-bold active:scale-95 transition shadow-lg min-h-[46px]"
            >
              <Keyboard className="w-4 h-4 text-emerald-400" />
              <span>Manual Entry</span>
            </button>
          </div>
        </div>

        {/* MANUAL BARCODE ENTRY DRAWER */}
        {isManualInputOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-3xl p-5 w-full max-w-md space-y-4 shadow-2xl animate-in slide-in-from-bottom duration-200 text-slate-100">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h4 className="font-bold text-sm flex items-center gap-2">
                  <Keyboard className="w-4 h-4 text-emerald-400" />
                  Manual Barcode Entry
                </h4>
                <button
                  onClick={() => setIsManualInputOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white min-h-[44px] min-w-[44px] flex items-center justify-center"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                  Type or paste product barcode:
                </label>
                <input
                  type="text"
                  autoFocus
                  placeholder="e.g. 8901234567890"
                  value={manualBarcode}
                  onChange={e => setManualBarcode(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && manualBarcode.trim()) {
                      handleBarcodeCaptured(manualBarcode, 'MANUAL_ENTRY');
                      setManualBarcode('');
                      setIsManualInputOpen(false);
                    }
                  }}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-sm font-mono font-bold text-white focus:outline-none focus:border-emerald-500 min-h-[44px]"
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setIsManualInputOpen(false)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-bold transition min-h-[44px]"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (manualBarcode.trim()) {
                      handleBarcodeCaptured(manualBarcode, 'MANUAL_ENTRY');
                      setManualBarcode('');
                      setIsManualInputOpen(false);
                    }
                  }}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition min-h-[44px]"
                >
                  Add Product
                </button>
              </div>
            </div>
          </div>
        )}

        {/* HIDDEN SCANNER SETTINGS DRAWER */}
        {isSettingsOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-3xl p-5 w-full max-w-md space-y-4 shadow-2xl animate-in slide-in-from-bottom duration-200 text-slate-100">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h4 className="font-bold text-sm flex items-center gap-2">
                  <Settings className="w-4 h-4 text-emerald-400" />
                  Scanner Advanced Settings
                </h4>
                <button
                  onClick={() => setIsSettingsOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white min-h-[44px] min-w-[44px] flex items-center justify-center"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Select Camera</label>
                  <select
                    value={selectedDeviceId}
                    onChange={e => {
                      const id = e.target.value;
                      if (id) {
                        setSelectedDeviceId(id);
                        startCameraStream(id);
                      }
                    }}
                    className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl font-semibold text-slate-200 min-h-[44px]"
                  >
                    {videoDevices.length > 0 ? (
                      videoDevices.map((d, i) => (
                        <option key={d.deviceId || i} value={d.deviceId}>
                          {d.label || `Camera ${i + 1}`}
                        </option>
                      ))
                    ) : (
                      <option value="">No Physical Camera Detected</option>
                    )}
                  </select>
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-800/80 rounded-xl">
                  <div>
                    <div className="font-bold">Continuous Auto-Scan</div>
                    <div className="text-[10px] text-slate-400">Keep camera active after each scan</div>
                  </div>
                  <button
                    onClick={() => setIsContinuousMode(!isContinuousMode)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition min-h-[36px] ${
                      isContinuousMode ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-300'
                    }`}
                  >
                    {isContinuousMode ? 'AUTO REPEAT' : 'SINGLE'}
                  </button>
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-800/80 rounded-xl">
                  <div>
                    <div className="font-bold">Audio Feedback</div>
                    <div className="text-[10px] text-slate-400">Play beep sound on barcode scan</div>
                  </div>
                  <button
                    onClick={() => setSoundEnabled(!soundEnabled)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition min-h-[36px] ${
                      soundEnabled ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-300'
                    }`}
                  >
                    {soundEnabled ? 'BEEP ON' : 'MUTED'}
                  </button>
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-800/80 rounded-xl">
                  <div>
                    <div className="font-bold">Vibration Haptics</div>
                    <div className="text-[10px] text-slate-400">Vibrate phone on success</div>
                  </div>
                  <button
                    onClick={() => setVibrationEnabled(!vibrationEnabled)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition min-h-[36px] ${
                      vibrationEnabled ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-300'
                    }`}
                  >
                    {vibrationEnabled ? 'VIBRATE ON' : 'OFF'}
                  </button>
                </div>
              </div>

              <button
                onClick={() => setIsSettingsOpen(false)}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition min-h-[44px]"
              >
                Save & Back to Scanner
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- DESKTOP MODAL SCANNER ---
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-3 sm:p-5 overflow-y-auto">
      <div className="bg-slate-900 rounded-2xl shadow-2xl border border-slate-700/80 w-full max-w-2xl overflow-hidden text-slate-100 animate-in fade-in zoom-in duration-150">
        
        {/* Header Bar */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base flex items-center gap-2">
                {title || (mode === 'single' ? 'Scan Product Barcode' : 'Barcode Scanner Terminal')}
                <span className={`px-2 py-0.5 text-[10px] font-mono rounded-full font-bold ${
                  mode === 'single'
                    ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/40'
                    : 'bg-emerald-500/20 text-emerald-400'
                }`}>
                  {mode === 'single' ? 'Single Scan' : 'POS Engine'}
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                {subtitle || (mode === 'single' ? 'Point camera at product barcode • Closes automatically upon scan' : 'Optimized Live Stream • EAN, UPC, Code128, QR & Hardware Scanners')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsMobileView(true)}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition flex items-center gap-1 text-xs font-semibold min-h-[44px]"
              title="Switch to Mobile Fullscreen View"
            >
              <Smartphone className="w-4 h-4" />
              <span className="hidden sm:inline">Mobile View</span>
            </button>

            <button
              onClick={handleInstantClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-4 pt-2 gap-2">
          <button
            onClick={() => setActiveTab('camera')}
            className={`px-4 py-2 text-xs font-bold rounded-t-xl transition flex items-center gap-1.5 border-t border-x min-h-[40px] ${
              activeTab === 'camera'
                ? 'bg-slate-900 border-slate-700 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            Live Camera Scanner
          </button>

          <button
            onClick={() => setActiveTab('image')}
            className={`px-4 py-2 text-xs font-bold rounded-t-xl transition flex items-center gap-1.5 border-t border-x min-h-[40px] ${
              activeTab === 'image'
                ? 'bg-slate-900 border-slate-700 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            Scan From Photo / File
          </button>
        </div>

        {/* Main Content */}
        <div className="p-4 sm:p-5 space-y-4">

          {/* TAB 1: Live Camera */}
          {activeTab === 'camera' && (
            <div className="space-y-3">
              {/* Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                <div className="sm:col-span-1">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                    Select Camera
                  </label>
                  <select
                    value={selectedDeviceId}
                    onChange={e => {
                      const id = e.target.value;
                      if (id) {
                        setSelectedDeviceId(id);
                        startCameraStream(id);
                      }
                    }}
                    className="w-full p-2 bg-slate-800 border border-slate-700 rounded-xl text-xs font-semibold text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 min-h-[40px]"
                  >
                    {videoDevices.length > 0 ? (
                      videoDevices.map((d, i) => (
                        <option key={d.deviceId || i} value={d.deviceId}>
                          {d.label || `Camera ${i + 1}`}
                        </option>
                      ))
                    ) : (
                      <option value="">No Physical Camera Detected</option>
                    )}
                  </select>
                </div>

                <div className="flex items-end justify-between bg-slate-800/60 p-2 rounded-xl border border-slate-800 min-h-[40px]">
                  <span className="text-[11px] font-semibold text-slate-300">Continuous Scan</span>
                  <button
                    onClick={() => setIsContinuousMode(!isContinuousMode)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition ${
                      isContinuousMode ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-300'
                    }`}
                  >
                    <Repeat className="w-3 h-3" />
                    {isContinuousMode ? 'AUTO REPEAT' : 'SINGLE'}
                  </button>
                </div>

                <div className="flex items-end justify-between bg-slate-800/60 p-2 rounded-xl border border-slate-800 min-h-[40px]">
                  <span className="text-[11px] font-semibold text-slate-300">Audio Beep</span>
                  <button
                    onClick={() => setSoundEnabled(!soundEnabled)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition ${
                      soundEnabled ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-300'
                    }`}
                  >
                    {soundEnabled ? <Volume2 className="w-3 h-3" /> : <VolumeX className="w-3 h-3" />}
                    {soundEnabled ? 'BEEP ON' : 'MUTED'}
                  </button>
                </div>
              </div>

              {/* Live Video Viewport */}
              <div className="relative rounded-2xl overflow-hidden bg-black min-h-[300px] sm:min-h-[340px] flex items-center justify-center border-2 border-slate-700 shadow-inner">
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  playsInline
                  muted
                />

                {/* Async Loading Spinner */}
                {isSlowLoading && (
                  <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm z-20 flex flex-col items-center justify-center gap-3 text-emerald-400">
                    <Loader2 className="w-8 h-8 animate-spin" />
                    <span className="text-xs font-mono font-bold">Initializing POS Camera Stream...</span>
                  </div>
                )}

                {/* Success Flash Overlay */}
                {flashSuccess && (
                  <div className="absolute inset-0 bg-emerald-950/70 border-4 border-emerald-400 z-20 flex items-center justify-center animate-out fade-out duration-300">
                    <div className="bg-emerald-600 text-white px-5 py-3 rounded-2xl font-mono font-bold text-sm shadow-xl flex items-center gap-2.5">
                      <CheckCircle2 className="w-6 h-6" />
                      <div>
                        <div>{mode === 'single' ? '✔ BARCODE CAPTURED' : '✔ ITEM ADDED TO CART'}</div>
                        <div className="text-xs font-normal text-emerald-100">
                          {mode === 'single' ? 'Loading product details...' : lastScannedResult?.text}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Unregistered Item Error Overlay */}
                {unregisteredError && (
                  <div className="absolute inset-0 bg-rose-950/80 border-4 border-rose-500 z-20 flex items-center justify-center animate-in zoom-in-95 duration-150">
                    <div className="bg-rose-900 text-white px-5 py-3.5 rounded-2xl font-mono font-bold text-sm shadow-2xl flex items-center gap-2.5">
                      <AlertCircle className="w-6 h-6 text-rose-300 shrink-0" />
                      <div>
                        <div className="text-rose-100 font-extrabold text-sm">❌ NO SUCH ITEM IN INVENTORY</div>
                        <div className="text-xs font-mono text-rose-200 mt-0.5">Barcode: {unregisteredError.barcode}</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Diagnostic Camera Notice Overlay */}
                {errorMsg && (
                  <div className="absolute inset-x-4 top-4 z-20 p-4 rounded-2xl bg-slate-950/95 border border-amber-500/60 text-slate-100 text-xs backdrop-blur-md flex flex-col gap-3 shadow-2xl animate-in zoom-in-95 duration-150">
                    <div className="flex items-start gap-2.5">
                      <AlertCircle className="w-5 h-5 shrink-0 text-amber-400 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-amber-300 text-sm">Camera Hardware Notice</p>
                        <p className="text-slate-300 text-xs mt-0.5">{errorMsg}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800">
                      <button
                        onClick={() => startCameraStream()}
                        className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-bold transition flex items-center gap-1.5 active:scale-95"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Retry Camera
                      </button>

                      <button
                        onClick={() => setIsManualInputOpen(true)}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 active:scale-95"
                      >
                        <Keyboard className="w-3.5 h-3.5 text-emerald-400" />
                        Manual Entry
                      </button>

                      <button
                        onClick={triggerQuickDemoScan}
                        className="px-3 py-1.5 bg-emerald-600/30 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/40 rounded-xl text-xs font-bold transition flex items-center gap-1.5 active:scale-95"
                      >
                        <Zap className="w-3.5 h-3.5" />
                        Test Demo Scan
                      </button>
                    </div>
                  </div>
                )}

                {/* Target Frame Overlay */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="w-[280px] sm:w-[340px] h-[160px] sm:h-[180px] border-2 border-emerald-500/60 rounded-xl relative shadow-[0_0_20px_rgba(16,185,129,0.3)] bg-emerald-950/10">
                    <div className="absolute -top-1 -left-1 w-5 h-5 border-t-4 border-l-4 border-emerald-400 rounded-tl" />
                    <div className="absolute -top-1 -right-1 w-5 h-5 border-t-4 border-r-4 border-emerald-400 rounded-tr" />
                    <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-4 border-l-4 border-emerald-400 rounded-bl" />
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-4 border-r-4 border-emerald-400 rounded-br" />

                    <div className="w-full h-0.5 bg-rose-500 shadow-[0_0_12px_#f43f5e] absolute animate-[ping_1.5s_infinite] top-1/2 -translate-y-1/2" />

                    <div className="absolute inset-x-0 bottom-2 text-center">
                      <span className="inline-block bg-slate-900/80 text-emerald-400 text-[10px] px-2.5 py-0.5 rounded-full font-mono font-semibold tracking-wider border border-emerald-500/30">
                        ALIGN BARCODE IN FRAME
                      </span>
                    </div>
                  </div>
                </div>

                <div className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur-sm px-3 py-1 rounded-full text-[10px] font-mono text-slate-300 border border-slate-700 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span>{streamResolution}</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Image Upload */}
          {activeTab === 'image' && (
            <div className="space-y-4">
              <div
                onDragOver={e => { e.preventDefault(); setDragActive(true); }}
                onDragLeave={e => { e.preventDefault(); setDragActive(false); }}
                onDrop={e => {
                  e.preventDefault();
                  setDragActive(false);
                  if (e.dataTransfer.files?.[0]) decodeBarcodeFromImageFile(e.dataTransfer.files[0]);
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition ${
                  dragActive ? 'border-emerald-400 bg-emerald-950/30' : 'border-slate-700 bg-slate-950/40 hover:border-slate-500'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => {
                    if (e.target.files?.[0]) decodeBarcodeFromImageFile(e.target.files[0]);
                  }}
                />
                <Upload className="w-10 h-10 mx-auto text-emerald-400 mb-3" />
                <h4 className="font-bold text-sm text-slate-200">Drag & Drop Barcode Image or Click to Browse</h4>
                <p className="text-xs text-slate-400 mt-1">Supports PNG, JPG, WEBP product photos</p>
              </div>
              <canvas ref={canvasRef} className="hidden" />
            </div>
          )}

          {/* Diagnostic Alert */}
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-amber-950/50 border border-amber-800 text-amber-200 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
              <div>
                <p className="font-bold">Scanner Diagnostic Info</p>
                <p className="text-amber-300/90">{errorMsg}</p>
              </div>
            </div>
          )}

          {/* Scanned Result */}
          {lastScannedResult && (
            <div className={`p-3 border rounded-xl flex items-center justify-between text-xs ${
              lastScannedResult.isRegistered
                ? 'bg-emerald-950/40 border-emerald-800/80 text-emerald-300'
                : 'bg-rose-950/40 border-rose-800/80 text-rose-300'
            }`}>
              <div className="flex items-center gap-2">
                {lastScannedResult.isRegistered ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                )}
                <div>
                  <div className="font-mono font-bold text-sm">{lastScannedResult.text}</div>
                  <div className="text-[10px] text-slate-400">
                    Barcode: {lastScannedResult.barcode} • Format: {lastScannedResult.format} • Time: {lastScannedResult.time}
                  </div>
                </div>
              </div>
              <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                lastScannedResult.isRegistered
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : 'bg-rose-500/20 text-rose-300'
              }`}>
                {lastScannedResult.isRegistered ? `Scanned (${scanHistoryCount})` : 'Not in Inventory'}
              </span>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between">
          <div className="text-[11px] font-mono text-slate-400 flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>Hardware USB/Bluetooth Scanner Active</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => { if (activeTab === 'camera') startCameraStream(); }}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1 transition min-h-[38px]"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Reset
            </button>

            <button
              onClick={handleInstantClose}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-xs font-bold transition min-h-[38px]"
            >
              Close
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export const CameraScannerModal = memo(CameraScannerModalComponent);
