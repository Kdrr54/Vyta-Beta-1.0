import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useModalAnimation } from '../hooks/useModalAnimation';
import { useApp } from '../context/AppContext';
import { GymExercise, GymSetType } from './FitScreen';
import {
  X,
  Plus,
  Minus,
  Trash2,
  AlertTriangle,
  Layers,
  Check,
  Edit3,
  Sliders,
  Timer,
  Copy,
  FileText,
} from 'lucide-react';

interface ExerciseSettingsModalProps {
  exercise: GymExercise;
  onClose: () => void;
  onRename: (newName: string) => void;
  onApplyWeightDeltaAll: (deltaKg: number) => void;
  onAdjustWeight: (setId: string, delta: number) => void;
  onAdjustReps: (setId: string, delta: number) => void;
  onUpdateSetMeta: (setId: string, patch: { setType?: GymSetType; rpe?: number; weightKg?: number; reps?: number }) => void;
  onDuplicateSet: (setId: string) => void;
  onUpdateExerciseMeta: (patch: { restSec?: number; notes?: string }) => void;
  onDeleteSet: (setId: string) => void;
  onAddSet: () => void;
  onDeleteExercise: () => void;
}

const SET_TYPE_LABELS: { id: GymSetType; shortFr: string; shortEn: string; labelFr: string; labelEn: string; color: string }[] = [
  { id: 'warmup', shortFr: 'E', shortEn: 'W', labelFr: 'Échauff.', labelEn: 'Warmup', color: '#38BDF8' },
  { id: 'normal', shortFr: 'N', shortEn: 'N', labelFr: 'Normale', labelEn: 'Normal', color: '#FAF7F2' },
  { id: 'heavy', shortFr: 'L', shortEn: 'H', labelFr: 'Lourde', labelEn: 'Heavy', color: '#FF9F0A' },
  { id: 'drop', shortFr: 'D', shortEn: 'D', labelFr: 'Drop', labelEn: 'Drop', color: '#FF453A' },
];

export const ExerciseSettingsModal: React.FC<ExerciseSettingsModalProps> = ({
  exercise,
  onClose,
  onRename,
  onApplyWeightDeltaAll,
  onAdjustWeight,
  onAdjustReps,
  onUpdateSetMeta,
  onDuplicateSet,
  onUpdateExerciseMeta,
  onDeleteSet,
  onAddSet,
  onDeleteExercise,
}) => {
  const { language } = useApp();
  const isEn = language === 'en';
  const { isClosing, handleClose } = useModalAnimation(onClose);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(exercise.name);
  const [editedNotes, setEditedNotes] = useState(exercise.notes || '');
  const [confirmDeleteEx, setConfirmDeleteEx] = useState(false);

  const handleSaveName = (e: React.FormEvent) => {
    e.preventDefault();
    if (editedName.trim()) {
      onRename(editedName.trim());
    }
    setIsEditingName(false);
  };

  const restSec = exercise.restSec ?? 90;

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className={`modal-backdrop ${isClosing ? "is-closing" : ""}`} onClick={handleClose} role="dialog" aria-modal="true">
      <div className={`exercise-settings-sheet modal-sheet ${isClosing ? "is-closing" : ""}`} onClick={(e) => e.stopPropagation()}>
        {/* Grabber bar */}
        <div className="metric-sheet-grabber" />

        {/* Modal Header */}
        <div className="exercise-settings-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="ex-settings-icon-chip">
              <Sliders size={16} color="var(--gold)" />
            </div>
            <div>
              <h3 className="ex-settings-title">{exercise.name}</h3>
            </div>
          </div>

          <button
            type="button"
            className="modal-close-btn"
            onClick={handleClose}
            aria-label={isEn ? 'Close' : 'Fermer'}
          >
            <X size={16} />
          </button>
        </div>

        {/* 1. RENOMMER L'EXERCICE */}
        <div className="ex-settings-card">
          <span className="ex-settings-section-label">
            {isEn ? 'Exercise Name' : "Nom de l'exercice"}
          </span>
          {isEditingName ? (
            <form onSubmit={handleSaveName} style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
              <input
                type="text"
                className="ex-settings-input"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                autoFocus
              />
              <button type="submit" className="ex-settings-save-btn">
                <Check size={14} />
                <span>{isEn ? 'Save' : 'Enregistrer'}</span>
              </button>
            </form>
          ) : (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                background: 'rgba(255, 255, 255, 0.04)',
                borderRadius: '10px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              <span style={{ fontSize: '13.5px', fontWeight: 600, color: '#FFFFFF' }}>
                {exercise.name}
              </span>
              <button
                type="button"
                className="ex-mini-action-btn"
                onClick={() => setIsEditingName(true)}
                title={isEn ? 'Edit name' : 'Modifier le nom'}
              >
                <Edit3 size={13} />
                <span>{isEn ? 'Rename' : 'Renommer'}</span>
              </button>
            </div>
          )}
        </div>

        {/* 2. AJOUTER / AJUSTER DU POIDS GLOBALEMENT */}
        <div className="ex-settings-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="ex-settings-section-label">
              {isEn ? 'Quick Weight Adjustment' : 'Ajustement rapide de charge'}
            </span>
          </div>

          <div className="ex-weight-quick-grid">
            <button
              type="button"
              className="ex-weight-chip minus"
              onClick={() => onApplyWeightDeltaAll(-5)}
            >
              - 5 kg
            </button>
            <button
              type="button"
              className="ex-weight-chip minus"
              onClick={() => onApplyWeightDeltaAll(-2.5)}
            >
              - 2.5 kg
            </button>
            <button
              type="button"
              className="ex-weight-chip plus"
              onClick={() => onApplyWeightDeltaAll(2.5)}
            >
              + 2.5 kg
            </button>
            <button
              type="button"
              className="ex-weight-chip plus highlight"
              onClick={() => onApplyWeightDeltaAll(5)}
            >
              + 5 kg
            </button>
          </div>
        </div>

        {/* 3. PARAMÈTRES D'EXERCICE : REPOS & NOTES */}
        <div className="ex-settings-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Timer size={13} color="var(--gold)" />
              <span className="ex-settings-section-label">
                {isEn ? 'Rest per set' : 'Repos par série'}
              </span>
            </div>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#FAF7F2', fontFamily: 'var(--font-mono)' }}>
              {restSec}s
            </span>
          </div>
          <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
            {[45, 60, 90, 120, 180].map((sec) => (
              <button
                key={sec}
                type="button"
                onClick={() => onUpdateExerciseMeta({ restSec: sec })}
                style={{
                  flex: 1,
                  padding: '6px 4px',
                  borderRadius: '8px',
                  background: restSec === sec ? 'rgba(255, 255, 255, 0.16)' : 'rgba(255, 255, 255, 0.04)',
                  border: restSec === sec ? '1px solid rgba(255, 255, 255, 0.35)' : '1px solid rgba(255, 255, 255, 0.08)',
                  color: '#FAF7F2',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {sec >= 60 ? `${sec / 60}m${sec % 60 ? sec % 60 : ''}` : `${sec}s`}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
            <FileText size={12} color="var(--text-secondary)" />
            <span className="ex-settings-section-label">
              {isEn ? 'Technique Note' : 'Consigne / Note technique'}
            </span>
          </div>
          <input
            type="text"
            className="ex-settings-input"
            placeholder={isEn ? 'Tempo 3-1-1, bench angle, grip...' : 'Ex: Tempo contrôlé, banc 30°, prise large...'}
            value={editedNotes}
            onChange={(e) => {
              setEditedNotes(e.target.value);
              onUpdateExerciseMeta({ notes: e.target.value });
            }}
          />
        </div>

        {/* 4. GESTION INDIVIDUELLE DE CHAQUE SÉRIE */}
        <div className="ex-settings-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Layers size={13} color="var(--gold)" />
              <span className="ex-settings-section-label">
                {isEn ? 'Per-Set Configuration' : 'Paramètres série par série'} ({exercise.sets.length})
              </span>
            </div>
            <button
              type="button"
              className="ex-mini-action-btn gold"
              onClick={onAddSet}
            >
              <Plus size={12} />
              <span>{isEn ? 'Add set' : 'Ajouter'}</span>
            </button>
          </div>

          <div className="ex-sets-manage-list" style={{ gap: '8px' }}>
            {exercise.sets.map((s, idx) => {
              const curType = s.setType || 'normal';
              const nextType = SET_TYPE_LABELS[(SET_TYPE_LABELS.findIndex((t) => t.id === curType) + 1) % SET_TYPE_LABELS.length];
              const typeMeta = SET_TYPE_LABELS.find((t) => t.id === curType) || SET_TYPE_LABELS[1];
              return (
                <div
                  key={s.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '7px',
                    padding: '9px 10px',
                    borderRadius: '12px',
                    background: 'rgba(255, 255, 255, 0.035)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className="ex-set-num-badge" style={{ minWidth: '24px', textAlign: 'center' }}>
                        S{idx + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => onUpdateSetMeta(s.id, { setType: nextType.id })}
                        style={{
                          padding: '3px 8px',
                          borderRadius: '7px',
                          background: 'rgba(255, 255, 255, 0.07)',
                          border: `1px solid ${typeMeta.color}44`,
                          color: typeMeta.color,
                          fontSize: '10.5px',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                        title={isEn ? 'Tap to switch set type' : 'Toucher pour changer le type de série'}
                      >
                        {isEn ? typeMeta.labelEn : typeMeta.labelFr}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const nextRpe = !s.rpe ? 7 : s.rpe >= 10 ? undefined : s.rpe + 1;
                          onUpdateSetMeta(s.id, { rpe: nextRpe });
                        }}
                        style={{
                          padding: '3px 7px',
                          borderRadius: '7px',
                          background: s.rpe ? 'rgba(167, 139, 250, 0.14)' : 'rgba(255, 255, 255, 0.04)',
                          border: s.rpe ? '1px solid rgba(167, 139, 250, 0.4)' : '1px solid rgba(255, 255, 255, 0.1)',
                          color: s.rpe ? '#C4B5FD' : 'rgba(250, 247, 242, 0.45)',
                          fontSize: '10px',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        {s.rpe ? `RPE ${s.rpe}` : 'RPE --'}
                      </button>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <button
                        type="button"
                        onClick={() => onDuplicateSet(s.id)}
                        style={{
                          padding: '4px 6px',
                          borderRadius: '6px',
                          background: 'rgba(255, 255, 255, 0.06)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          color: '#FAF7F2',
                          cursor: 'pointer',
                        }}
                        title={isEn ? 'Duplicate set' : 'Dupliquer la série'}
                      >
                        <Copy size={11} />
                      </button>
                      {exercise.sets.length > 1 && (
                        <button
                          type="button"
                          className="ex-delete-set-btn"
                          style={{ padding: '4px 6px' }}
                          onClick={() => onDeleteSet(s.id)}
                          title={isEn ? `Delete set ${idx + 1}` : `Supprimer la série ${idx + 1}`}
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {/* Charge kg */}
                    <div className="set-mini-control" style={{ flex: 1 }}>
                      <button
                        type="button"
                        className="mini-step-btn"
                        onClick={() => onAdjustWeight(s.id, -2.5)}
                        title="-2.5 kg"
                      >
                        <Minus size={11} />
                      </button>
                      <span className="mini-step-val">{s.weightKg} kg</span>
                      <button
                        type="button"
                        className="mini-step-btn"
                        onClick={() => onAdjustWeight(s.id, 2.5)}
                        title="+2.5 kg"
                      >
                        <Plus size={11} />
                      </button>
                    </div>

                    {/* Répétitions */}
                    <div className="set-mini-control" style={{ flex: 1 }}>
                      <button
                        type="button"
                        className="mini-step-btn"
                        onClick={() => onAdjustReps(s.id, -1)}
                        title={isEn ? '-1 rep' : '-1 rép'}
                      >
                        <Minus size={11} />
                      </button>
                      <span className="mini-step-val">{s.reps} {isEn ? 'reps' : 'réps'}</span>
                      <button
                        type="button"
                        className="mini-step-btn"
                        onClick={() => onAdjustReps(s.id, 1)}
                        title={isEn ? '+1 rep' : '+1 rép'}
                      >
                        <Plus size={11} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 4. SUPPRESSION SÉCURISÉE DE L'EXERCICE */}
        <div className="ex-settings-card danger">
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <AlertTriangle size={14} color="#FFFFFF" />
            <span className="ex-settings-section-label danger">
              {isEn ? 'Danger Zone' : 'Zone de suppression'}
            </span>
          </div>

          {!confirmDeleteEx ? (
            <button
              type="button"
              className="ex-delete-exercise-trigger"
              onClick={() => setConfirmDeleteEx(true)}
            >
              <Trash2 size={14} />
              <span>{isEn ? 'Delete this exercise' : 'Supprimer cet exercice'}</span>
            </button>
          ) : (
            <div className="ex-delete-confirm-box">
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#FFFFFF' }}>
                {isEn ? 'Confirm exercise deletion?' : 'Confirmer la suppression de cet exercice ?'}
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="ex-delete-confirm-btn"
                  onClick={onDeleteExercise}
                >
                  {isEn ? 'Yes, delete' : 'Oui, supprimer'}
                </button>
                <button
                  type="button"
                  className="ex-delete-cancel-btn"
                  onClick={() => setConfirmDeleteEx(false)}
                >
                  {isEn ? 'Cancel' : 'Annuler'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
