import React, { createContext, useContext, useState } from 'react';

export type Language = 'en' | 'zh';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (en: string, zh: string) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'en',
  setLanguage: () => {},
  t: (en) => en,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>(
    () => (localStorage.getItem('language') as Language) ?? 'en'
  );

  function handleSet(lang: Language) {
    setLanguage(lang);
    localStorage.setItem('language', lang);
  }

  const t = (en: string, zh: string) => language === 'zh' ? zh : en;

  return (
    <LanguageContext.Provider value={{ language, setLanguage: handleSet, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
