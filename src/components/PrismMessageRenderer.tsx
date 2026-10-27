import React from 'react';

interface PrismMessageRendererProps {
  text: string;
}

/**
 * Rendu visuel riche pour les réponses de l'IA Prism :
 * - Cartes numérotées distinctes pour les points clés
 * - Puces visuelles néon
 * - Badges colorés automatiques pour les biométries (VFC, bpm, %, °C, heures)
 * - Boîtes d'action / conseils éclairées (💡, ⚡, 🎯, 🔬)
 * - Typographie aérée, lisible et contrastée
 */
export const PrismMessageRenderer: React.FC<PrismMessageRendererProps> = ({ text }) => {
  // 1. Découpage en blocs sémantiques
  const lines = text.trim().split('\n');
  const blocks: Array<{
    type: 'p' | 'h3' | 'numbered' | 'bullet' | 'callout';
    content: string;
    num?: string;
  }> = [];

  let currentParagraphLines: string[] = [];

  const flushParagraph = () => {
    if (currentParagraphLines.length > 0) {
      blocks.push({
        type: 'p',
        content: currentParagraphLines.join('\n'),
      });
      currentParagraphLines = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (!trimmed) {
      flushParagraph();
      continue;
    }

    // Callout (💡, ⚡, 🎯, 🔬, ⚠️)
    if (
      trimmed.startsWith('💡') ||
      trimmed.startsWith('⚡') ||
      trimmed.startsWith('🎯') ||
      trimmed.startsWith('🔬') ||
      trimmed.startsWith('⚠️')
    ) {
      flushParagraph();
      blocks.push({ type: 'callout', content: trimmed });
      continue;
    }

    // Titres Markdown (### ou ##)
    if (trimmed.startsWith('### ') || trimmed.startsWith('## ')) {
      flushParagraph();
      blocks.push({
        type: 'h3',
        content: trimmed.replace(/^#{2,3}\s+/, ''),
      });
      continue;
    }

    // Liste numérotée (1. **Titre** ou 1. Texte)
    const numMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (numMatch) {
      flushParagraph();
      blocks.push({
        type: 'numbered',
        num: numMatch[1],
        content: numMatch[2],
      });
      continue;
    }

    // Liste à puces (- ou • ou *)
    const bulletMatch = trimmed.match(/^[-•*]\s+(.*)$/);
    if (bulletMatch) {
      flushParagraph();
      blocks.push({
        type: 'bullet',
        content: bulletMatch[1],
      });
      continue;
    }

    currentParagraphLines.push(trimmed);
  }

  flushParagraph();

  // 2. Tokenizer pour formater le texte en ligne (gras + badges biométriques)
  const renderInlineText = (rawStr: string): React.ReactNode => {
    // Regex pour détecter les valeurs biométriques
    // ex: 74 ms, 51 bpm, 89/100, 78 %, 1h52, +0.1°C, 11 240 pas, 8.4 km, 460 kcal
    const metricRegex = /(\b\d+(?:[.,]\d+)?\s*(?:ms|bpm|%|°C|mmHg|kcal|km|pas)\b|\b\d+\s*\/\s*100\b|\b\d+h\d+(?:m|min)?\b)/gi;

    // Découpe par gras **
    const boldParts = rawStr.split('**');

    return boldParts.map((part, pIdx) => {
      const isBold = pIdx % 2 === 1;

      // Découpe par métriques
      const tokens = part.split(metricRegex);

      return (
        <React.Fragment key={pIdx}>
          {tokens.map((token, tIdx) => {
            if (!token) return null;

            // Test si c'est une métrique
            const isMetric = metricRegex.test(token);
            // Réinitialiser le regex (flag g)
            metricRegex.lastIndex = 0;

            if (isMetric) {
              const lower = token.toLowerCase();
              let color = '#38BDF8'; // cyan par défaut
              let bg = 'rgba(56, 189, 248, 0.12)';
              let border = 'rgba(56, 189, 248, 0.3)';

              if (lower.includes('ms')) {
                // VFC / Récupération -> Vert Vitalité
                color = '#D9F970';
                bg = 'rgba(217, 249, 112, 0.14)';
                border = 'rgba(217, 249, 112, 0.35)';
              } else if (lower.includes('bpm')) {
                // Rythme cardiaque -> Rose néon
                color = '#FF6482';
                bg = 'rgba(255, 100, 130, 0.14)';
                border = 'rgba(255, 100, 130, 0.35)';
              } else if (lower.includes('°c')) {
                // Température -> Ambre
                color = '#FBBF24';
                bg = 'rgba(251, 191, 36, 0.14)';
                border = 'rgba(251, 191, 36, 0.35)';
              } else if (lower.includes('h') || lower.includes('min')) {
                // Sommeil -> Lavande
                color = '#C084FC';
                bg = 'rgba(192, 132, 252, 0.14)';
                border = 'rgba(192, 132, 252, 0.35)';
              } else if (lower.includes('/100') || lower.includes('%')) {
                // Score global / Énergie -> Cyan
                color = '#38BDF8';
                bg = 'rgba(56, 189, 248, 0.14)';
                border = 'rgba(56, 189, 248, 0.35)';
              } else if (lower.includes('pas') || lower.includes('km') || lower.includes('kcal')) {
                // Activité physique -> Émeraude
                color = '#34D399';
                bg = 'rgba(52, 211, 153, 0.14)';
                border = 'rgba(52, 211, 153, 0.35)';
              }

              return (
                <span
                  key={tIdx}
                  style={{
                    display: 'inline-block',
                    padding: '1px 6px',
                    margin: '0 2px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 700,
                    letterSpacing: '-0.1px',
                    color,
                    background: bg,
                    border: `1px solid ${border}`,
                    verticalAlign: 'baseline',
                  }}
                >
                  {token}
                </span>
              );
            }

            if (isBold) {
              return (
                <strong
                  key={tIdx}
                  style={{
                    color: '#FAF7F2',
                    fontWeight: 700,
                  }}
                >
                  {token}
                </strong>
              );
            }

            return <span key={tIdx}>{token}</span>;
          })}
        </React.Fragment>
      );
    });
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        fontSize: '13.5px',
        lineHeight: 1.55,
        color: 'rgba(250, 247, 242, 0.92)',
      }}
    >
      {blocks.map((block, idx) => {
        // 1. Titre Markdown
        if (block.type === 'h3') {
          return (
            <div
              key={idx}
              style={{
                fontSize: '13px',
                fontWeight: 700,
                color: '#D9F970',
                letterSpacing: '0.02em',
                textTransform: 'uppercase',
                marginTop: idx > 0 ? '6px' : '0',
                marginBottom: '2px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span
                style={{
                  width: '4px',
                  height: '12px',
                  borderRadius: '2px',
                  background: '#D9F970',
                  boxShadow: '0 0 6px rgba(217, 249, 112, 0.6)',
                }}
              />
              <span>{block.content}</span>
            </div>
          );
        }

        // 2. Carte Numérotée (Explications / Raisons)
        if (block.type === 'numbered') {
          return (
            <div
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                padding: '10px 12px',
                borderRadius: '14px',
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.09)',
                margin: '2px 0',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)',
              }}
            >
              <div
                style={{
                  flexShrink: 0,
                  width: '22px',
                  height: '22px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.25) 0%, rgba(192, 132, 252, 0.25) 100%)',
                  border: '1px solid rgba(255, 255, 255, 0.25)',
                  color: '#FAF7F2',
                  fontSize: '11px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginTop: '1px',
                }}
              >
                {block.num}
              </div>
              <div style={{ flex: 1, fontSize: '13px', lineHeight: 1.5 }}>
                {renderInlineText(block.content)}
              </div>
            </div>
          );
        }

        // 3. Puce Visuelle (Listes)
        if (block.type === 'bullet') {
          return (
            <div
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                padding: '2px 4px',
                fontSize: '13px',
                lineHeight: 1.5,
              }}
            >
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: '#D9F970',
                  boxShadow: '0 0 6px rgba(217, 249, 112, 0.7)',
                  marginTop: '7px',
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1 }}>{renderInlineText(block.content)}</div>
            </div>
          );
        }

        // 4. Encadré / Callout (Conseils & Verdicts clairs)
        if (block.type === 'callout') {
          const isTip = block.content.startsWith('💡');
          const isVerdict = block.content.startsWith('⚡');
          const isAction = block.content.startsWith('🎯');

          let accentColor = '#38BDF8';
          let bgColor = 'rgba(56, 189, 248, 0.08)';
          let borderColor = 'rgba(56, 189, 248, 0.28)';

          if (isTip) {
            accentColor = '#FBBF24';
            bgColor = 'rgba(251, 191, 36, 0.09)';
            borderColor = 'rgba(251, 191, 36, 0.3)';
          } else if (isVerdict) {
            accentColor = '#D9F970';
            bgColor = 'rgba(217, 249, 112, 0.09)';
            borderColor = 'rgba(217, 249, 112, 0.3)';
          } else if (isAction) {
            accentColor = '#C084FC';
            bgColor = 'rgba(192, 132, 252, 0.09)';
            borderColor = 'rgba(192, 132, 252, 0.3)';
          }

          return (
            <div
              key={idx}
              style={{
                padding: '11px 14px',
                borderRadius: '14px',
                background: bgColor,
                border: `1px solid ${borderColor}`,
                borderLeft: `4px solid ${accentColor}`,
                fontSize: '13px',
                lineHeight: 1.5,
                margin: '4px 0',
                boxShadow: `0 4px 16px ${bgColor}`,
              }}
            >
              {renderInlineText(block.content)}
            </div>
          );
        }

        // 5. Paragraphe standard
        return (
          <p
            key={idx}
            style={{
              margin: '0',
              fontSize: '13.5px',
              lineHeight: 1.55,
              color: 'rgba(250, 247, 242, 0.94)',
            }}
          >
            {renderInlineText(block.content)}
          </p>
        );
      })}
    </div>
  );
};
