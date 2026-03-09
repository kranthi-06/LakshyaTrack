import { useTheme } from '../context/ThemeContext';
import { motion } from 'framer-motion';
import { Sun, Moon } from 'lucide-react';

interface ThemeToggleProps {
  /** Use 'navbar' for the premium navbar style, 'landing' for transparent/scroll-aware style */
  variant?: 'navbar' | 'landing' | 'standalone';
  className?: string;
}

export const ThemeToggle = ({ variant = 'navbar', className = '' }: ThemeToggleProps) => {
  const { isDark, toggleTheme } = useTheme();

  const baseClasses =
    'relative flex items-center gap-2 rounded-xl font-bold text-xs uppercase tracking-wider transition-all border cursor-pointer select-none';

  const variantClasses = {
    navbar:
      'px-3 py-2 bg-white/10 text-white hover:bg-white/20 border-white/10 backdrop-blur-sm',
    landing:
      'px-3 py-2 bg-white/10 text-white hover:bg-white/20 border-white/10 backdrop-blur-sm',
    standalone:
      'px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700 shadow-sm',
  };

  return (
    <motion.button
      onClick={toggleTheme}
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      whileTap={{ scale: 0.92 }}
      whileHover={{ scale: 1.05 }}
      title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
    >
      <motion.div
        key={isDark ? 'moon' : 'sun'}
        initial={{ y: -12, opacity: 0, rotate: -90 }}
        animate={{ y: 0, opacity: 1, rotate: 0 }}
        exit={{ y: 12, opacity: 0, rotate: 90 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
      >
        {isDark ? (
          <Moon className="w-4 h-4 text-yellow-300" />
        ) : (
          <Sun className="w-4 h-4 text-yellow-300" />
        )}
      </motion.div>
      <span className="hidden sm:inline">
        {isDark ? 'Light' : 'Dark'}
      </span>
    </motion.button>
  );
};
