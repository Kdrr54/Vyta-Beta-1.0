import React, { useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useDragControls } from 'framer-motion';

export const SPRING_SHEET = {
  type: 'spring' as const,
  stiffness: 390,
  damping: 35,
  mass: 0.85,
};

export const SPRING_SNAPPY = {
  type: 'spring' as const,
  stiffness: 480,
  damping: 32,
};

export const EASE_APPLE_OUT = [0.16, 1, 0.3, 1] as const;

interface AnimatedSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  portal?: boolean;
  centered?: boolean;
  enableDrag?: boolean;
  backdropStyle?: React.CSSProperties;
  sheetStyle?: React.CSSProperties;
  sheetClassName?: string;
  role?: string;
}

/**
 * Spring-animated Apple bottom sheet or centered dialog with velocity-aware drag-to-dismiss.
 * Uses only GPU-composited transform and opacity transitions.
 */
export const AnimatedSheet: React.FC<AnimatedSheetProps> = ({
  isOpen,
  onClose,
  children,
  portal = true,
  centered = false,
  enableDrag = !centered,
  backdropStyle,
  sheetStyle,
  sheetClassName = '',
  role = 'dialog',
}) => {
  const dragControls = useDragControls();
  const sheetRef = useRef<HTMLDivElement>(null);

  const content = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="modal-backdrop-spring"
          role={role}
          aria-modal="true"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22, ease: EASE_APPLE_OUT }}
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: centered ? 'center' : 'flex-end',
            alignItems: 'center',
            padding: centered ? '16px' : 0,
            background: 'rgba(0, 0, 0, 0.78)',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
            overflow: 'hidden',
            ...backdropStyle,
          }}
        >
          <motion.div
            ref={sheetRef}
            className={sheetClassName}
            initial={centered ? { opacity: 0, scale: 0.92, y: 18 } : { opacity: 0.85, y: '100%' }}
            animate={centered ? { opacity: 1, scale: 1, y: 0 } : { opacity: 1, y: 0 }}
            exit={
              centered
                ? { opacity: 0, scale: 0.94, y: 12, transition: { duration: 0.16, ease: EASE_APPLE_OUT } }
                : { opacity: 0.85, y: '105%', transition: { duration: 0.24, ease: [0.32, 0, 0.67, 0] } }
            }
            transition={SPRING_SHEET}
            drag={enableDrag ? 'y' : false}
            dragListener={false}
            dragControls={dragControls}
            dragConstraints={{ top: 0, bottom: 420 }}
            dragElastic={{ top: 0.04, bottom: 0.42 }}
            onDragEnd={(_, info) => {
              if (!enableDrag) return;
              if (info.offset.y > 90 || info.velocity.y > 420) {
                onClose();
              }
            }}
            onPointerDown={(e) => {
              if (!enableDrag) return;
              const target = e.target as HTMLElement | null;
              if (!target) return;
              const isHandle = Boolean(target.closest('[data-sheet-drag-handle="true"]'));
              if (!isHandle) {
                if (
                  target.closest(
                    'input, textarea, select, button, a, label, .leaflet-container, canvas, [data-no-sheet-drag="true"]'
                  )
                ) {
                  return;
                }
                if (sheetRef.current && sheetRef.current.scrollTop > 4) {
                  return;
                }
              }
              dragControls.start(e);
            }}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '430px',
              margin: centered ? '0 auto' : '0 auto',
              background: '#121318',
              borderTopLeftRadius: '28px',
              borderTopRightRadius: '28px',
              borderBottomLeftRadius: centered ? '28px' : 0,
              borderBottomRightRadius: centered ? '28px' : 0,
              border: '1px solid rgba(255, 255, 255, 0.14)',
              borderBottom: centered ? '1px solid rgba(255, 255, 255, 0.14)' : 'none',
              padding: centered ? '20px' : '16px 18px calc(22px + env(safe-area-inset-bottom, 0px)) 18px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              boxShadow: '0 -12px 42px rgba(0, 0, 0, 0.9)',
              maxHeight: '90vh',
              overflowY: 'auto',
              willChange: 'transform, opacity',
              ...sheetStyle,
            }}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (portal) {
    if (typeof document === 'undefined') return null;
    return createPortal(content, document.body);
  }
  return content;
};
