import React, { useState, useEffect } from 'react';
import { generateStoryDataUrl, StoryData } from '../lib/story';
import { X, Download, Share2, Check } from 'lucide-react';

interface StoryModalProps {
  data: StoryData;
  onClose: () => void;
}

export const StoryModal: React.FC<StoryModalProps> = ({ data, onClose }) => {
  const [dataUrl, setDataUrl] = useState<string>('');
  const [downloaded, setDownloaded] = useState<boolean>(false);

  useEffect(() => {
    generateStoryDataUrl(data).then((url) => setDataUrl(url));
  }, [data]);

  const handleDownload = () => {
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `vyta-story-${data.mode}-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 2500);
  };

  const handleShare = async () => {
    if (!dataUrl) return;
    try {
      if (navigator.share) {
        const res = await fetch(dataUrl);
        const blob = await res.blob();
        const file = new File([blob], 'vyta-story.png', { type: 'image/png' });
        await navigator.share({
          title: 'Vyta Story',
          text: `Séance ${data.title} enregistrée avec Vyta One`,
          files: [file],
        });
      } else {
        handleDownload();
      }
    } catch {
      handleDownload();
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ zIndex: 150 }}>
      <div
        className="modal-sheet"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxHeight: '94%',
          alignItems: 'center',
          background: '#09090B',
          borderColor: 'var(--gold-border)',
        }}
      >
        <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Export Viral 9:16
            </span>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#FFFFFF', margin: 0 }}>
              Story Instagram Noir & Or
            </h3>
          </div>

          <button type="button" className="modal-close-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {/* 9:16 Story Preview container */}
        <div
          style={{
            width: '240px',
            height: '426px', // 9:16 ratio
            borderRadius: '20px',
            overflow: 'hidden',
            border: '1.5px solid var(--gold-border)',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.9), 0 0 30px rgba(184, 35, 72, 0.15)',
            position: 'relative',
            background: '#050507',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {dataUrl ? (
            <img
              src={dataUrl}
              alt="Story Preview 9:16"
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          ) : (
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Rendu Noir & Or...</span>
          )}
        </div>

        {/* Export & Share buttons */}
        <div style={{ width: '100%', display: 'flex', gap: '10px' }}>
          <button
            type="button"
            className="apple-pay-btn"
            style={{
              flex: 1,
              background: 'var(--gold-gradient)',
              color: '#FFFFFF',
              fontWeight: 700,
              fontSize: '13.5px',
            }}
            onClick={handleDownload}
          >
            {downloaded ? <Check size={16} /> : <Download size={16} />}
            <span>{downloaded ? 'Enregistrée !' : 'Télécharger (PNG 1080p)'}</span>
          </button>

          <button
            type="button"
            className="gear-btn"
            style={{ width: '48px', height: '48px', borderRadius: '12px' }}
            onClick={handleShare}
            title="Partager directement"
          >
            <Share2 size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};
