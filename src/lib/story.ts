import { run } from '../data/fit';
import { fmtClockSec, fmtMMSS, fmtNum } from './format';

export interface StoryData {
  mode: 'run' | 'gym';
  title: string;
  dateStr: string;
  stats: { label: string; value: string; unit?: string }[];
  accentText?: string;
  tonnageKg?: number;
}

export function generateStoryDataUrl(data: StoryData): Promise<string> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1920;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      resolve('');
      return;
    }

    // 1. Pure dark luxury background
    ctx.fillStyle = '#050507';
    ctx.fillRect(0, 0, 1080, 1920);

    // Subtle dark radial gradient
    const radial = ctx.createRadialGradient(540, 700, 50, 540, 700, 700);
    radial.addColorStop(0, 'rgba(77, 11, 32, 0.25)');
    radial.addColorStop(1, 'rgba(5, 5, 7, 0)');
    ctx.fillStyle = radial;
    ctx.fillRect(0, 0, 1080, 1920);

    // 2. Bordeaux Top Accent Line
    const bordeauxGrad = ctx.createLinearGradient(140, 0, 940, 0);
    bordeauxGrad.addColorStop(0, '#4D0B20');
    bordeauxGrad.addColorStop(0.5, '#EFA0B4');
    bordeauxGrad.addColorStop(1, '#A31F44');

    ctx.strokeStyle = bordeauxGrad;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(140, 120);
    ctx.lineTo(940, 120);
    ctx.stroke();

    // 3. VYTA Brand & Hardware Tag
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 44px -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif';
    ctx.letterSpacing = '10px';
    ctx.textAlign = 'left';
    ctx.fillText('VYTA', 140, 200);

    ctx.fillStyle = '#F096A8';
    ctx.font = '600 24px -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif';
    ctx.letterSpacing = '3px';
    ctx.textAlign = 'right';
    ctx.fillText('VYTA ONE · R21', 940, 195);

    // 4. Session Title & Subtitle
    ctx.fillStyle = '#8E8E93';
    ctx.font = '500 28px -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
    ctx.textAlign = 'left';
    ctx.letterSpacing = '1px';
    ctx.fillText(data.dateStr.toUpperCase(), 140, 290);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 64px -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif';
    ctx.letterSpacing = '-1px';
    ctx.fillText(data.title, 140, 370);

    // 5. Visual Centerpiece (GPS Trace or Heavy Tonnage Medal)
    if (data.mode === 'run') {
      // Draw Authentic Apple Maps Parc Monceau in Dark Mode on 1080x1920 Canvas
      ctx.save();
      ctx.translate(540, 780);

      // 1. Map Card Backdrop with subtle rounded border
      ctx.fillStyle = '#141417';
      ctx.beginPath();
      ctx.roundRect(-420, -320, 840, 640, 36);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Clip inside map card
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(-420, -320, 840, 640, 36);
      ctx.clip();

      // Roads (Boulevard de Courcelles top arterial)
      ctx.strokeStyle = '#282830';
      ctx.lineWidth = 32;
      ctx.beginPath();
      ctx.moveTo(-450, -220);
      ctx.lineTo(450, -220);
      ctx.stroke();

      // Dashed lane divider
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 2;
      ctx.setLineDash([12, 16]);
      ctx.beginPath();
      ctx.moveTo(-450, -220);
      ctx.lineTo(450, -220);
      ctx.stroke();
      ctx.setLineDash([]);

      // Parc Monceau Lush Green Polygon
      ctx.fillStyle = '#122515';
      ctx.strokeStyle = '#1A381F';
      ctx.lineWidth = 3;
      ctx.beginPath();
      const pPoly = [
        [-300, -190], [0, -190], [300, -190],
        [340, -60], [320, 100], [240, 230],
        [80, 260], [-120, 250], [-260, 210],
        [-320, 80], [-330, -60]
      ];
      pPoly.forEach(([px, py], idx) => {
        if (idx === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Water Basin: La Naumachie
      ctx.fillStyle = '#0F2133';
      ctx.strokeStyle = '#1E3B57';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(-120, -20, 75, 45, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Internal gravel paths
      ctx.strokeStyle = '#1D3522';
      ctx.lineWidth = 12;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.ellipse(0, 30, 290, 190, 0, 0, Math.PI * 2);
      ctx.stroke();

      // Apple Maps Text: PARC MONCEAU
      ctx.fillStyle = 'rgba(229, 229, 234, 0.85)';
      ctx.font = 'bold 26px -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
      ctx.letterSpacing = '4px';
      ctx.textAlign = 'center';
      ctx.fillText('PARC MONCEAU', 30, 40);

      // Apple Fitness Glowing Route
      const paceGradient = ctx.createLinearGradient(-300, -200, 300, 200);
      paceGradient.addColorStop(0, '#FF9F0A');
      paceGradient.addColorStop(0.3, '#FFD60A');
      paceGradient.addColorStop(0.7, '#30D158');
      paceGradient.addColorStop(1, '#20E670');

      ctx.strokeStyle = paceGradient;
      ctx.lineWidth = 14;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.shadowColor = '#30D158';
      ctx.shadowBlur = 30;

      // Draw perimeter running route
      ctx.beginPath();
      const numPts = 120;
      for (let i = 0; i <= numPts; i++) {
        const a = (i / numPts) * Math.PI * 1.94;
        const rx = 280 + 20 * Math.sin(3 * a);
        const ry = 180 + 15 * Math.cos(2 * a);
        const px = rx * Math.cos(a - Math.PI / 2);
        const py = ry * Math.sin(a - Math.PI / 2) + 20;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();

      // Start & Finish points
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#30D158';
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, -170, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#FF453A';
      ctx.beginPath();
      ctx.arc(45, -165, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Apple Maps Logo in bottom-right of map
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.font = '600 20px -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
      ctx.textAlign = 'right';
      ctx.letterSpacing = '1px';
      ctx.fillText(' Plans', 390, 290);

      ctx.restore();
      ctx.restore();
    } else {
      // Musculation: Golden Heavy Trophy / Ring graphic
      ctx.save();
      ctx.translate(540, 800);

      // Concentric metallic bordeaux rings
      ctx.strokeStyle = 'rgba(77, 11, 32, 0.4)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 320, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = bordeauxGrad;
      ctx.lineWidth = 8;
      ctx.shadowColor = '#A31F44';
      ctx.shadowBlur = 30;
      ctx.beginPath();
      ctx.arc(0, 0, 220, 0, Math.PI * 2);
      ctx.stroke();

      // Center tonnage callout
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 110px -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif';
      ctx.textAlign = 'center';
      const tonnageStr = data.tonnageKg ? (data.tonnageKg / 1000).toFixed(1) : '5.8';
      ctx.fillText(`${tonnageStr} t`, 0, 25);

      ctx.fillStyle = '#EFA0B4';
      ctx.font = '600 30px -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
      ctx.letterSpacing = '4px';
      ctx.fillText('CHARGE TOTALE', 0, 90);
      ctx.restore();
    }

    // 6. Highlight Badge (e.g. Nouveau Record / Session Validée)
    if (data.accentText) {
      const badgeY = 1200;
      ctx.save();
      ctx.fillStyle = 'rgba(77, 11, 32, 0.35)';
      ctx.strokeStyle = '#A31F44';
      ctx.lineWidth = 2;
      const bw = 460;
      const bh = 64;
      const bx = 540 - bw / 2;
      ctx.beginPath();
      ctx.roundRect(bx, badgeY, bw, bh, 32);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#EFA0B4';
      ctx.font = '600 26px -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`✨ ${data.accentText}`, 540, badgeY + 42);
      ctx.restore();
    }

    // 7. 4 Key Metric Cards (2x2 Grid)
    const startY = 1320;
    const cardW = 380;
    const cardH = 160;
    const positions = [
      { x: 140, y: startY },
      { x: 560, y: startY },
      { x: 140, y: startY + 190 },
      { x: 560, y: startY + 190 },
    ];

    data.stats.slice(0, 4).forEach((stat, i) => {
      const pos = positions[i];
      // Card background
      ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(pos.x, pos.y, cardW, cardH, 24);
      ctx.fill();
      ctx.stroke();

      // Label
      ctx.fillStyle = '#8E8E93';
      ctx.font = '500 24px -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(stat.label.toUpperCase(), pos.x + 30, pos.y + 50);

      // Value
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 54px -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif';
      ctx.fillText(stat.value, pos.x + 30, pos.y + 118);

      if (stat.unit) {
        ctx.fillStyle = '#F096A8';
        ctx.font = '600 26px -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
        const valWidth = ctx.measureText(stat.value).width;
        ctx.fillText(stat.unit, pos.x + 35 + valWidth, pos.y + 118);
      }
    });

    // 8. Footer Watermark & Ring Sensor Authenticity
    ctx.fillStyle = '#636366';
    ctx.font = '500 24px -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
    ctx.textAlign = 'center';
    ctx.letterSpacing = '2px';
    ctx.fillText('ENREGISTRÉ PAR CAPTEURS OPTIQUES ET ACCÉLÉROMÈTRE VYTA ONE', 540, 1820);

    resolve(canvas.toDataURL('image/png'));
  });
}
