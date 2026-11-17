export interface CalAiFoodItem {
  name: string;
  portion: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
}

export interface CalAiAnalysisResult {
  id: string;
  timestamp: string;
  dateKey: string; // YYYY-MM-DD
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  mealName: string;
  imageUrl?: string;
  totalCalories: number;
  macros: {
    protein: number; // in grams
    carbs: number;   // in grams
    fat: number;     // in grams
    fiber?: number;  // in grams
  };
  items: CalAiFoodItem[];
  healthScore?: number; // 0-100
  advice?: string;
}

export interface CalAiDailyTarget {
  calories: number; // default e.g. 2200
  protein: number;  // default e.g. 140
  carbs: number;    // default e.g. 240
  fat: number;      // default e.g. 65
}
