import { AlertTriangle, ShieldCheck } from 'lucide-react';
import { Button } from './ui/button';
import { useTheme } from '@/store/theme';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  
  return (
    <Button
      variant={theme === 'normal' ? 'outline' : 'destructive'}
      size="sm"
      onClick={toggleTheme}
      className="fixed bottom-4 right-4 font-space font-medium transition-all duration-300 hover:shadow-glow"
    >
      {theme === 'normal' ? (
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4" />
          <span>NORMAL OPERATIONS</span>
        </div>
      ) : (
        <div className="flex items-center gap-2 animate-pulse">
          <AlertTriangle className="h-4 w-4" />
          <span>RED ALERT</span>
        </div>
      )}
    </Button>
  );
}
