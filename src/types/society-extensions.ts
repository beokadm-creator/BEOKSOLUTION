import { LocalizedText } from './schema';
import { Timestamp } from 'firebase/firestore';

export interface SocietyNotice {
  id: string; // Auto-generated or manual
  title: LocalizedText;
  content: LocalizedText;
  category: '공지' | '뉴스' | '안내' | 'NOTICE' | 'NEWS' | 'INFO';
  date: Timestamp;
  isPinned?: boolean;
  createdAt: Timestamp;
}

export interface SocietyGreeting {
  message: LocalizedText; // HTML content supported
  images?: string[]; // Array of image URLs from Firebase Storage
}

export interface SocietyExtended {
  presidentGreeting?: SocietyGreeting | LocalizedText; // Support both old and new format
  notices?: SocietyNotice[];
}
