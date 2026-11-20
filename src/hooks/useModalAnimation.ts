import { useState, useCallback } from 'react';

/**
 * Hook to manage modal open/close transitions with Apple-style fluid deceleration.
 * Sets `isClosing` state to trigger exit animations before unmounting.
 */
export function useModalAnimation(onClose: () => void, duration = 310) {
  const [isClosing, setIsClosing] = useState(false);

  const handleClose = useCallback(() => {
    if (isClosing) return;
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, duration);
  }, [isClosing, onClose, duration]);

  return { isClosing, handleClose };
}

/**
 * Installs global interactive vertical drag-to-dismiss on every `.modal-sheet` /
 * `.metric-detail-sheet` overlay so users can smoothly pull down any modal sheet to close it.
 */
export function installGlobalModalSheetDrag(): () => void {
  if (typeof document === 'undefined') return () => {};

  let activeSheet: HTMLElement | null = null;
  let activeBackdrop: HTMLElement | null = null;
  let startX = 0;
  let startY = 0;
  let startTs = 0;
  let dragging = false;
  let currentDy = 0;
  let canDragFromTarget = false;

  const isScrollableAtTop = (target: EventTarget | null, sheet: HTMLElement): boolean => {
    let el = target instanceof HTMLElement ? target : null;
    while (el && el !== sheet) {
      const style = window.getComputedStyle(el);
      const overflowY = style.overflowY;
      if ((overflowY === 'auto' || overflowY === 'scroll') && el.scrollHeight > el.clientHeight) {
        if (el.scrollTop > 2) return false;
      }
      el = el.parentElement;
    }
    return sheet.scrollTop <= 2;
  };

  const onTouchStart = (e: TouchEvent) => {
    if (e.touches.length !== 1) return;
    const rawTarget = e.target as HTMLElement | null;
    if (!rawTarget) return;
    if (rawTarget.closest('input, textarea, select, [data-no-sheet-drag], .no-sheet-drag')) return;

    const sheet = rawTarget.closest('.modal-sheet, .metric-detail-sheet') as HTMLElement | null;
    if (!sheet || sheet.classList.contains('is-closing') || sheet.classList.contains('sheet-drag-dismissed')) return;
    const backdrop = sheet.closest('.modal-backdrop') as HTMLElement | null;
    if (!backdrop) return;

    const rect = sheet.getBoundingClientRect();
    const inHeaderZone = e.touches[0].clientY - rect.top <= 84;
    if (!inHeaderZone && !isScrollableAtTop(rawTarget, sheet)) return;

    activeSheet = sheet;
    activeBackdrop = backdrop;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    startTs = Date.now();
    dragging = false;
    currentDy = 0;
    canDragFromTarget = true;
  };

  const onTouchMove = (e: TouchEvent) => {
    if (!canDragFromTarget || !activeSheet || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - startX;
    const dy = e.touches[0].clientY - startY;

    if (!dragging) {
      if (dy > 10 && Math.abs(dy) > Math.abs(dx) * 1.25) {
        dragging = true;
        activeSheet.classList.add('sheet-drag-active');
        activeSheet.style.transition = 'none';
        if (activeBackdrop) activeBackdrop.style.transition = 'none';
      } else if (Math.abs(dx) > 12 || dy < -10) {
        canDragFromTarget = false;
        activeSheet = null;
        activeBackdrop = null;
        return;
      }
    }

    if (dragging && activeSheet) {
      const clampedDy = Math.max(0, dy);
      currentDy = clampedDy;
      activeSheet.style.transform = `translate3d(0, ${clampedDy}px, 0)`;
      if (activeBackdrop) {
        activeBackdrop.style.opacity = String(Math.max(0.18, 1 - clampedDy / 520));
      }
      if (e.cancelable) e.preventDefault();
    }
  };

  const onTouchEnd = () => {
    if (!activeSheet) {
      canDragFromTarget = false;
      return;
    }
    const sheet = activeSheet;
    const backdrop = activeBackdrop;
    const dy = currentDy;
    const dt = Math.max(16, Date.now() - startTs);
    const velocity = dy / dt;
    const wasDragging = dragging;

    activeSheet = null;
    activeBackdrop = null;
    dragging = false;
    canDragFromTarget = false;
    currentDy = 0;

    if (!wasDragging) return;

    if (dy > 90 || (velocity > 0.45 && dy > 32)) {
      sheet.classList.remove('sheet-drag-active');
      sheet.classList.add('sheet-drag-dismissed');
      sheet.style.transition = 'transform 260ms cubic-bezier(0.32, 0.72, 0, 1)';
      sheet.style.transform = 'translate3d(0, 100%, 0)';
      if (backdrop) {
        backdrop.style.transition = 'opacity 240ms cubic-bezier(0.32, 0.72, 0, 1)';
        backdrop.style.opacity = '0';
        window.setTimeout(() => {
          try { backdrop.click(); } catch (_) {}
        }, 120);
      }
    } else {
      sheet.style.transition = 'transform 360ms cubic-bezier(0.16, 1, 0.3, 1)';
      sheet.style.transform = 'translate3d(0, 0, 0)';
      if (backdrop) {
        backdrop.style.transition = 'opacity 260ms ease';
        backdrop.style.opacity = '1';
      }
      window.setTimeout(() => {
        sheet.classList.remove('sheet-drag-active');
        sheet.style.transition = '';
        sheet.style.transform = '';
        if (backdrop) {
          backdrop.style.transition = '';
          backdrop.style.opacity = '';
        }
      }, 370);
    }
  };

  document.addEventListener('touchstart', onTouchStart, { passive: true });
  document.addEventListener('touchmove', onTouchMove, { passive: false });
  document.addEventListener('touchend', onTouchEnd, { passive: true });
  document.addEventListener('touchcancel', onTouchEnd, { passive: true });

  return () => {
    document.removeEventListener('touchstart', onTouchStart);
    document.removeEventListener('touchmove', onTouchMove);
    document.removeEventListener('touchend', onTouchEnd);
    document.removeEventListener('touchcancel', onTouchEnd);
  };
}
