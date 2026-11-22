import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { useModalAnimation } from '../hooks/useModalAnimation';
import {
  compressImageToDataUrl,
  compressThumbnailDataUrl,
  analyzeMealWithCalAi,
  analyzeProductYuka,
  analyzeTextMealWithAurelius,
  fixMealWithAurelius,
  getYukaMeta,
  getLoggedMeals,
  saveLoggedMeal,
  deleteLoggedMeal,
  getDailyNutritionSummary,
  getDailyTargets,
  saveDailyTargets,
  getDailyHydrationMl,
  saveDailyHydrationMl,
  getLocalDateKey,
  shiftDateKey,
  getAllLoggedMealDates,
} from '../lib/calAiService';
import { CalAiAnalysisResult, CalAiDailyTarget } from '../types/calai';
import { AureliusOrb } from './ui/ai-thiking-orb-and-input';
import {
  X,
  Camera,
  Image as ImageIcon,
  Flame,
  Check,
  Trash2,
  Sparkles,
  Plus,
  Minus,
  Utensils,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Compass,
  ScanBarcode,
  Droplets,
  Wand2,
  Pencil,
  ThumbsUp,
  ThumbsDown,
  AlertTriangle,
  Type,
  Send,
} from 'lucide-react';

interface CalAiModalProps {
  onClose?: () => void;
  embedded?: boolean;
  initialImage?: { base64: string; mimeType: string; dataUrl: string };
}

function formatDateKeyLabel(dateKey: string, isEn: boolean): string {
  const today = getLocalDateKey();
  const yesterday = shiftDateKey(today, -1);
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1, 12, 0, 0);
  const shortDate = dt.toLocaleDateString(isEn ? 'en-US' : 'fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  if (dateKey === today) return isEn ? `Today · ${shortDate}` : `Aujourd’hui · ${shortDate}`;
  if (dateKey === yesterday) return isEn ? `Yesterday · ${shortDate}` : `Hier · ${shortDate}`;
  return shortDate;
}

export const CalAiModal: React.FC<CalAiModalProps> = ({ onClose, embedded = false, initialImage }) => {
  const { language, weekData, selectedDay, selectedDateKey, cardThemeMode } = useApp();
  const { isClosing, handleClose } = useModalAnimation(onClose || (() => {}));
  const isEn = language === 'en';
  const isMono = cardThemeMode === 'monochrome';
  const accent = isMono ? '#FAF7F2' : '#C084FC';
  const accentLight = isMono ? '#FAF7F2' : '#D8B4FE';
  const accentSoft = isMono ? 'rgba(255, 255, 255, 0.09)' : 'rgba(192, 132, 252, 0.14)';
  const accentBorder = isMono ? 'rgba(255, 248, 240, 0.28)' : 'rgba(192, 132, 252, 0.38)';
  const proteinTint = isMono ? '#FAF7F2' : '#D8B4FE';
  const carbsTint = isMono ? 'rgba(250, 247, 242, 0.78)' : '#C084FC';
  const fatTint = isMono ? 'rgba(250, 247, 242, 0.56)' : '#A855F7';
  const todayKey = getLocalDateKey();

  const [activeDateKey, setActiveDateKey] = useState<string>(() => selectedDateKey || todayKey);
  const [activeTab, setActiveTab] = useState<'scan' | 'journal'>('scan');
  const [scanMode, setScanMode] = useState<'plate' | 'yuka' | 'text'>('plate');
  const [mealTextInput, setMealTextInput] = useState<string>('');
  const [yukaCameraReady, setYukaCameraReady] = useState<boolean>(false);
  const [yukaCameraError, setYukaCameraError] = useState<boolean>(false);
  const yukaVideoRef = useRef<HTMLVideoElement | null>(null);
  const yukaStreamRef = useRef<MediaStream | null>(null);
  const yukaScanTimerRef = useRef<any>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanStep, setScanStep] = useState<string>('');
  const [currentResult, setCurrentResult] = useState<CalAiAnalysisResult | null>(null);
  const [currentImagePreview, setCurrentImagePreview] = useState<string | null>(initialImage?.dataUrl || null);
  const [selectedMealType, setSelectedMealType] = useState<'breakfast' | 'lunch' | 'dinner' | 'snack'>('lunch');
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Journal du jour ciblé
  const [loggedMeals, setLoggedMeals] = useState<CalAiAnalysisResult[]>(() => getLoggedMeals(selectedDateKey || todayKey));
  const [dailySummary, setDailySummary] = useState(() => getDailyNutritionSummary(selectedDateKey || todayKey));
  const [loggedDates, setLoggedDates] = useState<{ dateKey: string; mealCount: number; calories: number }[]>(() => getAllLoggedMealDates());
  const [dailyTargets, setDailyTargets] = useState<CalAiDailyTarget>(() => getDailyTargets());
  const [isEditingTargets, setIsEditingTargets] = useState<boolean>(false);
  const [targetDraft, setTargetDraft] = useState<CalAiDailyTarget>(() => getDailyTargets());
  const [hydrationMl, setHydrationMl] = useState<number>(() => getDailyHydrationMl(selectedDateKey || todayKey));

  const [fixTargetId, setFixTargetId] = useState<string | null>(null);
  const [fixText, setFixText] = useState<string>('');
  const [isFixing, setIsFixing] = useState<boolean>(false);
  const [expandedJournalId, setExpandedJournalId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  const refreshJournal = (targetKey: string = activeDateKey) => {
    const meals = getLoggedMeals(targetKey);
    setLoggedMeals(meals);
    setDailySummary(getDailyNutritionSummary(targetKey));
    setLoggedDates(getAllLoggedMealDates());
    setHydrationMl(getDailyHydrationMl(targetKey));
  };

  useEffect(() => {
    if (selectedDateKey) {
      setActiveDateKey(selectedDateKey);
    }
  }, [selectedDateKey]);

  useEffect(() => {
    refreshJournal(activeDateKey);
  }, [activeDateKey]);

  useEffect(() => {
    if (initialImage) {
      processImage(initialImage);
    }
  }, [initialImage]);

  const processImage = async (imgData: { base64: string; mimeType: string; dataUrl: string }) => {
    setIsScanning(true);
    setErrorMessage(null);
    setCurrentResult(null);
    setSaveSuccess(false);
    setCurrentImagePreview(imgData.dataUrl);

    setScanStep(isEn ? 'Visual scan of plate...' : 'Scan visuel de l’assiette...');
    await new Promise((r) => setTimeout(r, 450));

    setScanStep(isEn ? 'Decomposing portions & ingredients...' : 'Décomposition des portions & ingrédients...');
    await new Promise((r) => setTimeout(r, 550));

    setScanStep(isEn ? 'Aurelius synthesis & calorie calculation...' : 'Calcul des calories & synthèse Aurelius...');

    try {
      const result =
        scanMode === 'yuka'
          ? await analyzeProductYuka({
              imagePayload: imgData,
              language: isEn ? 'en' : 'fr',
              mealType: selectedMealType,
              dateKey: activeDateKey,
            })
          : await analyzeMealWithCalAi(imgData, {
              language: isEn ? 'en' : 'fr',
              mealType: selectedMealType,
              dateKey: activeDateKey,
            });
      setCurrentResult(result);
    } catch (err: any) {
      console.error('[Aurelius Nutrition] Erreur analyse:', err);
      setErrorMessage(
        err?.message || (isEn ? 'Could not analyze meal. Please retry.' : 'Échec de l’analyse. Veuillez réessayer.')
      );
    } finally {
      setIsScanning(false);
    }
  };

  const stopYukaCamera = () => {
    if (yukaScanTimerRef.current) {
      clearInterval(yukaScanTimerRef.current);
      yukaScanTimerRef.current = null;
    }
    if (yukaStreamRef.current) {
      yukaStreamRef.current.getTracks().forEach((tr) => tr.stop());
      yukaStreamRef.current = null;
    }
    if (yukaVideoRef.current) {
      yukaVideoRef.current.srcObject = null;
    }
    setYukaCameraReady(false);
  };

  useEffect(() => {
    const shouldRun = activeTab === 'scan' && scanMode === 'yuka' && !isScanning && !currentResult && !currentImagePreview;
    if (!shouldRun) {
      stopYukaCamera();
      return;
    }

    let cancelled = false;
    setYukaCameraError(false);

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setYukaCameraError(true);
          return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((tr) => tr.stop());
          return;
        }
        yukaStreamRef.current = stream;
        if (yukaVideoRef.current) {
          yukaVideoRef.current.srcObject = stream;
          await yukaVideoRef.current.play().catch(() => {});
        }
        setYukaCameraReady(true);

        if ('BarcodeDetector' in window) {
          try {
            const detector = new (window as any).BarcodeDetector({
              formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'],
            });
            yukaScanTimerRef.current = setInterval(async () => {
              const vid = yukaVideoRef.current;
              if (!vid || vid.readyState < 2 || cancelled) return;
              try {
                const codes = await detector.detect(vid);
                const rawCode = codes?.[0]?.rawValue?.trim();
                if (rawCode && /^\d{8,14}$/.test(rawCode)) {
                  try { navigator.vibrate?.(25); } catch (_) {}
                  stopYukaCamera();
                  setIsScanning(true);
                  setErrorMessage(null);
                  setCurrentResult(null);
                  setSaveSuccess(false);
                  setScanStep(isEn ? `Barcode ${rawCode} detected...` : `Code-barres ${rawCode} détecté…`);
                  try {
                    const res = await analyzeProductYuka({
                      barcodeOrQuery: rawCode,
                      language: isEn ? 'en' : 'fr',
                      mealType: selectedMealType,
                      dateKey: activeDateKey,
                    });
                    setCurrentResult(res);
                  } catch (err: any) {
                    setErrorMessage(err?.message || (isEn ? 'Product not found.' : 'Produit introuvable.'));
                  } finally {
                    setIsScanning(false);
                  }
                }
              } catch (_) {}
            }, 380);
          } catch (_) {}
        }
      } catch {
        if (!cancelled) setYukaCameraError(true);
      }
    })();

    return () => {
      cancelled = true;
      stopYukaCamera();
    };
  }, [activeTab, scanMode, isScanning, currentResult, currentImagePreview]);

  const captureYukaFrame = async () => {
    const vid = yukaVideoRef.current;
    if (!vid || vid.readyState < 2) {
      cameraInputRef.current?.click();
      return;
    }
    const maxDim = 1024;
    let w = vid.videoWidth || 720;
    let h = vid.videoHeight || 720;
    if (w > maxDim || h > maxDim) {
      if (w > h) {
        h = Math.round((h * maxDim) / w);
        w = maxDim;
      } else {
        w = Math.round((w * maxDim) / h);
        h = maxDim;
      }
    }
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(vid, 0, 0, w, h);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    const base64 = dataUrl.split(',')[1];
    stopYukaCamera();
    await processImage({ base64, mimeType: 'image/jpeg', dataUrl });
  };

  const handleTextMealAnalyze = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const txt = mealTextInput.trim();
    if (!txt || isScanning) return;
    setIsScanning(true);
    setErrorMessage(null);
    setCurrentResult(null);
    setSaveSuccess(false);
    setCurrentImagePreview(null);
    setScanStep(isEn ? 'Aurelius calculating macros & Yuka score...' : 'Calcul des macros & score Yuka...');
    try {
      const result = await analyzeTextMealWithAurelius(txt, {
        language: isEn ? 'en' : 'fr',
        mealType: selectedMealType,
        dateKey: activeDateKey,
      });
      setCurrentResult(result);
    } catch (err: any) {
      setErrorMessage(err?.message || (isEn ? 'Analysis failed.' : 'Échec de l’analyse.'));
    } finally {
      setIsScanning(false);
    }
  };

  const handleFixMeal = async (meal: CalAiAnalysisResult, isSavedInJournal: boolean, overrideText?: string) => {
    const correction = (overrideText ?? fixText).trim();
    if (!correction || isFixing) return;
    setIsFixing(true);
    setErrorMessage(null);
    try {
      const fixed = await fixMealWithAurelius(meal, correction, isEn ? 'en' : 'fr');
      if (isSavedInJournal) {
        saveLoggedMeal(fixed);
        refreshJournal(activeDateKey);
      } else {
        setCurrentResult(fixed);
      }
      setFixTargetId(null);
      setFixText('');
    } catch (err: any) {
      setErrorMessage(err?.message || (isEn ? 'Could not apply fix.' : 'Impossible d’appliquer la correction.'));
    } finally {
      setIsFixing(false);
    }
  };

  const handleHydrationDelta = (deltaMl: number) => {
    const next = saveDailyHydrationMl(hydrationMl + deltaMl, activeDateKey);
    setHydrationMl(next);
  };

  const handleSaveTargets = () => {
    const clean: CalAiDailyTarget = {
      calories: Math.max(800, Math.min(6000, Math.round(targetDraft.calories) || 2200)),
      protein: Math.max(20, Math.min(400, Math.round(targetDraft.protein) || 140)),
      carbs: Math.max(20, Math.min(800, Math.round(targetDraft.carbs) || 240)),
      fat: Math.max(10, Math.min(300, Math.round(targetDraft.fat) || 65)),
    };
    saveDailyTargets(clean);
    setDailyTargets(clean);
    setIsEditingTargets(false);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    try {
      setScanStep(isEn ? 'Optimizing photo...' : 'Traitement de la capture...');
      setIsScanning(true);
      const compressed = await compressImageToDataUrl(file);
      await processImage(compressed);
    } catch (err: any) {
      console.error('[Aurelius Nutrition] Erreur compression:', err);
      setIsScanning(false);
      setErrorMessage(isEn ? 'Error loading image' : 'Erreur lors du chargement de la photo');
    }
  };

  const handleSaveMeal = async () => {
    if (!currentResult) return;
    const thumbnailUrl = currentImagePreview
      ? await compressThumbnailDataUrl(currentImagePreview)
      : undefined;
    const toSave: CalAiAnalysisResult = {
      ...currentResult,
      dateKey: activeDateKey,
      mealType: selectedMealType,
      imageUrl: thumbnailUrl,
    };
    saveLoggedMeal(toSave);
    setSaveSuccess(true);
    refreshJournal(activeDateKey);
    setTimeout(() => {
      setSaveSuccess(false);
      setActiveTab('journal');
    }, 700);
  };

  const handleDeleteMeal = (id: string) => {
    deleteLoggedMeal(id, activeDateKey);
    refreshJournal(activeDateKey);
  };

  const activeKcalBurned = weekData?.[selectedDay]?.activeKcal || 0;
  const calPercent = Math.min(100, Math.round((dailySummary.calories / dailyTargets.calories) * 100));
  const proteinPercent = Math.min(100, Math.round((dailySummary.protein / dailyTargets.protein) * 100));
  const carbsPercent = Math.min(100, Math.round((dailySummary.carbs / dailyTargets.carbs) * 100));
  const fatPercent = Math.min(100, Math.round((dailySummary.fat / dailyTargets.fat) * 100));

  const innerBody = (
    <>
        {/* Onglets Aurel Nutrition */}
        <div style={{ display: 'flex', padding: embedded ? '0 0 10px 0' : '10px 18px', gap: '8px' }}>
          <button
            type="button"
            onClick={() => setActiveTab('scan')}
            style={{
              flex: 1,
              padding: '9px 12px',
              borderRadius: '14px',
              background: activeTab === 'scan'
                ? accentSoft
                : 'rgba(255, 255, 255, 0.03)',
              border: activeTab === 'scan' ? `1px solid ${accentBorder}` : '1px solid rgba(255, 248, 240, 0.08)',
              color: activeTab === 'scan' ? '#FAF7F2' : 'rgba(250, 247, 242, 0.5)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              boxShadow: activeTab === 'scan' ? '0 4px 16px rgba(0, 0, 0, 0.4)' : 'none',
              transition: 'all 0.18s ease',
            }}
          >
            <Camera size={15} color={activeTab === 'scan' ? accentLight : 'rgba(250, 247, 242, 0.5)'} />
            {isEn ? 'Scan Plate' : 'Scanner un plat'}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('journal')}
            style={{
              flex: 1,
              padding: '9px 12px',
              borderRadius: '14px',
              background: activeTab === 'journal'
                ? accentSoft
                : 'rgba(255, 255, 255, 0.03)',
              border: activeTab === 'journal' ? `1px solid ${accentBorder}` : '1px solid rgba(255, 248, 240, 0.08)',
              color: activeTab === 'journal' ? '#FAF7F2' : 'rgba(250, 247, 242, 0.5)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              boxShadow: activeTab === 'journal' ? '0 4px 16px rgba(0, 0, 0, 0.4)' : 'none',
              transition: 'all 0.18s ease',
            }}
          >
            <Utensils size={15} color={activeTab === 'journal' ? accentLight : 'rgba(250, 247, 242, 0.5)'} />
            {isEn ? `Daily Journal (${dailySummary.mealCount})` : `Journal Aurel (${dailySummary.mealCount})`}
          </button>
        </div>

        {/* Sélecteur de jour (Historique & saisie jour par jour) */}
        <div
          style={{
            margin: embedded ? '0 0 10px 0' : '0 18px 10px 18px',
            padding: '7px 10px',
            borderRadius: '14px',
            background: 'rgba(255, 255, 255, 0.035)',
            border: '1px solid rgba(255, 248, 240, 0.09)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <button
            type="button"
            onClick={() => setActiveDateKey((k) => shiftDateKey(k, -1))}
            aria-label={isEn ? 'Previous day' : 'Jour précédent'}
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '9px',
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 248, 240, 0.1)',
              color: '#FAF7F2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <ChevronLeft size={15} />
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Calendar size={13} color={accent} />
            <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#FAF7F2', textTransform: 'capitalize' }}>
              {formatDateKeyLabel(activeDateKey, isEn)}
            </span>
          </div>

          <button
            type="button"
            disabled={activeDateKey >= todayKey}
            onClick={() => setActiveDateKey((k) => (k < todayKey ? shiftDateKey(k, 1) : k))}
            aria-label={isEn ? 'Next day' : 'Jour suivant'}
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '9px',
              background: activeDateKey >= todayKey ? 'rgba(255, 255, 255, 0.02)' : 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              color: activeDateKey >= todayKey ? 'rgba(250, 247, 242, 0.25)' : '#FAF7F2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: activeDateKey >= todayKey ? 'default' : 'pointer',
            }}
          >
            <ChevronRight size={15} />
          </button>
        </div>

        {/* Carte Énergie & Métabolisme de la journée */}
        <div
          style={{
            margin: embedded ? '0 0 12px 0' : '0 18px 12px 18px',
            padding: '14px 16px',
            borderRadius: '22px',
            background: isMono
              ? 'radial-gradient(ellipse at 50% 115%, rgba(255, 255, 255, 0.1) 0%, rgba(10, 10, 12, 0.96) 80%), #0A0A0C'
              : 'radial-gradient(ellipse at 50% 120%, rgba(192, 132, 252, 0.2) 0%, rgba(168, 85, 247, 0.06) 44%, rgba(10, 10, 12, 0.96) 78%), #0A0A0C',
            borderTop: '1px solid rgba(255, 248, 240, 0.14)',
            borderLeft: '1px solid rgba(255, 248, 240, 0.1)',
            borderRight: '1px solid rgba(255, 248, 240, 0.1)',
            borderBottom: isMono ? '1.5px solid rgba(255, 255, 255, 0.35)' : '1.5px solid rgba(192, 132, 252, 0.5)',
            boxShadow: isMono
              ? '0 10px 24px rgba(0, 0, 0, 0.55)'
              : '0 10px 26px rgba(0, 0, 0, 0.55), 0 4px 16px rgba(192, 132, 252, 0.1)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
              <span style={{ fontSize: '24px', fontWeight: 300, color: '#FAF7F2', letterSpacing: '-0.5px' }}>
                {dailySummary.calories.toLocaleString()}
              </span>
              <span style={{ fontSize: '12px', color: 'rgba(250, 247, 242, 0.5)' }}>
                / {dailyTargets.calories.toLocaleString()} kcal
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {dailySummary.avgYukaScore !== null && (() => {
                const yMeta = getYukaMeta(dailySummary.avgYukaScore, isEn);
                return (
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      padding: '3px 8px',
                      borderRadius: '999px',
                      color: yMeta.color,
                      background: yMeta.bg,
                      border: `1px solid ${yMeta.border}`,
                    }}
                  >
                    Yuka {dailySummary.avgYukaScore}/100
                  </span>
                );
              })()}
              <button
                type="button"
                onClick={() => {
                  setTargetDraft(dailyTargets);
                  setIsEditingTargets((v) => !v);
                }}
                aria-label={isEn ? 'Edit targets' : 'Modifier les objectifs'}
                style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: '8px',
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: 'rgba(250, 247, 242, 0.7)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <Pencil size={12} />
              </button>
            </div>
          </div>

          {isEditingTargets && (
            <div
              style={{
                padding: '10px',
                borderRadius: '14px',
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                marginBottom: '10px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                {([
                  { key: 'calories', label: 'Kcal' },
                  { key: 'protein', label: 'Prot (g)' },
                  { key: 'carbs', label: 'Gluc (g)' },
                  { key: 'fat', label: 'Lip (g)' },
                ] as const).map((fld) => (
                  <label key={fld.key} style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '10px', color: 'rgba(250, 247, 242, 0.6)' }}>
                    {fld.label}
                    <input
                      type="number"
                      value={targetDraft[fld.key]}
                      onChange={(e) => setTargetDraft((prev) => ({ ...prev, [fld.key]: Number(e.target.value) }))}
                      style={{
                        width: '100%',
                        padding: '5px 6px',
                        borderRadius: '8px',
                        background: 'rgba(0, 0, 0, 0.4)',
                        border: '1px solid rgba(255, 255, 255, 0.14)',
                        color: '#FAF7F2',
                        fontSize: '12px',
                        fontWeight: 600,
                      }}
                    />
                  </label>
                ))}
              </div>
              <button
                type="button"
                onClick={handleSaveTargets}
                style={{
                  padding: '6px 10px',
                  borderRadius: '10px',
                  background: accentSoft,
                  border: `1px solid ${accentBorder}`,
                  color: accentLight,
                  fontSize: '11.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {isEn ? 'Save Daily Targets' : 'Enregistrer les objectifs'}
              </button>
            </div>
          )}

          {/* Jauge Principale d'Énergie */}
          <div
            style={{
              height: '5px',
              background: 'rgba(255, 255, 255, 0.09)',
              borderRadius: '999px',
              overflow: 'hidden',
              marginBottom: '10px',
            }}
          >
            <div
              style={{
                width: `${calPercent}%`,
                height: '100%',
                background: isMono
                  ? 'linear-gradient(90deg, rgba(250,247,242,0.7) 0%, #FAF7F2 100%)'
                  : 'linear-gradient(90deg, #A855F7 0%, #C084FC 55%, #D8B4FE 100%)',
                borderRadius: '999px',
                transition: 'width 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            />
          </div>

          {/* Triade des Macronutriments */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
            {/* Protéines */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px' }}>
                <span style={{ color: 'rgba(250, 247, 242, 0.6)' }}>{isEn ? 'Protein' : 'Protéines'}</span>
                <span style={{ color: proteinTint, fontWeight: 700 }}>{dailySummary.protein}g</span>
              </div>
              <div style={{ height: '3px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ width: `${proteinPercent}%`, height: '100%', background: proteinTint, borderRadius: '2px' }} />
              </div>
            </div>

            {/* Glucides */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px' }}>
                <span style={{ color: 'rgba(250, 247, 242, 0.6)' }}>{isEn ? 'Carbs' : 'Glucides'}</span>
                <span style={{ color: carbsTint, fontWeight: 700 }}>{dailySummary.carbs}g</span>
              </div>
              <div style={{ height: '3px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ width: `${carbsPercent}%`, height: '100%', background: carbsTint, borderRadius: '2px' }} />
              </div>
            </div>

            {/* Lipides */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px' }}>
                <span style={{ color: 'rgba(250, 247, 242, 0.6)' }}>{isEn ? 'Fat' : 'Lipides'}</span>
                <span style={{ color: fatTint, fontWeight: 700 }}>{dailySummary.fat}g</span>
              </div>
              <div style={{ height: '3px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ width: `${fatPercent}%`, height: '100%', background: fatTint, borderRadius: '2px' }} />
              </div>
            </div>
          </div>

          {/* Écosystème : Bilan Bague + Hydratation */}
          <div
            style={{
              marginTop: '11px',
              paddingTop: '10px',
              borderTop: '1px solid rgba(255, 255, 255, 0.07)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'rgba(250, 247, 242, 0.7)' }}>
              <Flame size={13} color="#FB923C" />
              <span>
                {isEn ? 'Ring burned:' : 'Brûlés bague :'} <strong style={{ color: '#FAF7F2' }}>{activeKcalBurned} kcal</strong>
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Droplets size={13} color="#38BDF8" />
              <span style={{ fontSize: '11px', color: '#FAF7F2', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                {(hydrationMl / 1000).toFixed(2).replace(/\.00$/, '')}L / 2L
              </span>
              <button
                type="button"
                onClick={() => handleHydrationDelta(-250)}
                aria-label="Retirer 250ml"
                style={{
                  width: '22px',
                  height: '22px',
                  borderRadius: '7px',
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: 'rgba(250, 247, 242, 0.7)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <Minus size={11} />
              </button>
              <button
                type="button"
                onClick={() => handleHydrationDelta(250)}
                aria-label="Ajouter 250ml"
                style={{
                  padding: '2px 7px',
                  height: '22px',
                  borderRadius: '7px',
                  background: 'rgba(56, 189, 248, 0.15)',
                  border: '1px solid rgba(56, 189, 248, 0.35)',
                  color: '#38BDF8',
                  fontSize: '10px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '2px',
                  cursor: 'pointer',
                }}
              >
                <Plus size={10} /> 250ml
              </button>
            </div>
          </div>
        </div>

        {/* Inputs cachés pour Photo ou Galerie */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />

        {/* Zone de Contenu Déroulant */}
        <div
          key={activeTab}
          className="subtab-view"
          style={
            embedded
              ? { display: 'flex', flexDirection: 'column', gap: '12px' }
              : { flex: 1, overflowY: 'auto', padding: '0 18px 24px 18px' }
          }
        >
          {activeTab === 'scan' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Sélecteur 3 Modes : Plat (Photo) | Produit Yuka (Code-barres) | Décrire */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '6px',
                  padding: '4px',
                  borderRadius: '14px',
                  background: 'rgba(255, 255, 255, 0.035)',
                  border: '1px solid rgba(255, 255, 255, 0.07)',
                }}
              >
                {([
                  { id: 'plate', label: isEn ? 'Plate' : 'Plat', icon: <Camera size={13} /> },
                  { id: 'yuka', label: isEn ? 'Yuka Scan' : 'Produit Yuka', icon: <ScanBarcode size={13} /> },
                  { id: 'text', label: isEn ? 'Describe' : 'Décrire', icon: <Type size={13} /> },
                ] as const).map((m) => {
                  const active = scanMode === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setScanMode(m.id);
                        setErrorMessage(null);
                      }}
                      style={{
                        padding: '8px 6px',
                        borderRadius: '10px',
                        background: active ? accentSoft : 'transparent',
                        border: active ? `1px solid ${accentBorder}` : '1px solid transparent',
                        color: active ? '#FAF7F2' : 'rgba(250, 247, 242, 0.55)',
                        fontSize: '11.5px',
                        fontWeight: active ? 700 : 500,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '5px',
                        cursor: 'pointer',
                      }}
                    >
                      {m.icon}
                      <span>{m.label}</span>
                    </button>
                  );
                })}
              </div>

              {scanMode === 'text' ? (
                <form
                  onSubmit={handleTextMealAnalyze}
                  style={{
                    padding: '14px',
                    borderRadius: '20px',
                    background: 'rgba(255, 255, 255, 0.035)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}
                >
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#FAF7F2' }}>
                    {isEn ? 'Describe what you ate' : 'Décrivez votre repas à Aurelius'}
                  </span>
                  <textarea
                    rows={3}
                    value={mealTextInput}
                    onChange={(e) => setMealTextInput(e.target.value)}
                    placeholder={isEn ? 'e.g. 2 fried eggs, 100g avocado, 2 slices sourdough bread, 1 tbsp olive oil' : 'Ex : 2 œufs au plat, 100g d’avocat, 2 tranches de pain complet, 1 càs d’huile d’olive'}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '12px',
                      background: 'rgba(0, 0, 0, 0.45)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      color: '#FAF7F2',
                      fontSize: '12.5px',
                      resize: 'none',
                      outline: 'none',
                    }}
                  />
                  <button
                    type="submit"
                    disabled={isScanning || !mealTextInput.trim()}
                    style={{
                      padding: '12px',
                      borderRadius: '14px',
                      background: accentSoft,
                      border: `1px solid ${accentBorder}`,
                      color: '#FAF7F2',
                      fontSize: '13px',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '7px',
                      cursor: 'pointer',
                    }}
                  >
                    <Sparkles size={15} color={accentLight} />
                    <span>{isScanning ? scanStep : (isEn ? 'Analyze & Score (Yuka)' : 'Calculer Calories & Note Yuka')}</span>
                  </button>
                </form>
              ) : (
                <>
              {/* Cadre de Capture Aurel */}
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  aspectRatio: currentImagePreview || (scanMode === 'yuka' && !yukaCameraError) ? '4/3' : '16/9',
                  borderRadius: '24px',
                  overflow: 'hidden',
                  background: '#0A0A0C',
                  border: '1px solid rgba(255, 248, 240, 0.14)',
                  boxShadow: 'inset 0 0 30px rgba(0, 0, 0, 0.6)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {currentImagePreview ? (
                  <>
                    <img
                      src={currentImagePreview}
                      alt="Capture repas"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    {/* Overlay d'Analyse Aurelius avec AureliusOrb */}
                    {isScanning && (
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          background: 'rgba(10, 10, 12, 0.84)',
                          backdropFilter: 'blur(8px)',
                          WebkitBackdropFilter: 'blur(8px)',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '12px',
                          zIndex: 5,
                        }}
                      >
                        <AureliusOrb status="thinking" size={130} accentMode={isMono ? 'mono' : 'amethyst'} />
                        <span
                          style={{
                            color: '#FAF7F2',
                            fontSize: '13px',
                            fontWeight: 600,
                            letterSpacing: '-0.2px',
                            textShadow: '0 2px 10px rgba(0, 0, 0, 0.8)',
                            padding: '4px 12px',
                            borderRadius: '999px',
                            background: accentSoft,
                            border: `1px solid ${accentBorder}`,
                          }}
                        >
                          {scanStep}
                        </span>
                      </div>
                    )}
                  </>
                ) : scanMode === 'yuka' && !yukaCameraError ? (
                  <>
                    <video
                      ref={yukaVideoRef}
                      autoPlay
                      playsInline
                      muted
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    {/* Viseur Yuka avec coins + ligne laser */}
                    <div style={{ position: 'absolute', inset: '18% 12%', pointerEvents: 'none' }}>
                      <div style={{ position: 'absolute', top: 0, left: 0, width: '20px', height: '20px', borderTop: '3px solid #22C55E', borderLeft: '3px solid #22C55E', borderRadius: '6px 0 0 0' }} />
                      <div style={{ position: 'absolute', top: 0, right: 0, width: '20px', height: '20px', borderTop: '3px solid #22C55E', borderRight: '3px solid #22C55E', borderRadius: '0 6px 0 0' }} />
                      <div style={{ position: 'absolute', bottom: 0, left: 0, width: '20px', height: '20px', borderBottom: '3px solid #22C55E', borderLeft: '3px solid #22C55E', borderRadius: '0 0 0 6px' }} />
                      <div style={{ position: 'absolute', bottom: 0, right: 0, width: '20px', height: '20px', borderBottom: '3px solid #22C55E', borderRight: '3px solid #22C55E', borderRadius: '0 0 6px 0' }} />
                      <div
                        style={{
                          position: 'absolute',
                          left: '6%',
                          right: '6%',
                          top: '50%',
                          height: '2px',
                          background: 'linear-gradient(90deg, transparent, #22C55E, transparent)',
                          boxShadow: '0 0 12px #22C55E',
                          animation: 'pulse 1.5s ease-in-out infinite',
                        }}
                      />
                    </div>
                    <div
                      style={{
                        position: 'absolute',
                        bottom: '10px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        padding: '4px 12px',
                        borderRadius: '999px',
                        background: 'rgba(10, 10, 12, 0.78)',
                        border: '1px solid rgba(255, 255, 255, 0.16)',
                        color: '#FAF7F2',
                        fontSize: '11px',
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {yukaCameraReady
                        ? (isEn ? 'Point at barcode or nutrition label' : 'Visez le code-barres ou l’étiquette')
                        : (isEn ? 'Starting camera...' : 'Activation caméra…')}
                    </div>
                  </>
                ) : (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '24px 16px',
                      textAlign: 'center',
                    }}
                  >
                    <div
                      style={{
                        width: '58px',
                        height: '58px',
                        borderRadius: '50%',
                        background: accentSoft,
                        border: `1px solid ${accentBorder}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: accent,
                        boxShadow: isMono ? 'none' : '0 0 22px rgba(192, 132, 252, 0.24)',
                      }}
                    >
                      <Camera size={24} strokeWidth={1.8} />
                    </div>
                    <div>
                      <div style={{ fontSize: '16px', fontWeight: 600, color: '#FAF7F2', letterSpacing: '-0.2px' }}>
                        {scanMode === 'yuka'
                          ? (isEn ? 'Scan barcode or label' : 'Scannez un produit ou code-barres')
                          : (isEn ? 'Capture your dish' : 'Capturez votre assiette')}
                      </div>
                      <div style={{ fontSize: '12px', color: 'rgba(250, 247, 242, 0.55)', marginTop: '3px', maxWidth: '280px' }}>
                        {scanMode === 'yuka'
                          ? (isEn ? 'Yuka score 0–100, additives, Nutri-Score & healthier swaps' : 'Note Yuka 0–100, additifs, Nutri-Score & alternatives plus saines')
                          : (isEn ? 'Aurelius identifies foods, weights, calories, and macros' : 'Aurelius identifie les aliments, portions, calories et macronutriments')}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Boutons d'Action Photos */}
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  disabled={isScanning}
                  onClick={() => {
                    if (scanMode === 'yuka' && yukaCameraReady && !currentImagePreview && !currentResult) {
                      captureYukaFrame();
                    } else {
                      setCurrentImagePreview(null);
                      setCurrentResult(null);
                      if (scanMode !== 'yuka' || yukaCameraError) {
                        cameraInputRef.current?.click();
                      }
                    }
                  }}
                  style={{
                    flex: 1.2,
                    padding: '13px',
                    borderRadius: '16px',
                    background: isMono
                      ? 'rgba(255, 255, 255, 0.14)'
                      : 'linear-gradient(135deg, rgba(192, 132, 252, 0.28) 0%, rgba(168, 85, 247, 0.2) 100%), #0A0A0C',
                    border: `1px solid ${accentBorder}`,
                    color: '#FAF7F2',
                    fontWeight: 700,
                    fontSize: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    boxShadow: isMono
                      ? '0 6px 20px rgba(0, 0, 0, 0.5)'
                      : '0 6px 20px rgba(0, 0, 0, 0.5), 0 0 18px rgba(192, 132, 252, 0.18)',
                    transition: 'all 0.18s ease',
                  }}
                >
                  <Camera size={17} strokeWidth={2} color={accentLight} />
                  {scanMode === 'yuka' && yukaCameraReady && !currentResult
                    ? (isEn ? 'Scan Product' : 'Scanner le produit')
                    : (isEn ? 'Take Photo' : 'Prendre une photo')}
                </button>

                <button
                  type="button"
                  disabled={isScanning}
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    flex: 1,
                    padding: '13px',
                    borderRadius: '16px',
                    background: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid rgba(255, 255, 255, 0.14)',
                    color: 'rgba(250, 247, 242, 0.85)',
                    fontWeight: 600,
                    fontSize: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                    transition: 'background 0.18s ease',
                  }}
                >
                  <ImageIcon size={16} />
                  {isEn ? 'Photo Library' : 'Photothèque'}
                </button>
              </div>
                </>
              )}

              {/* Message d'Erreur Élégant */}
              {errorMessage && (
                <div
                  style={{
                    padding: '12px 16px',
                    borderRadius: '16px',
                    background: 'rgba(255, 90, 82, 0.12)',
                    border: '1px solid rgba(255, 90, 82, 0.3)',
                    color: '#FF6B6B',
                    fontSize: '12.5px',
                    lineHeight: 1.4,
                  }}
                >
                  {errorMessage}
                </div>
              )}

              {/* RÉSULTAT NUTRITIONNEL ZÉNON */}
              {currentResult && (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '14px',
                    padding: '18px',
                    borderRadius: '24px',
                    background: isMono
                      ? 'radial-gradient(ellipse at 50% 0%, rgba(255, 255, 255, 0.08) 0%, rgba(10, 10, 12, 0.98) 76%), #0A0A0C'
                      : 'radial-gradient(ellipse at 50% 110%, rgba(192, 132, 252, 0.14) 0%, rgba(10, 10, 12, 0.98) 76%), #0A0A0C',
                    border: '1px solid rgba(255, 248, 240, 0.14)',
                    boxShadow: '0 12px 36px rgba(0, 0, 0, 0.7)',
                  }}
                >
                  {/* Nom du plat & Total Calories */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: '18px', fontWeight: 700, color: '#FAF7F2', letterSpacing: '-0.3px' }}>
                        {currentResult.mealName}
                      </div>
                      <div style={{ fontSize: '11.5px', color: accentLight, fontWeight: 600, marginTop: '3px' }}>
                        {isEn ? 'Vitality Index' : 'Indice Vitalité'} : {currentResult.healthScore || 85}/100
                      </div>
                    </div>

                    <div
                      style={{
                        textAlign: 'right',
                        padding: '6px 14px',
                        borderRadius: '16px',
                        background: accentSoft,
                        border: `1px solid ${accentBorder}`,
                        boxShadow: isMono ? 'none' : '0 0 18px rgba(192, 132, 252, 0.18)',
                      }}
                    >
                      <div style={{ fontSize: '24px', fontWeight: 300, color: '#FAF7F2', lineHeight: 1 }}>
                        {currentResult.totalCalories}
                      </div>
                      <div style={{ fontSize: '9.5px', fontWeight: 700, color: accentLight, letterSpacing: '0.06em' }}>
                        KCAL
                      </div>
                    </div>
                  </div>

                  {/* 3 Cartes Macros Aurel */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                    <div
                      style={{
                        padding: '10px 8px',
                        borderRadius: '16px',
                        background: 'rgba(255, 255, 255, 0.04)',
                        border: '1px solid rgba(255, 248, 240, 0.12)',
                        textAlign: 'center',
                      }}
                    >
                      <div style={{ fontSize: '11px', color: 'rgba(250, 247, 242, 0.6)' }}>{isEn ? 'Protein' : 'Protéines'}</div>
                      <div style={{ fontSize: '17px', fontWeight: 700, color: proteinTint, marginTop: '2px' }}>
                        {currentResult.macros.protein}g
                      </div>
                    </div>

                    <div
                      style={{
                        padding: '10px 8px',
                        borderRadius: '16px',
                        background: accentSoft,
                        border: `1px solid ${accentBorder}`,
                        textAlign: 'center',
                      }}
                    >
                      <div style={{ fontSize: '11px', color: 'rgba(250, 247, 242, 0.6)' }}>{isEn ? 'Carbs' : 'Glucides'}</div>
                      <div style={{ fontSize: '17px', fontWeight: 700, color: carbsTint, marginTop: '2px' }}>
                        {currentResult.macros.carbs}g
                      </div>
                    </div>

                    <div
                      style={{
                        padding: '10px 8px',
                        borderRadius: '16px',
                        background: 'rgba(255, 255, 255, 0.04)',
                        border: '1px solid rgba(255, 248, 240, 0.12)',
                        textAlign: 'center',
                      }}
                    >
                      <div style={{ fontSize: '11px', color: 'rgba(250, 247, 242, 0.6)' }}>{isEn ? 'Fat' : 'Lipides'}</div>
                      <div style={{ fontSize: '17px', fontWeight: 700, color: fatTint, marginTop: '2px' }}>
                        {currentResult.macros.fat}g
                      </div>
                    </div>
                  </div>

                  {/* Décomposition des aliments */}
                  {currentResult.items && currentResult.items.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(250, 247, 242, 0.7)' }}>
                        {isEn ? 'Decomposed ingredients :' : 'Ingrédients & portions décomposés :'}
                      </span>
                      {currentResult.items.map((it, idx) => (
                        <div
                          key={idx}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '8px 12px',
                            borderRadius: '12px',
                            background: 'rgba(255, 255, 255, 0.035)',
                            border: '1px solid rgba(255, 248, 240, 0.08)',
                            fontSize: '12.5px',
                          }}
                        >
                          <div style={{ color: '#FAF7F2' }}>
                            {it.name} <span style={{ color: 'rgba(250, 247, 242, 0.45)', fontSize: '11px' }}>({it.portion})</span>
                          </div>
                          <div style={{ fontWeight: 700, color: accentLight }}>
                            {it.calories} kcal
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Note Yuka (0–100) + Additifs + Qualités & Défauts */}
                  {(() => {
                    const yScore = currentResult.yuka?.score ?? currentResult.healthScore ?? 80;
                    const yMeta = getYukaMeta(yScore, isEn);
                    const yuka = currentResult.yuka;
                    return (
                      <div
                        style={{
                          padding: '12px 14px',
                          borderRadius: '18px',
                          background: 'rgba(255, 255, 255, 0.03)',
                          border: `1px solid ${yMeta.border}`,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '10px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span
                              style={{
                                width: '12px',
                                height: '12px',
                                borderRadius: '50%',
                                background: yMeta.color,
                                boxShadow: `0 0 10px ${yMeta.color}`,
                              }}
                            />
                            <div>
                              <div style={{ fontSize: '13px', fontWeight: 700, color: '#FAF7F2' }}>
                                {isEn ? 'Yuka Quality' : 'Score Yuka'} · {yScore}/100
                              </div>
                              <div style={{ fontSize: '10.5px', fontWeight: 700, color: yMeta.color }}>
                                {yMeta.label}
                              </div>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                            {yuka?.nutriscore && (
                              <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: '7px', background: 'rgba(255,255,255,0.08)', color: '#FAF7F2' }}>
                                Nutri-Score {yuka.nutriscore}
                              </span>
                            )}
                            {yuka?.novaGroup && (
                              <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: '7px', background: 'rgba(255,255,255,0.08)', color: 'rgba(250,247,242,0.85)' }}>
                                NOVA {yuka.novaGroup}
                              </span>
                            )}
                            {yuka?.isOrganic && (
                              <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: '7px', background: 'rgba(34,197,94,0.18)', color: '#4ADE80' }}>
                                BIO
                              </span>
                            )}
                          </div>
                        </div>

                        {yuka && (yuka.positives.length > 0 || yuka.negatives.length > 0) && (
                          <div style={{ display: 'grid', gridTemplateColumns: yuka.positives.length > 0 && yuka.negatives.length > 0 ? '1fr 1fr' : '1fr', gap: '8px' }}>
                            {yuka.positives.length > 0 && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10.5px', fontWeight: 700, color: '#4ADE80' }}>
                                  <ThumbsUp size={11} />
                                  <span>{isEn ? 'Positives' : 'Qualités'}</span>
                                </div>
                                {yuka.positives.slice(0, 3).map((p, idx) => (
                                  <div key={idx} style={{ fontSize: '10.5px', color: 'rgba(250,247,242,0.82)', lineHeight: 1.3 }}>
                                    • <strong>{p.label}</strong> {p.value ? `(${p.value})` : ''}
                                  </div>
                                ))}
                              </div>
                            )}
                            {yuka.negatives.length > 0 && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10.5px', fontWeight: 700, color: '#FB923C' }}>
                                  <ThumbsDown size={11} />
                                  <span>{isEn ? 'Negatives' : 'Défauts'}</span>
                                </div>
                                {yuka.negatives.slice(0, 3).map((n, idx) => (
                                  <div key={idx} style={{ fontSize: '10.5px', color: 'rgba(250,247,242,0.82)', lineHeight: 1.3 }}>
                                    • <strong>{n.label}</strong> {n.value ? `(${n.value})` : ''}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {yuka && yuka.additives.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', alignItems: 'center' }}>
                            <AlertTriangle size={11} color="#F59E0B" />
                            <span style={{ fontSize: '10.5px', color: 'rgba(250,247,242,0.7)', fontWeight: 600 }}>
                              {isEn ? 'Additives:' : 'Additifs :'}
                            </span>
                            {yuka.additives.slice(0, 5).map((add, idx) => (
                              <span
                                key={idx}
                                style={{
                                  fontSize: '9.5px',
                                  fontWeight: 700,
                                  padding: '2px 6px',
                                  borderRadius: '6px',
                                  background: add.risk === 'high' ? 'rgba(239,68,68,0.18)' : add.risk === 'moderate' ? 'rgba(245,158,11,0.18)' : 'rgba(34,197,94,0.14)',
                                  color: add.risk === 'high' ? '#FCA5A5' : add.risk === 'moderate' ? '#FCD34D' : '#86EFAC',
                                }}
                              >
                                {add.code}
                              </span>
                            ))}
                          </div>
                        )}

                        {yuka?.alternatives && yuka.alternatives.length > 0 && yScore < 75 && (
                          <div style={{ paddingTop: '6px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#4ADE80' }}>
                              {isEn ? 'Healthier swaps:' : 'Alternatives plus saines :'}
                            </span>
                            {yuka.alternatives.slice(0, 2).map((alt, idx) => (
                              <div key={idx} style={{ fontSize: '10.5px', color: 'rgba(250,247,242,0.78)' }}>
                                → <strong>{alt.name}</strong>{alt.brand ? ` (${alt.brand})` : ''} — {alt.reason}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Bouton & Panneau Fix avec Aurelius */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setFixTargetId(fixTargetId === 'current' ? null : 'current');
                        setFixText('');
                      }}
                      style={{
                        padding: '10px 14px',
                        borderRadius: '14px',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: `1px solid ${accentBorder}`,
                        color: accentLight,
                        fontSize: '12.5px',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '7px',
                        cursor: 'pointer',
                      }}
                    >
                      <Wand2 size={14} />
                      <span>{isEn ? 'Fix with Aurelius (missing item / portion)' : 'Fix avec Aurelius (oubli, portion, sauce…)'}</span>
                    </button>

                    {fixTargetId === 'current' && (
                      <div
                        style={{
                          padding: '11px',
                          borderRadius: '16px',
                          background: 'rgba(255, 255, 255, 0.04)',
                          border: `1px solid ${accentBorder}`,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                        }}
                      >
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                          {(isEn
                            ? ['+ 1 tbsp olive oil', '+ Sauce / dressing', 'Portion x1.5', 'Portion x0.5']
                            : ['+ Huile d’olive (1 càs)', '+ Sauce / mayo', 'Portion x1.5', 'Portion x0.5']
                          ).map((chip) => (
                            <button
                              key={chip}
                              type="button"
                              disabled={isFixing}
                              onClick={() => handleFixMeal(currentResult, false, chip)}
                              style={{
                                padding: '4px 9px',
                                borderRadius: '999px',
                                background: 'rgba(255, 255, 255, 0.07)',
                                border: '1px solid rgba(255, 255, 255, 0.14)',
                                color: '#FAF7F2',
                                fontSize: '10.5px',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              {chip}
                            </button>
                          ))}
                        </div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <input
                            type="text"
                            value={fixText}
                            onChange={(e) => setFixText(e.target.value)}
                            placeholder={isEn ? 'e.g. Forgot 2 eggs and 30g cheese…' : 'Ex : Tu as oublié 2 œufs et la sauce…'}
                            style={{
                              flex: 1,
                              padding: '9px 11px',
                              borderRadius: '11px',
                              background: 'rgba(0, 0, 0, 0.45)',
                              border: '1px solid rgba(255, 255, 255, 0.14)',
                              color: '#FAF7F2',
                              fontSize: '12px',
                              outline: 'none',
                            }}
                          />
                          <button
                            type="button"
                            disabled={isFixing || !fixText.trim()}
                            onClick={() => handleFixMeal(currentResult, false)}
                            style={{
                              padding: '0 12px',
                              borderRadius: '11px',
                              background: accentSoft,
                              border: `1px solid ${accentBorder}`,
                              color: '#FAF7F2',
                              fontSize: '12px',
                              fontWeight: 700,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              cursor: 'pointer',
                            }}
                          >
                            <Send size={13} />
                            <span>{isFixing ? '...' : 'Fix'}</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Synthèse Aurelius */}
                  {currentResult.advice && (
                    <div
                      style={{
                        padding: '12px 14px',
                        borderRadius: '16px',
                        background: accentSoft,
                        border: `1px solid ${accentBorder}`,
                        fontSize: '12px',
                        color: 'rgba(250, 247, 242, 0.92)',
                        lineHeight: 1.45,
                      }}
                    >
                      <strong style={{ color: accentLight }}>{isEn ? 'Aurelius Summary:' : 'Synthèse Aurelius :'}</strong> {currentResult.advice}
                    </div>
                  )}

                  {/* Sélecteur de Type de Repas */}
                  <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                    {(['breakfast', 'lunch', 'dinner', 'snack'] as const).map((t) => {
                      const labels = {
                        breakfast: isEn ? 'Breakfast' : 'Petit-déj',
                        lunch: isEn ? 'Lunch' : 'Déjeuner',
                        dinner: isEn ? 'Dinner' : 'Dîner',
                        snack: isEn ? 'Snack' : 'Collation',
                      };
                      const active = selectedMealType === t;
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setSelectedMealType(t)}
                          style={{
                            flex: 1,
                            padding: '7px 4px',
                            borderRadius: '12px',
                            background: active ? accentSoft : 'rgba(255, 255, 255, 0.04)',
                            border: active ? `1px solid ${accentBorder}` : '1px solid rgba(255, 248, 240, 0.08)',
                            color: active ? accentLight : 'rgba(250, 247, 242, 0.6)',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.18s ease',
                          }}
                        >
                          {labels[t]}
                        </button>
                      );
                    })}
                  </div>

                  {/* Bouton Enregistrer au Journal */}
                  <button
                    type="button"
                    onClick={handleSaveMeal}
                    style={{
                      marginTop: '6px',
                      padding: '14px',
                      borderRadius: '16px',
                      background: isMono
                        ? saveSuccess
                          ? '#FAF7F2'
                          : 'rgba(255, 255, 255, 0.16)'
                        : saveSuccess
                        ? 'linear-gradient(135deg, #D8B4FE 0%, #A855F7 100%)'
                        : 'linear-gradient(135deg, #C084FC 0%, #9333EA 100%)',
                      border: `1px solid ${accentBorder}`,
                      color: isMono && saveSuccess ? '#0A0A0C' : '#FAF7F2',
                      fontWeight: 700,
                      fontSize: '14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      cursor: 'pointer',
                      boxShadow: isMono
                        ? '0 6px 20px rgba(0, 0, 0, 0.5)'
                        : '0 6px 20px rgba(0, 0, 0, 0.5), 0 0 20px rgba(192, 132, 252, 0.3)',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    {saveSuccess ? (
                      <>
                        <Check size={18} />
                        {isEn ? 'Logged to Journal!' : 'Enregistré dans le Journal Aurel !'}
                      </>
                    ) : (
                      <>
                        <Plus size={18} />
                        {isEn ? 'Log Meal to Journal' : 'Ajouter à ma journée'}
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* ONGLET JOURNAL STOÏCIEN */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {loggedDates.length > 0 && (
                <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px', scrollbarWidth: 'none' }}>
                  {loggedDates.map((dInfo) => {
                    const isSelected = dInfo.dateKey === activeDateKey;
                    const [, mm, dd] = dInfo.dateKey.split('-');
                    return (
                      <button
                        key={dInfo.dateKey}
                        type="button"
                        onClick={() => setActiveDateKey(dInfo.dateKey)}
                        style={{
                          flexShrink: 0,
                          padding: '6px 10px',
                          borderRadius: '11px',
                          background: isSelected ? accentSoft : 'rgba(255, 255, 255, 0.04)',
                          border: isSelected ? `1px solid ${accentBorder}` : '1px solid rgba(255, 248, 240, 0.08)',
                          color: isSelected ? '#FAF7F2' : 'rgba(250, 247, 242, 0.65)',
                          fontSize: '11px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        {dd}/{mm} · {dInfo.mealCount} ({dInfo.calories} kcal)
                      </button>
                    );
                  })}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#FAF7F2' }}>
                  {activeDateKey === todayKey
                    ? (isEn ? "Today's Nutrition Log" : "Journal de la journée")
                    : (isEn ? 'Day Nutrition Log' : 'Journal du jour')}
                </span>
                <button
                  type="button"
                  onClick={() => setActiveTab('scan')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '10px',
                    background: accentSoft,
                    border: `1px solid ${accentBorder}`,
                    color: accentLight,
                    fontSize: '11.5px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <Plus size={14} />
                  {isEn ? 'Scan another' : 'Scanner un autre'}
                </button>
              </div>

              {loggedMeals.length === 0 ? (
                <div
                  style={{
                    padding: '40px 18px',
                    textAlign: 'center',
                    background: 'rgba(255, 255, 255, 0.03)',
                    borderRadius: '20px',
                    border: '1px dashed rgba(255, 255, 255, 0.12)',
                  }}
                >
                  <Utensils size={32} color="rgba(250, 247, 242, 0.3)" style={{ marginBottom: '8px' }} />
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#FAF7F2' }}>
                    {activeDateKey === todayKey
                      ? (isEn ? 'No meals logged today' : 'Aucun repas enregistré aujourd’hui')
                      : (isEn ? 'No meals logged for this day' : 'Aucun repas enregistré pour ce jour')}
                  </div>
                  <div style={{ fontSize: '12px', color: 'rgba(250, 247, 242, 0.5)', marginTop: '4px' }}>
                    {isEn ? 'Scan a meal to start tracking biometrics & macros' : 'Prenez une photo de votre plat pour suivre vos calories & nutriments'}
                  </div>
                </div>
              ) : (
                loggedMeals.map((m) => {
                  const typeLabel = {
                    breakfast: isEn ? 'Breakfast' : 'Petit-déjeuner',
                    lunch: isEn ? 'Lunch' : 'Déjeuner',
                    dinner: isEn ? 'Dinner' : 'Dîner',
                    snack: isEn ? 'Snack' : 'Collation',
                  }[m.mealType];

                  const jScore = m.yuka?.score ?? m.healthScore;
                  const jMeta = jScore ? getYukaMeta(jScore, isEn) : null;
                  const isExpanded = expandedJournalId === m.id;
                  const isFixOpen = fixTargetId === m.id;

                  return (
                    <div
                      key={m.id}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px',
                        padding: '12px 14px',
                        borderRadius: '18px',
                        background: 'rgba(255, 255, 255, 0.04)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          cursor: 'pointer',
                        }}
                        onClick={() => setExpandedJournalId(isExpanded ? null : m.id)}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                          {m.imageUrl ? (
                            <img
                              src={m.imageUrl}
                              alt={m.mealName}
                              style={{ width: '46px', height: '46px', borderRadius: '12px', objectFit: 'cover', flexShrink: 0 }}
                            />
                          ) : (
                            <div
                              style={{
                                width: '46px',
                                height: '46px',
                                borderRadius: '12px',
                                background: 'rgba(255, 255, 255, 0.07)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                              }}
                            >
                              <Utensils size={20} color="rgba(250, 247, 242, 0.5)" />
                            </div>
                          )}
                          <div style={{ minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: '14px', fontWeight: 600, color: '#FAF7F2' }}>
                                {m.mealName}
                              </span>
                              {jMeta && jScore && (
                                <span
                                  style={{
                                    fontSize: '9.5px',
                                    fontWeight: 700,
                                    padding: '1px 6px',
                                    borderRadius: '999px',
                                    color: jMeta.color,
                                    background: jMeta.bg,
                                    border: `1px solid ${jMeta.border}`,
                                  }}
                                >
                                  Yuka {jScore}
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '11px', color: 'rgba(250, 247, 242, 0.45)', marginTop: '1px' }}>
                              {typeLabel} · {m.timestamp}
                            </div>
                            <div style={{ fontSize: '10.5px', color: 'rgba(250, 247, 242, 0.65)', marginTop: '2px' }}>
                              P: {m.macros?.protein}g · {isEn ? 'C' : 'G'}: {m.macros?.carbs}g · {isEn ? 'F' : 'L'}: {m.macros?.fat}g
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                          <div style={{ textAlign: 'right' }}>
                            <span style={{ fontSize: '16px', fontWeight: 300, color: '#FAF7F2' }}>
                              {m.totalCalories}
                            </span>
                            <span style={{ fontSize: '10px', color: accentLight, marginLeft: '3px', fontWeight: 700 }}>
                              kcal
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setFixTargetId(isFixOpen ? null : m.id);
                              setFixText('');
                            }}
                            title={isEn ? 'Fix with Aurelius' : 'Fix avec Aurelius'}
                            style={{
                              padding: '5px 8px',
                              borderRadius: '9px',
                              background: accentSoft,
                              border: `1px solid ${accentBorder}`,
                              color: accentLight,
                              fontSize: '10px',
                              fontWeight: 700,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '3px',
                              cursor: 'pointer',
                            }}
                          >
                            <Wand2 size={11} />
                            <span>Fix</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteMeal(m.id)}
                            aria-label="Supprimer"
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'rgba(255, 90, 82, 0.65)',
                              cursor: 'pointer',
                              padding: '4px',
                            }}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>

                      {isExpanded && m.advice && (
                        <div style={{ fontSize: '11px', color: 'rgba(250, 247, 242, 0.72)', paddingTop: '6px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                          {m.advice}
                        </div>
                      )}

                      {isFixOpen && (
                        <div style={{ display: 'flex', gap: '6px', paddingTop: '6px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                          <input
                            type="text"
                            value={fixText}
                            onChange={(e) => setFixText(e.target.value)}
                            placeholder={isEn ? 'Fix with Aurelius (e.g. +2 eggs, double portion)…' : 'Fix avec Aurelius (ex: oubli 2 œufs, sauce…)…'}
                            style={{
                              flex: 1,
                              padding: '8px 10px',
                              borderRadius: '10px',
                              background: 'rgba(0, 0, 0, 0.45)',
                              border: '1px solid rgba(255, 255, 255, 0.14)',
                              color: '#FAF7F2',
                              fontSize: '11.5px',
                              outline: 'none',
                            }}
                          />
                          <button
                            type="button"
                            disabled={isFixing || !fixText.trim()}
                            onClick={() => handleFixMeal(m, true)}
                            style={{
                              padding: '0 11px',
                              borderRadius: '10px',
                              background: accentSoft,
                              border: `1px solid ${accentBorder}`,
                              color: '#FAF7F2',
                              fontSize: '11.5px',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            {isFixing ? '...' : 'Fix'}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
    </>
  );

  if (embedded) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', paddingBottom: '16px' }}>
        {innerBody}
      </div>
    );
  }

  return (
    <div
      className={`calai-backdrop ${isClosing ? 'is-closing' : ''}`}
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      style={{
        zIndex: 1300,
        position: 'fixed',
        inset: 0,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        alignItems: 'center',
        background: 'rgba(0, 0, 0, 0.74)',
      }}
    >
      <style>{`
        @keyframes calaiBackdropIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes calaiBackdropOut {
          from { opacity: 1; }
          to { opacity: 0; }
        }
        .calai-backdrop {
          animation: calaiBackdropIn 220ms cubic-bezier(0.22, 1, 0.36, 1) both;
          will-change: opacity;
        }
        .calai-backdrop.is-closing {
          animation: calaiBackdropOut 200ms cubic-bezier(0.32, 0, 0.67, 0) forwards;
          pointer-events: none;
        }
        @keyframes calaiSheetSlideUp {
          0% {
            transform: translate3d(0, 100%, 0);
            opacity: 0.75;
          }
          100% {
            transform: translate3d(0, 0, 0);
            opacity: 1;
          }
        }
        @keyframes calaiSheetSlideDown {
          0% {
            transform: translate3d(0, 0, 0);
            opacity: 1;
          }
          100% {
            transform: translate3d(0, 100%, 0);
            opacity: 0;
          }
        }
        .calai-sheet {
          animation: calaiSheetSlideUp 280ms cubic-bezier(0.22, 1, 0.36, 1) both;
          will-change: transform, opacity;
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
        }
        .calai-sheet.is-closing {
          animation: calaiSheetSlideDown 220ms cubic-bezier(0.32, 0, 0.67, 0) forwards;
        }
      `}</style>
      <div
        className={`calai-sheet ${isClosing ? 'is-closing' : ''}`}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '430px',
          height: '92vh',
          maxHeight: '880px',
          background: isMono
            ? 'radial-gradient(ellipse at 50% 110%, rgba(255, 255, 255, 0.08) 0%, rgba(10, 10, 12, 0.98) 58%), #0A0A0C'
            : 'radial-gradient(ellipse at 50% 110%, rgba(192, 132, 252, 0.16) 0%, rgba(168, 85, 247, 0.05) 42%, rgba(10, 10, 12, 0.98) 74%), #0A0A0C',
          borderRadius: '30px 30px 0 0',
          border: isMono
            ? '1px solid rgba(255, 248, 240, 0.16)'
            : '1px solid rgba(192, 132, 252, 0.28)',
          borderBottom: 'none',
          boxShadow: '0 -20px 50px rgba(0, 0, 0, 0.95)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* Barre de préhension iOS */}
        <div style={{ width: '100%', display: 'flex', justifyContent: 'center', padding: '10px 0 4px 0' }}>
          <div style={{ width: '40px', height: '4px', borderRadius: '2px', background: 'rgba(255, 248, 240, 0.2)' }} />
        </div>

        {/* En-tête Aurel Labs · Aurelius Nutrition */}
        <div
          style={{
            padding: '12px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid rgba(255, 248, 240, 0.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '50%',
                background: isMono ? 'rgba(255, 255, 255, 0.08)' : 'rgba(192, 132, 252, 0.16)',
                border: isMono ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid rgba(192, 132, 252, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: isMono ? 'none' : '0 0 12px rgba(192, 132, 252, 0.22)',
              }}
            >
              <Sparkles size={16} color={accent} strokeWidth={1.8} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '17px', fontWeight: 700, color: '#FAF7F2', letterSpacing: '-0.3px' }}>
                  Aurelius
                </span>
                <span style={{ fontSize: '13px', fontWeight: 400, color: 'rgba(250, 247, 242, 0.45)' }}>
                  ·
                </span>
                <span style={{ fontSize: '14px', fontWeight: 600, color: 'rgba(250, 247, 242, 0.88)' }}>
                  Nutrition
                </span>
              </div>
              <span style={{ fontSize: '11px', color: 'rgba(250, 247, 242, 0.55)' }}>
                {isEn ? 'Biological Vision & Aurel Balance' : 'Vision Biologique & Équilibre Aurel'}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            aria-label="Fermer"
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.07)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: 'rgba(250, 247, 242, 0.8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'background 0.18s ease',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {innerBody}
      </div>
    </div>
  );
};
