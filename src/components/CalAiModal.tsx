import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { useModalAnimation } from '../hooks/useModalAnimation';
import {
  compressImageToDataUrl,
  analyzeMealWithCalAi,
  getLoggedMeals,
  saveLoggedMeal,
  deleteLoggedMeal,
  getDailyNutritionSummary,
  getDailyTargets,
} from '../lib/calAiService';
import { CalAiAnalysisResult } from '../types/calai';
import {
  X,
  Camera,
  Image as ImageIcon,
  Flame,
  Check,
  Trash2,
  ChevronDown,
  ChevronUp,
  Sparkles,
  RefreshCw,
  Plus,
  Utensils,
} from 'lucide-react';

interface CalAiModalProps {
  onClose: () => void;
  initialImage?: { base64: string; mimeType: string; dataUrl: string };
}

export const CalAiModal: React.FC<CalAiModalProps> = ({ onClose, initialImage }) => {
  const { language, weekData, selectedDay } = useApp();
  const { isClosing, handleClose } = useModalAnimation(onClose);
  const isEn = language === 'en';

  const [activeTab, setActiveTab] = useState<'scan' | 'journal'>('scan');
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanStep, setScanStep] = useState<string>('');
  const [currentResult, setCurrentResult] = useState<CalAiAnalysisResult | null>(null);
  const [currentImagePreview, setCurrentImagePreview] = useState<string | null>(initialImage?.dataUrl || null);
  const [selectedMealType, setSelectedMealType] = useState<'breakfast' | 'lunch' | 'dinner' | 'snack'>('lunch');
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Journal du jour
  const [loggedMeals, setLoggedMeals] = useState<CalAiAnalysisResult[]>([]);
  const [dailySummary, setDailySummary] = useState(getDailyNutritionSummary());
  const dailyTargets = getDailyTargets();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  const refreshJournal = () => {
    const meals = getLoggedMeals();
    setLoggedMeals(meals);
    setDailySummary(getDailyNutritionSummary());
  };

  useEffect(() => {
    refreshJournal();
  }, []);

  // Détection automatique si une image initiale a été fournie
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

    setScanStep(isEn ? 'Analyzing visual plate...' : 'Scan visuel du plat...');
    await new Promise((r) => setTimeout(r, 400));

    setScanStep(isEn ? 'Detecting ingredients & portions...' : 'Identification des ingrédients & portions...');
    await new Promise((r) => setTimeout(r, 500));

    setScanStep(isEn ? 'Computing calories & macros...' : 'Calcul précis des calories & macros...');

    try {
      const result = await analyzeMealWithCalAi(imgData, {
        language: isEn ? 'en' : 'fr',
        mealType: selectedMealType,
      });
      setCurrentResult(result);
    } catch (err: any) {
      console.error('[Cal AI] Erreur analyse:', err);
      setErrorMessage(
        err?.message || (isEn ? 'Failed to analyze meal. Please retry.' : 'Échec du scan. Veuillez réessayer.')
      );
    } finally {
      setIsScanning(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setScanStep(isEn ? 'Optimizing photo...' : 'Optimisation de la photo...');
      setIsScanning(true);
      const compressed = await compressImageToDataUrl(file);
      await processImage(compressed);
    } catch (err: any) {
      console.error('[Cal AI] Erreur compression:', err);
      setIsScanning(false);
      setErrorMessage(isEn ? 'Error loading image' : 'Erreur lors du chargement de la photo');
    }
  };

  const handleSaveMeal = () => {
    if (!currentResult) return;
    const toSave: CalAiAnalysisResult = {
      ...currentResult,
      mealType: selectedMealType,
      imageUrl: currentImagePreview || undefined,
    };
    saveLoggedMeal(toSave);
    setSaveSuccess(true);
    refreshJournal();
    setTimeout(() => {
      setSaveSuccess(false);
      setActiveTab('journal');
    }, 700);
  };

  const handleDeleteMeal = (id: string) => {
    deleteLoggedMeal(id);
    refreshJournal();
  };

  const activeKcalBurned = weekData?.[selectedDay]?.activeKcal || 450;
  const calPercent = Math.min(100, Math.round((dailySummary.calories / dailyTargets.calories) * 100));
  const proteinPercent = Math.min(100, Math.round((dailySummary.protein / dailyTargets.protein) * 100));
  const carbsPercent = Math.min(100, Math.round((dailySummary.carbs / dailyTargets.carbs) * 100));
  const fatPercent = Math.min(100, Math.round((dailySummary.fat / dailyTargets.fat) * 100));

  return (
    <div
      className={`modal-backdrop ${isClosing ? 'is-closing' : ''}`}
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
        background: 'rgba(0, 0, 0, 0.78)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }}
    >
      <div
        className={`modal-content ${isClosing ? 'is-closing' : ''}`}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '430px',
          height: '92vh',
          maxHeight: '880px',
          background: 'linear-gradient(180deg, #0B0E14 0%, #05070A 100%)',
          borderRadius: '28px 28px 0 0',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderBottom: 'none',
          boxShadow: '0 -12px 40px rgba(0, 0, 0, 0.85), 0 0 35px rgba(48, 209, 88, 0.15)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* Barre de préhension iOS */}
        <div style={{ width: '100%', display: 'flex', justifyContent: 'center', padding: '10px 0 4px 0' }}>
          <div style={{ width: '40px', height: '4px', borderRadius: '2px', background: 'rgba(255, 255, 255, 0.25)' }} />
        </div>

        {/* En-tête Cal AI */}
        <div
          style={{
            padding: '12px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #FF9F0A 0%, #30D158 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 14px rgba(255, 159, 10, 0.4)',
              }}
            >
              <Flame size={18} color="#000" strokeWidth={2.4} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '17px', fontWeight: 800, color: '#FFF', letterSpacing: '-0.3px' }}>
                  Cal AI
                </span>
                <span
                  style={{
                    fontSize: '9.5px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    color: '#30D158',
                    background: 'rgba(48, 209, 88, 0.15)',
                    padding: '1px 6px',
                    borderRadius: '999px',
                    border: '1px solid rgba(48, 209, 88, 0.3)',
                  }}
                >
                  Scanner
                </span>
              </div>
              <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.5)' }}>
                {isEn ? 'Food Vision & Macro Tracker' : 'Scan Nutritionnel & Calculateur de Calories'}
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
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: 'rgba(255, 255, 255, 0.8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Onglets Scan / Journal */}
        <div style={{ display: 'flex', padding: '10px 18px', gap: '8px' }}>
          <button
            type="button"
            onClick={() => setActiveTab('scan')}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: '12px',
              background: activeTab === 'scan' ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.03)',
              border: activeTab === 'scan' ? '1px solid rgba(255, 255, 255, 0.22)' : '1px solid transparent',
              color: activeTab === 'scan' ? '#FFF' : 'rgba(255, 255, 255, 0.5)',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.18s ease',
            }}
          >
            <Camera size={15} />
            {isEn ? 'Scan Plate' : 'Scanner un plat'}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('journal')}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: '12px',
              background: activeTab === 'journal' ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.03)',
              border: activeTab === 'journal' ? '1px solid rgba(255, 255, 255, 0.22)' : '1px solid transparent',
              color: activeTab === 'journal' ? '#FFF' : 'rgba(255, 255, 255, 0.5)',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.18s ease',
            }}
          >
            <Utensils size={15} />
            {isEn ? `Daily Log (${dailySummary.mealCount})` : `Journal (${dailySummary.mealCount})`}
          </button>
        </div>

        {/* Barre de Progression Cal AI Globale */}
        <div
          style={{
            margin: '0 18px 12px 18px',
            padding: '12px 14px',
            borderRadius: '18px',
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.09)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
              <span style={{ fontSize: '20px', fontWeight: 800, color: '#FFF' }}>
                {dailySummary.calories.toLocaleString()}
              </span>
              <span style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.5)' }}>
                / {dailyTargets.calories.toLocaleString()} kcal
              </span>
            </div>
            <div style={{ fontSize: '11.5px', color: '#30D158', fontWeight: 700 }}>
              {Math.max(0, dailyTargets.calories - dailySummary.calories)} kcal {isEn ? 'remaining' : 'restantes'}
            </div>
          </div>

          {/* Barre Calories principale */}
          <div
            style={{
              height: '7px',
              background: 'rgba(255, 255, 255, 0.1)',
              borderRadius: '999px',
              overflow: 'hidden',
              marginBottom: '10px',
            }}
          >
            <div
              style={{
                width: `${calPercent}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #FF9F0A 0%, #30D158 100%)',
                borderRadius: '999px',
                transition: 'width 0.4s ease',
              }}
            />
          </div>

          {/* Mini-barres des 3 Macros */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
            {/* Protéines */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px' }}>
                <span style={{ color: 'rgba(255, 255, 255, 0.6)' }}>Protéines</span>
                <span style={{ color: '#FF9F0A', fontWeight: 700 }}>{dailySummary.protein}g</span>
              </div>
              <div style={{ height: '4px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ width: `${proteinPercent}%`, height: '100%', background: '#FF9F0A', borderRadius: '2px' }} />
              </div>
            </div>

            {/* Glucides */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px' }}>
                <span style={{ color: 'rgba(255, 255, 255, 0.6)' }}>Glucides</span>
                <span style={{ color: '#64D2FF', fontWeight: 700 }}>{dailySummary.carbs}g</span>
              </div>
              <div style={{ height: '4px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ width: `${carbsPercent}%`, height: '100%', background: '#64D2FF', borderRadius: '2px' }} />
              </div>
            </div>

            {/* Lipides */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px' }}>
                <span style={{ color: 'rgba(255, 255, 255, 0.6)' }}>Lipides</span>
                <span style={{ color: '#BF5AF2', fontWeight: 700 }}>{dailySummary.fat}g</span>
              </div>
              <div style={{ height: '4px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ width: `${fatPercent}%`, height: '100%', background: '#BF5AF2', borderRadius: '2px' }} />
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

        {/* Contenu Déroulant */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 18px 24px 18px' }}>
          {activeTab === 'scan' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Zone d'action de capture / aperçu */}
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  aspectRatio: currentImagePreview ? '4/3' : '16/9',
                  borderRadius: '22px',
                  overflow: 'hidden',
                  background: 'rgba(20, 24, 33, 0.7)',
                  border: '1.5px dashed rgba(255, 255, 255, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {currentImagePreview ? (
                  <>
                    <img
                      src={currentImagePreview}
                      alt="Aperçu plat"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    {/* Laser Scanner Cal AI Animation */}
                    {isScanning && (
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          background: 'rgba(0, 0, 0, 0.45)',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '12px',
                        }}
                      >
                        <div className="calai-laser-line" />
                        <Sparkles size={28} color="#30D158" className="animate-spin" />
                        <span style={{ color: '#FFF', fontSize: '13px', fontWeight: 700, textShadow: '0 2px 8px #000' }}>
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
                      padding: '20px',
                      textAlign: 'center',
                    }}
                  >
                    <div
                      style={{
                        width: '56px',
                        height: '56px',
                        borderRadius: '50%',
                        background: 'rgba(48, 209, 88, 0.15)',
                        border: '1px solid rgba(48, 209, 88, 0.35)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#30D158',
                        boxShadow: '0 0 20px rgba(48, 209, 88, 0.25)',
                      }}
                    >
                      <Camera size={26} />
                    </div>
                    <div>
                      <div style={{ fontSize: '15px', fontWeight: 700, color: '#FFF' }}>
                        {isEn ? 'Take a photo of your food' : 'Prenez votre assiette en photo'}
                      </div>
                      <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.5)', marginTop: '2px' }}>
                        {isEn ? 'Cal AI will instantly estimate calories & macros' : 'Cal AI calcule instantanément les calories & macros'}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Boutons d'action pour prendre la photo */}
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  disabled={isScanning}
                  onClick={() => cameraInputRef.current?.click()}
                  style={{
                    flex: 1.2,
                    padding: '13px',
                    borderRadius: '16px',
                    background: 'linear-gradient(135deg, #30D158 0%, #10B981 100%)',
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                    color: '#000',
                    fontWeight: 800,
                    fontSize: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    boxShadow: '0 4px 18px rgba(48, 209, 88, 0.35)',
                  }}
                >
                  <Camera size={18} color="#000" />
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
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#FFF',
                    fontWeight: 700,
                    fontSize: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                  }}
                >
                  <ImageIcon size={16} />
                  {isEn ? 'Photo Library' : 'Photothèque'}
                </button>
              </div>

              {/* Erreur éventuelle */}
              {errorMessage && (
                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: '14px',
                    background: 'rgba(255, 69, 58, 0.15)',
                    border: '1px solid rgba(255, 69, 58, 0.3)',
                    color: '#FF453A',
                    fontSize: '12.5px',
                  }}
                >
                  {errorMessage}
                </div>
              )}

              {/* RÉSULTAT CAL AI */}
              {currentResult && (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    padding: '16px',
                    borderRadius: '22px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    boxShadow: '0 8px 30px rgba(0, 0, 0, 0.5)',
                  }}
                >
                  {/* Nom du plat & Total Calories */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: '18px', fontWeight: 800, color: '#FFF', letterSpacing: '-0.3px' }}>
                        {currentResult.mealName}
                      </div>
                      <div style={{ fontSize: '11.5px', color: '#30D158', fontWeight: 700, marginTop: '2px' }}>
                        Score Santé : {currentResult.healthScore || 90}/100
                      </div>
                    </div>

                    <div
                      style={{
                        textAlign: 'right',
                        padding: '6px 12px',
                        borderRadius: '14px',
                        background: 'linear-gradient(135deg, rgba(255, 159, 10, 0.2) 0%, rgba(255, 69, 58, 0.2) 100%)',
                        border: '1px solid rgba(255, 159, 10, 0.4)',
                      }}
                    >
                      <div style={{ fontSize: '22px', fontWeight: 900, color: '#FF9F0A', lineHeight: 1 }}>
                        {currentResult.totalCalories}
                      </div>
                      <div style={{ fontSize: '9.5px', fontWeight: 800, color: 'rgba(255, 255, 255, 0.7)' }}>
                        KCAL
                      </div>
                    </div>
                  </div>

                  {/* 3 Cartes Macros */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                    <div
                      style={{
                        padding: '10px 8px',
                        borderRadius: '14px',
                        background: 'rgba(255, 159, 10, 0.1)',
                        border: '1px solid rgba(255, 159, 10, 0.25)',
                        textAlign: 'center',
                      }}
                    >
                      <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.6)' }}>Protéines</div>
                      <div style={{ fontSize: '16px', fontWeight: 800, color: '#FF9F0A' }}>
                        {currentResult.macros.protein}g
                      </div>
                    </div>

                    <div
                      style={{
                        padding: '10px 8px',
                        borderRadius: '14px',
                        background: 'rgba(100, 210, 255, 0.1)',
                        border: '1px solid rgba(100, 210, 255, 0.25)',
                        textAlign: 'center',
                      }}
                    >
                      <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.6)' }}>Glucides</div>
                      <div style={{ fontSize: '16px', fontWeight: 800, color: '#64D2FF' }}>
                        {currentResult.macros.carbs}g
                      </div>
                    </div>

                    <div
                      style={{
                        padding: '10px 8px',
                        borderRadius: '14px',
                        background: 'rgba(191, 90, 242, 0.1)',
                        border: '1px solid rgba(191, 90, 242, 0.25)',
                        textAlign: 'center',
                      }}
                    >
                      <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.6)' }}>Lipides</div>
                      <div style={{ fontSize: '16px', fontWeight: 800, color: '#BF5AF2' }}>
                        {currentResult.macros.fat}g
                      </div>
                    </div>
                  </div>

                  {/* Décomposition des aliments */}
                  {currentResult.items && currentResult.items.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: 'rgba(255, 255, 255, 0.7)' }}>
                        {isEn ? 'Detected Ingredients :' : 'Ingrédients détectés :'}
                      </span>
                      {currentResult.items.map((it, idx) => (
                        <div
                          key={idx}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '6px 10px',
                            borderRadius: '10px',
                            background: 'rgba(255, 255, 255, 0.03)',
                            fontSize: '12px',
                          }}
                        >
                          <div style={{ color: '#FFF' }}>
                            {it.name} <span style={{ color: 'rgba(255, 255, 255, 0.45)' }}>({it.portion})</span>
                          </div>
                          <div style={{ fontWeight: 700, color: '#FF9F0A' }}>
                            {it.calories} kcal
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Conseil Zénon Stoïcien */}
                  {currentResult.advice && (
                    <div
                      style={{
                        padding: '10px 12px',
                        borderRadius: '12px',
                        background: 'rgba(48, 209, 88, 0.1)',
                        border: '1px solid rgba(48, 209, 88, 0.25)',
                        fontSize: '11.5px',
                        color: 'rgba(255, 255, 255, 0.85)',
                        lineHeight: 1.4,
                      }}
                    >
                      💡 <strong style={{ color: '#30D158' }}>Conseil Zénon :</strong> {currentResult.advice}
                    </div>
                  )}

                  {/* Sélecteur de type de repas */}
                  <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
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
                            padding: '6px 4px',
                            borderRadius: '10px',
                            background: active ? 'rgba(48, 209, 88, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                            border: active ? '1px solid #30D158' : '1px solid rgba(255, 255, 255, 0.1)',
                            color: active ? '#30D158' : 'rgba(255, 255, 255, 0.6)',
                            fontSize: '11px',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          {labels[t]}
                        </button>
                      );
                    })}
                  </div>

                  {/* Bouton Enregistrer */}
                  <button
                    type="button"
                    onClick={handleSaveMeal}
                    style={{
                      marginTop: '6px',
                      padding: '13px',
                      borderRadius: '16px',
                      background: saveSuccess
                        ? '#30D158'
                        : 'linear-gradient(135deg, #FF9F0A 0%, #30D158 100%)',
                      border: 'none',
                      color: '#000',
                      fontWeight: 800,
                      fontSize: '14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      cursor: 'pointer',
                      boxShadow: '0 4px 18px rgba(48, 209, 88, 0.35)',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    {saveSuccess ? (
                      <>
                        <Check size={18} />
                        {isEn ? 'Logged to Daily Journal!' : 'Enregistré dans le Journal !'}
                      </>
                    ) : (
                      <>
                        <Plus size={18} />
                        {isEn ? 'Log Meal to Journal' : 'Ajouter ce repas au Journal'}
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* ONGLET JOURNAL DU JOUR */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '14px', fontWeight: 800, color: '#FFF' }}>
                  {isEn ? "Today's Meals" : "Repas d'aujourd'hui"}
                </span>
                <button
                  type="button"
                  onClick={() => setActiveTab('scan')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '10px',
                    background: 'rgba(48, 209, 88, 0.15)',
                    border: '1px solid rgba(48, 209, 88, 0.3)',
                    color: '#30D158',
                    fontSize: '11.5px',
                    fontWeight: 700,
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
                    padding: '36px 18px',
                    textAlign: 'center',
                    background: 'rgba(255, 255, 255, 0.03)',
                    borderRadius: '18px',
                    border: '1px dashed rgba(255, 255, 255, 0.15)',
                  }}
                >
                  <Utensils size={32} color="rgba(255, 255, 255, 0.3)" style={{ marginBottom: '8px' }} />
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#FFF' }}>
                    {isEn ? 'No meals logged today' : 'Aucun repas enregistré aujourd’hui'}
                  </div>
                  <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.5)', marginTop: '4px' }}>
                    {isEn ? 'Scan your plate to start tracking calories' : 'Scannez votre assiette pour suivre vos calories et macros'}
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
                        borderRadius: '16px',
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
                              background: 'rgba(255, 255, 255, 0.08)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Utensils size={20} color="rgba(255, 255, 255, 0.5)" />
                          </div>
                        )}
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: 700, color: '#FFF' }}>
                            {m.mealName}
                          </div>
                          <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.45)', marginTop: '1px' }}>
                            {typeLabel} · {m.timestamp}
                          </div>
                          <div style={{ fontSize: '10.5px', color: 'rgba(255, 255, 255, 0.65)', marginTop: '2px' }}>
                            P: {m.macros?.protein}g · G: {m.macros?.carbs}g · L: {m.macros?.fat}g
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: '15px', fontWeight: 800, color: '#FF9F0A' }}>
                            {m.totalCalories}
                          </span>
                          <span style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.5)', marginLeft: '2px' }}>
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
                            color: 'rgba(255, 69, 58, 0.7)',
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
      </div>

      <style>{`
        .calai-laser-line {
          position: absolute;
          width: 100%;
          height: 3px;
          background: linear-gradient(90deg, transparent 0%, #30D158 50%, transparent 100%);
          box-shadow: 0 0 15px #30D158;
          animation: calaiLaserSweep 1.8s infinite ease-in-out;
        }

        @keyframes calaiLaserSweep {
          0% { top: 0%; opacity: 0.2; }
          50% { top: 96%; opacity: 1; }
          100% { top: 0%; opacity: 0.2; }
        }
      `}</style>
    </div>
  );
};
