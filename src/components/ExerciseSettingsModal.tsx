import React, { useState } from 'react';
import { useModalAnimation } from '../hooks/useModalAnimation';
import { GymExercise } from './FitScreen';
import {
  Settings2,
  X,
  Plus,
  Minus,
  Trash2,
  Dumbbell,
  AlertTriangle,
  Layers,
  Check,
  Edit3,
  Sliders,
} from 'lucide-react';

interface ExerciseSettingsModalProps {
  exercise: GymExercise;
  onClose: () => void;
  onRename: (newName: string) => void;
  onApplyWeightDeltaAll: (deltaKg: number) => void;
  onAdjustWeight: (setId: string, delta: number) => void;
  onAdjustReps: (setId: string, delta: number) => void;
  onDeleteSet: (setId: string) => void;
  onAddSet: () => void;
  onDeleteExercise: () => void;
}

export const ExerciseSettingsModal: React.FC<ExerciseSettingsModalProps> = ({
  exercise,
  onClose,
  onRename,
  onApplyWeightDeltaAll,
  onAdjustWeight,
  onAdjustReps,
  onDeleteSet,
  onAddSet,
  onDeleteExercise,
}) => {
  const { isClosing, handleClose } = useModalAnimation(onClose);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(exercise.name);
  const [confirmDeleteEx, setConfirmDeleteEx] = useState(false);

  const handleSaveName = (e: React.FormEvent) => {
    e.preventDefault();
    if (editedName.trim()) {
      onRename(editedName.trim());
    }
    setIsEditingName(false);
  };

  return (
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
            aria-label="Fermer"
          >
            <X size={16} />
          </button>
        </div>

        {/* 1. RENOMMER L'EXERCICE */}
        <div className="ex-settings-card">
          <span className="ex-settings-section-label">Nom de l'exercice</span>
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
                <span>Enregistrer</span>
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
                title="Modifier le nom"
              >
                <Edit3 size={13} />
                <span>Renommer</span>
              </button>
            </div>
          )}
        </div>

        {/* 2. AJOUTER / AJUSTER DU POIDS GLOBALEMENT */}
        <div className="ex-settings-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="ex-settings-section-label">Ajustement rapide de charge</span>
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

        {/* 3. GESTION DES SÉRIES (Poids, répétitions, ajout & suppression) */}
        <div className="ex-settings-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Layers size={13} color="var(--gold)" />
              <span className="ex-settings-section-label">
                Poids & Répétitions ({exercise.sets.length})
              </span>
            </div>
            <button
              type="button"
              className="ex-mini-action-btn gold"
              onClick={onAddSet}
            >
              <Plus size={12} />
              <span>Ajouter une série</span>
            </button>
          </div>

          <div className="ex-sets-manage-list">
            {exercise.sets.map((s, idx) => (
              <div key={s.id} className="ex-set-manage-row" style={{ gap: '8px' }}>
                <span className="ex-set-num-badge" style={{ minWidth: '24px', textAlign: 'center' }}>
                  {idx + 1}
                </span>

                {/* Stepper Poids (kg) */}
                <div className="set-mini-control" style={{ flex: 1 }}>
                  <button
                    type="button"
                    className="mini-step-btn"
                    onClick={() => onAdjustWeight(s.id, -2.5)}
                    title="-2.5 kg"
                  >
                    -
                  </button>
                  <span className="mini-step-val">{s.weightKg} kg</span>
                  <button
                    type="button"
                    className="mini-step-btn"
                    onClick={() => onAdjustWeight(s.id, 2.5)}
                    title="+2.5 kg"
                  >
                    +
                  </button>
                </div>

                {/* Stepper Répétitions */}
                <div className="set-mini-control" style={{ flex: 1 }}>
                  <button
                    type="button"
                    className="mini-step-btn"
                    onClick={() => onAdjustReps(s.id, -1)}
                    title="-1 rép"
                  >
                    -
                  </button>
                  <span className="mini-step-val">{s.reps} réps</span>
                  <button
                    type="button"
                    className="mini-step-btn"
                    onClick={() => onAdjustReps(s.id, 1)}
                    title="+1 rép"
                  >
                    +
                  </button>
                </div>

                {exercise.sets.length > 1 ? (
                  <button
                    type="button"
                    className="ex-delete-set-btn"
                    style={{ padding: '5px 7px' }}
                    onClick={() => onDeleteSet(s.id)}
                    title={`Supprimer la série ${idx + 1}`}
                  >
                    <Trash2 size={13} />
                  </button>
                ) : (
                  <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', width: '28px', textAlign: 'center' }}>
                    —
                  </span>
                )}
              </div>
            ))}
          </div>

          <button
            type="button"
            className="add-set-link-btn"
            style={{ marginTop: '2px' }}
            onClick={onAddSet}
          >
            <Plus size={13} />
            <span>Ajouter une série</span>
          </button>
        </div>

        {/* 4. SUPPRESSION SÉCURISÉE DE L'EXERCICE */}
        <div className="ex-settings-card danger">
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <AlertTriangle size={14} color="#FFFFFF" />
            <span className="ex-settings-section-label danger">Zone de suppression</span>
          </div>

          {!confirmDeleteEx ? (
            <button
              type="button"
              className="ex-delete-exercise-trigger"
              onClick={() => setConfirmDeleteEx(true)}
            >
              <Trash2 size={14} />
              <span>Supprimer cet exercice</span>
            </button>
          ) : (
            <div className="ex-delete-confirm-box">
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#FFFFFF' }}>
                Confirmer la suppression de cet exercice ?
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="ex-delete-confirm-btn"
                  onClick={onDeleteExercise}
                >
                  Oui, supprimer
                </button>
                <button
                  type="button"
                  className="ex-delete-cancel-btn"
                  onClick={() => setConfirmDeleteEx(false)}
                >
                  Annuler
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
