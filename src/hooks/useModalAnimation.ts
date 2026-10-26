import { useState, useCallback } from 'react';

/**
 * Hook to manage modal open/close transitions with Apple-style motion blur.
 * Sets `isClosing` state to trigger exit animations before unmounting.
 */
export function useModalAnimation(onClose: () => void, duration = 250) {
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
