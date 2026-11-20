import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { useModalAnimation } from '../hooks/useModalAnimation';
import {
  compressImageToDataUrl,
  compressThumbnailDataUrl,
  analyzeMealWithCalAi,
  getLoggedMeals,
  saveLoggedMeal,
  deleteLoggedMeal,
  getDailyNutritionSummary,
  getDailyTargets,
  getLocalDateKey,
  shiftDateKey,
  getAllLoggedMealDates,
} from '../lib/calAiService';
import { CalAiAnalysisResult } from '../types/calai';
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
  Utensils,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Compass,
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
  const dailyTargets = getDailyTargets();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  const refreshJournal = (targetKey: string = activeDateKey) => {
    const meals = getLoggedMeals(targetKey);
    setLoggedMeals(meals);
    setDailySummary(getDailyNutritionSummary(targetKey));
    setLoggedDates(getAllLoggedMealDates());
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
      const result = await analyzeMealWithCalAi(imgData, {
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
              <span style={{ fontSize: '24px', fontWeight: 300, color: '#FAF7F2', letterSpacing: '-0.5px' }}>
                {dailySummary.calories.toLocaleString()}
              </span>
              <span style={{ fontSize: '12px', color: 'rgba(250, 247, 242, 0.5)' }}>
                / {dailyTargets.calories.toLocaleString()} kcal
              </span>
            </div>
            <div style={{ fontSize: '11px', color: accentLight, fontWeight: 600 }}>
              {Math.max(0, dailyTargets.calories - dailySummary.calories)} kcal {isEn ? 'remaining' : 'restantes'}
            </div>
          </div>

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
                <span style={{ color: 'rgba(250, 247, 242, 0.6)' }}>Protéines</span>
                <span style={{ color: proteinTint, fontWeight: 700 }}>{dailySummary.protein}g</span>
              </div>
              <div style={{ height: '3px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ width: `${proteinPercent}%`, height: '100%', background: proteinTint, borderRadius: '2px' }} />
              </div>
            </div>

            {/* Glucides */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px' }}>
                <span style={{ color: 'rgba(250, 247, 242, 0.6)' }}>Glucides</span>
                <span style={{ color: carbsTint, fontWeight: 700 }}>{dailySummary.carbs}g</span>
              </div>
              <div style={{ height: '3px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ width: `${carbsPercent}%`, height: '100%', background: carbsTint, borderRadius: '2px' }} />
              </div>
            </div>

            {/* Lipides */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px' }}>
                <span style={{ color: 'rgba(250, 247, 242, 0.6)' }}>Lipides</span>
                <span style={{ color: fatTint, fontWeight: 700 }}>{dailySummary.fat}g</span>
              </div>
              <div style={{ height: '3px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ width: `${fatPercent}%`, height: '100%', background: fatTint, borderRadius: '2px' }} />
              </div>
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
              {/* Cadre de Capture Aurel */}
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  aspectRatio: currentImagePreview ? '4/3' : '16/9',
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
                        {isEn ? 'Capture your dish' : 'Capturez votre assiette'}
                      </div>
                      <div style={{ fontSize: '12px', color: 'rgba(250, 247, 242, 0.55)', marginTop: '3px', maxWidth: '280px' }}>
                        {isEn ? 'Aurelius identifies foods, weights, calories, and macros' : 'Aurelius identifie les aliments, portions, calories et macronutriments'}
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
                  onClick={() => cameraInputRef.current?.click()}
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
                  {isEn ? 'Take Photo' : 'Prendre une photo'}
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
                        Indice Vitalité : {currentResult.healthScore || 85}/100
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
                      <div style={{ fontSize: '11px', color: 'rgba(250, 247, 242, 0.6)' }}>Protéines</div>
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
                      <div style={{ fontSize: '11px', color: 'rgba(250, 247, 242, 0.6)' }}>Glucides</div>
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
                      <div style={{ fontSize: '11px', color: 'rgba(250, 247, 242, 0.6)' }}>Lipides</div>
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
                      <strong style={{ color: accentLight }}>Synthèse Aurelius :</strong> {currentResult.advice}
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

                  return (
                    <div
                      key={m.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 14px',
                        borderRadius: '18px',
                        background: 'rgba(255, 255, 255, 0.04)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {m.imageUrl ? (
                          <img
                            src={m.imageUrl}
                            alt={m.mealName}
                            style={{ width: '46px', height: '46px', borderRadius: '12px', objectFit: 'cover' }}
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
                            }}
                          >
                            <Utensils size={20} color="rgba(250, 247, 242, 0.5)" />
                          </div>
                        )}
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: 600, color: '#FAF7F2' }}>
                            {m.mealName}
                          </div>
                          <div style={{ fontSize: '11px', color: 'rgba(250, 247, 242, 0.45)', marginTop: '1px' }}>
                            {typeLabel} · {m.timestamp}
                          </div>
                          <div style={{ fontSize: '10.5px', color: 'rgba(250, 247, 242, 0.65)', marginTop: '2px' }}>
                            P: {m.macros?.protein}g · G: {m.macros?.carbs}g · L: {m.macros?.fat}g
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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
