import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useTheme = create(
  persist(
    (set) => ({
      theme: 'normal',
      toggleTheme: () =>
        set((state) => ({
          theme: state.theme === 'normal' ? 'dark' : 'normal',
        })),
      // For more descriptive naming in components
      isAlertMode: (state) => state.theme === 'dark',
      isNormalMode: (state) => state.theme === 'normal',
    }),
    {
      name: 'starship-theme-storage',
    }
  )
);