import { defineStore } from 'pinia';
import { ref } from 'vue';

export type ToastType = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  message: string;
  type: ToastType;
  duration: number;
}

const PREVIEW_LIMIT = 160;

export function isLongMessage(message: string): boolean {
  return message.length > PREVIEW_LIMIT || message.includes('\n');
}

let nextId = 1;

export const useToastStore = defineStore('toast', () => {
  const toasts = ref<Toast[]>([]);

  function push(message: string, type: ToastType = 'info', duration?: number) {
    const ms = duration ?? (isLongMessage(message) ? 0 : type === 'error' ? 7000 : 3500);
    const id = nextId++;
    toasts.value.push({ id, message, type, duration: ms });
    if (ms > 0) {
      setTimeout(() => dismiss(id), ms);
    }
    return id;
  }

  function dismiss(id: number) {
    const i = toasts.value.findIndex((t) => t.id === id);
    if (i !== -1) {
      toasts.value.splice(i, 1);
    }
  }

  function success(message: string) {
    return push(message, 'success');
  }
  function error(message: string) {
    return push(message, 'error');
  }

  return { toasts, push, dismiss, success, error };
});
