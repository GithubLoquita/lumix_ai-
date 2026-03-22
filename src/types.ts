export interface Layer {
  id: string;
  name?: string;
  type: 'image' | 'text' | 'shape' | 'drawing';
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  visible: boolean;
  content?: string; // For text
  src?: string; // For image
  fill?: string; // For shape/text/drawing
  stroke?: string; // For drawing
  strokeWidth?: number; // For drawing
  points?: number[]; // For drawing
  fontSize?: number;
  fontFamily?: string;
  filter?: string; // For image filters
}

export interface Project {
  id: string;
  name: string;
  userId: string;
  layers: Layer[];
  createdAt: number;
  updatedAt: number;
  thumbnail?: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  isPremium: boolean;
}
