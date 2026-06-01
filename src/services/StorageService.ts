const STORAGE_KEYS = {
  SELECTED_EXAM: 'selectedExam',
  SELECTED_VERSION: 'selectedVersion'
};

export class StorageService {
  static saveSelectedExam(examId: string): void {
    localStorage.setItem(STORAGE_KEYS.SELECTED_EXAM, examId);
  }

  static saveSelectedVersion(versionId: string): void {
    localStorage.setItem(STORAGE_KEYS.SELECTED_VERSION, versionId);
  }

  static getSelectedExam(): string | null {
    return localStorage.getItem(STORAGE_KEYS.SELECTED_EXAM);
  }

  static getSelectedVersion(): string | null {
    return localStorage.getItem(STORAGE_KEYS.SELECTED_VERSION);
  }
}
