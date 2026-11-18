import { useState } from 'react';
import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import {
  Home,
  LineChart,
  CreditCard,
  MessageCircle,
  Trophy,
  User,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import './bottom-nav-bar.css';

export interface BottomNavItem {
  id?: string;
  label: string;
  icon: LucideIcon;
}

const defaultNavItems: BottomNavItem[] = [
  { label: 'Home', icon: Home },
  { label: 'Portfolio', icon: LineChart },
  { label: 'Transactions', icon: CreditCard },
  { label: 'Messages', icon: MessageCircle },
  { label: 'Rewards', icon: Trophy },
  { label: 'Profile', icon: User },
];

const MOBILE_LABEL_WIDTH = 66;

export type BottomNavBarProps = {
  items?: BottomNavItem[];
  activeIndex?: number;
  onChange?: (index: number) => void;
  className?: string;
  defaultIndex?: number;
  stickyBottom?: boolean;
};

export function BottomNavBar({
  items = defaultNavItems,
  activeIndex: controlledIndex,
  onChange,
  className,
  defaultIndex = 0,
  stickyBottom = false,
}: BottomNavBarProps) {
  const [internalIndex, setInternalIndex] = useState(defaultIndex);
  const activeIndex = controlledIndex !== undefined ? controlledIndex : internalIndex;

  const handleSelect = (idx: number) => {
    if (controlledIndex === undefined) {
      setInternalIndex(idx);
    }
    onChange?.(idx);
  };

  return (
    <motion.nav
      initial={{ scale: 0.92, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 26 }}
      role="navigation"
      aria-label="Bottom Navigation"
      className={cn(
        'aurel-bottom-nav',
        stickyBottom && 'aurel-bottom-nav--sticky',
        className,
      )}
    >
      {items.map((item, idx) => {
        const Icon = item.icon;
        const isActive = activeIndex === idx;

        return (
          <motion.button
            key={item.id || item.label}
            whileTap={{ scale: 0.96 }}
            className={cn('aurel-bottom-nav__btn', isActive && 'is-active')}
            onClick={() => handleSelect(idx)}
            aria-label={item.label}
            aria-current={isActive ? 'page' : undefined}
            type="button"
          >
            <Icon
              size={20}
              strokeWidth={2}
              aria-hidden
              className="aurel-bottom-nav__icon"
            />

            <motion.div
              initial={false}
              animate={{
                width: isActive ? `${MOBILE_LABEL_WIDTH}px` : '0px',
                opacity: isActive ? 1 : 0,
                marginLeft: isActive ? '7px' : '0px',
              }}
              transition={{
                width: { type: 'spring', stiffness: 350, damping: 32 },
                opacity: { duration: 0.19 },
                marginLeft: { duration: 0.19 },
              }}
              className="aurel-bottom-nav__label-wrap"
            >
              <span className="aurel-bottom-nav__label" title={item.label}>
                {item.label}
              </span>
            </motion.div>
          </motion.button>
        );
      })}
    </motion.nav>
  );
}

export default BottomNavBar;
