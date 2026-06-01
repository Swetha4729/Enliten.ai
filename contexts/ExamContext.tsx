import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';

interface ExamContextType {
  exam: any;
  setExam: (exam: any) => void;
  subject: any;
  setSubject: (subject: any) => void;
  loading: boolean;
}

const ExamContext = createContext<ExamContextType | undefined>(undefined);

export function ExamProvider({ children }: { children: ReactNode }) {
  const [exam, setExamState] = useState<any>(null);
  const [subject, setSubjectState] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadState() {
      try {
        const storedExam = await AsyncStorage.getItem('selectedExam');
        if (storedExam) {
          setExamState(JSON.parse(storedExam));
        }
        const storedSubject = await AsyncStorage.getItem('selectedSubject');
        if (storedSubject) {
          setSubjectState(JSON.parse(storedSubject));
        }
      } catch (e) {
        console.error('[ExamProvider] Failed to load state from storage', e);
      } finally {
        setLoading(false);
      }
    }
    loadState();
  }, []);

  const setExam = (exam: any) => {
    setExamState(exam);
    if (exam) {
      AsyncStorage.setItem('selectedExam', JSON.stringify(exam));
    } else {
      AsyncStorage.removeItem('selectedExam');
    }
  };

  const setSubject = (subject: any) => {
    setSubjectState(subject);
    if (subject) {
      AsyncStorage.setItem('selectedSubject', JSON.stringify(subject));
    } else {
      AsyncStorage.removeItem('selectedSubject');
    }
  };

  return (
    <ExamContext.Provider value={{ exam, setExam, subject, setSubject, loading }}>
      {children}
    </ExamContext.Provider>
  );
}

export function useExam() {
  const context = useContext(ExamContext);
  if (!context) throw new Error('useExam must be used within an ExamProvider');
  return context;
}
