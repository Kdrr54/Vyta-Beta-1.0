export interface CalAiFoodItem {
  name: string;
  portion: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
}

export interface YukaAdditive {
  code: string;
  name: string;
  risk: 'low' | 'moderate' | 'high';
}

export interface YukaCriterion {
  label: string;
  value: string;
  detail: string;
}

export interface YukaAnalysis {
  score: number; // 0-100
  rating: 'excellent' | 'good' | 'mediocre' | 'bad';
  brand?: string;
  barcode?: string;
  nutriscore?: 'A' | 'B' | 'C' | 'D' | 'E';
  novaGroup?: 1 | 2 | 3 | 4;
  isOrganic?: boolean;
  sugar?: number; // g
  saturatedFat?: number; // g
  salt?: number; // g
  positives: YukaCriterion[];
  negatives: YukaCriterion[];
  additives: YukaAdditive[];
  alternatives?: Array<{ name: string; brand?: string; reason: string }>;
}

export interface CalAiAnalysisResult {
  id: string;
  timestamp: string;
  dateKey: string; // YYYY-MM-DD
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  mealName: string;
  sourceType?: 'plate' | 'yuka' | 'text';
  imageUrl?: string;
  totalCalories: number;
  macros: {
    protein: number; // in grams
    carbs: number;   // in grams
    fat: number;     // in grams
    fiber?: number;  // in grams
    sugar?: number;  // in grams
  };
  items: CalAiFoodItem[];
  healthScore?: number; // 0-100 (Yuka / Vitalité)
  yuka?: YukaAnalysis;
  advice?: string;
  fixedNote?: string;
}

export interface CalAiDailyTarget {
  calories: number; // default e.g. 2200
  protein: number;  // default e.g. 140
  carbs: number;    // default e.g. 240
  fat: number;      // default e.g. 65
}
