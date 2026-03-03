export interface HistoricalFigure {
  id: string;
  name: string;
  title: string;
  period: string;
  description: string;
  imageUrl: string;
  systemInstruction: string;
}

export interface Message {
  role: 'user' | 'model';
  text: string;
  timestamp: number;
  imageData?: string;
  mimeType?: string;
}
