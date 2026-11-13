import React from 'react';
import { Lightbulb, Sparkles } from 'lucide-react';

interface ZenonRichAnswerProps {
  content: string;
}

/**
 * Formatte les morceaux inline en détectant les **mots-clés** et en leur appliquant
 * des pilules surlignées colorées (émeraude, cyan, violet, ambre).
 */
function renderInlineHighlight(text: string): React.ReactNode[] {
  // Découper le texte par les motifs **mot**
  const parts = text.split(/(\*\*[^*]+\*\*)/g);

  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      const clean = part.slice(2, -2).trim();
      const lower = clean.toLowerCase();

      // 1. Scores & pourcentages positifs -> Émeraude
      if (/\d+\s*\/\s*100/.test(clean) || /\b(optimale?|excellente?|parfaite?|recharge|haut|fort)\b/i.test(lower)) {
        return (
          <span key={idx} className="zenon-chip zenon-chip-emerald">
            {clean}
          </span>
        );
      }

      // 2. Sommeil & durées (5h43, 1h49, profond, paradoxal) -> Cyan
      if (/\d+h\d*/.test(clean) || /\b(sommeil|profond|paradoxal|léger|nuit|cycles?|rem)\b/i.test(lower)) {
        return (
          <span key={idx} className="zenon-chip zenon-chip-cyan">
            {clean}
          </span>
        );
      }

      // 3. Biométries cardiaques, VRC, Énergie -> Violet
      if (/\b(vrc|vfc|rmssd|bpm|énergie|cardiaque|coeur|variabilité)\b/i.test(lower)) {
        return (
          <span key={idx} className="zenon-chip zenon-chip-purple">
            {clean}
          </span>
        );
      }

      // 4. Prudence, modérée, fatigue, attention -> Ambre
      if (/\b(modérée?|prudence|fatigue|attention|manque|repos|vigilance|court|dette)\b/i.test(lower)) {
        return (
          <span key={idx} className="zenon-chip zenon-chip-amber">
            {clean}
          </span>
        );
      }

      // 5. Autre mise en valeur -> Or / Blanc pur
      return (
        <span key={idx} className="zenon-chip zenon-chip-gold">
          {clean}
        </span>
      );
    }

    // Texte normal
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

export const ZenonRichAnswer: React.FC<ZenonRichAnswerProps> = ({ content }) => {
  if (!content) return null;

  // Découpage en blocs / paragraphes / puces
  const rawLines = content.split('\n').map((l) => l.trim()).filter(Boolean);

  // Regroupement des puces consécutives ou éléments
  const blocks: { type: 'paragraph' | 'bullet' | 'tip'; text: string }[] = [];

  for (const line of rawLines) {
    if (line.startsWith('💡') || line.toLowerCase().startsWith('conseil') || line.toLowerCase().startsWith('recommandation')) {
      blocks.push({ type: 'tip', text: line.replace(/^💡\s*/, '') });
    } else if (line.startsWith('•') || line.startsWith('-') || line.startsWith('* ')) {
      blocks.push({ type: 'bullet', text: line.replace(/^[•\-*]\s*/, '') });
    } else {
      // Si la ligne contient une puce au milieu (ex: "matin : • Sommeil..."), on scinde
      const bulletSplit = line.split(/\s+[•\-]\s+/);
      if (bulletSplit.length > 1) {
        blocks.push({ type: 'paragraph', text: bulletSplit[0] });
        for (let i = 1; i < bulletSplit.length; i++) {
          blocks.push({ type: 'bullet', text: bulletSplit[i] });
        }
      } else {
        blocks.push({ type: 'paragraph', text: line });
      }
    }
  }

  return (
    <div className="zenon-answer-container">
      {blocks.map((block, i) => {
        if (block.type === 'tip') {
          return (
            <div key={i} className="zenon-recommendation-box">
              <div className="zenon-tip-icon">
                <Lightbulb size={16} color="#30D158" />
              </div>
              <div className="zenon-tip-text">
                <span className="zenon-tip-badge">Recommandation du jour</span>
                <div>{renderInlineHighlight(block.text)}</div>
              </div>
            </div>
          );
        }

        if (block.type === 'bullet') {
          return (
            <div key={i} className="zenon-bullet-card">
              <span className="zenon-bullet-dot" />
              <div className="zenon-bullet-body">{renderInlineHighlight(block.text)}</div>
            </div>
          );
        }

        return (
          <p key={i} className="zenon-paragraph">
            {renderInlineHighlight(block.text)}
          </p>
        );
      })}
    </div>
  );
};
