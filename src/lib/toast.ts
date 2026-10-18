import { create } from 'zustand';

export interface ToastItem {
  id: number;
  text: string;
  kind: 'info' | 'error';
}

export const useToasts = create<{ items: ToastItem[] }>(() => ({ items: [] }));

let seq = 0;
export function toast(text: string, kind: ToastItem['kind'] = 'info') {
  const id = ++seq;
  useToasts.setState(s => ({ items: [...s.items.slice(-2), { id, text, kind }] }));
  setTimeout(() => useToasts.setState(s => ({ items: s.items.filter(t => t.id !== id) })), kind === 'error' ? 5000 : 2200);
}
