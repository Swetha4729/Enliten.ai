import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';

interface ExamContextType {
  exam: any;
  setExam: (exam: any) => void;
  subject: any;
  setSubject: (subject: any) => void;
}

const ExamContext = createContext<ExamContextType | undefined>(undefined);

export function ExamProvider({ children }: { children: ReactNode }) {
  const [exam, setExamState] = useState<any>(null);
  const [subject, setSubject] = useState<any>(null);

  // Load exam from storage on mount
  useEffect(() => {
    let loaded = false;
    (async () => {
      try {
        const storedExam = await AsyncStorage.getItem('selectedExam');
        if (storedExam) {
          setExamState(JSON.parse(storedExam));
          console.log('[ExamProvider] Loaded exam from storage', storedExam);
        } else {
          console.log('[ExamProvider] No exam found in storage');
        }
        loaded = true;
      } catch (e) {
        console.error('[ExamProvider] Error loading exam from storage:', e);
      }
    })();
    // Timeout fallback
    const timeout = setTimeout(() => {
      if (!loaded) {
        console.error('[ExamProvider] Timeout: exam not loaded after 5s');
      }
    }, 5000);
    return () => clearTimeout(timeout);
  }, []);

  // Save exam to storage
  const setExam = (exam: any) => {
    setExamState(exam);
    if (exam) {
      AsyncStorage.setItem('selectedExam', JSON.stringify(exam))
        .then(() => console.log('[ExamProvider] Saved exam to storage', exam))
        .catch((e) => console.error('[ExamProvider] Error saving exam to storage:', e));
    } else {
      AsyncStorage.removeItem('selectedExam')
        .then(() => console.log('[ExamProvider] Cleared exam from storage'))
        .catch((e) => console.error('[ExamProvider] Error clearing exam from storage:', e));
    }
  };

  return (
    <ExamContext.Provider value={{ exam, setExam, subject, setSubject }}>
      {children}
    </ExamContext.Provider>
  );
}

export function useExam() {
  const context = useContext(ExamContext);
  if (!context) throw new Error('useExam must be used within an ExamProvider');
  return context;
} 