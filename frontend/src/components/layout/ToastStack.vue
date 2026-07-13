<script setup lang="ts">
import { useToastStore, isLongMessage } from '../../stores/toast';
import { useLogModalStore } from '../../stores/logModal';

const toast = useToastStore();
const logModal = useLogModalStore();

const PREVIEW_LIMIT = 160;

function preview(message: string): string {
  const firstLine = message.split('\n')[0];
  if (firstLine.length > PREVIEW_LIMIT) {
    return firstLine.slice(0, PREVIEW_LIMIT) + '…';
  }
  return message.includes('\n') ? firstLine + ' …' : firstLine;
}

function viewLog(t: { type: string; message: string }, e: MouseEvent) {
  e.stopPropagation();
  logModal.show(t.type === 'error' ? 'Error details' : 'Details', t.message);
}
</script>

<template>
  <Teleport to="body">
    <div class="toast-stack">
      <TransitionGroup name="toast">
        <div
          v-for="t in toast.toasts"
          :key="t.id"
          class="toast"
          :class="`toast--${t.type}`"
          @click="toast.dismiss(t.id)"
        >
          <span class="toast-icon">
            <template v-if="t.type === 'success'">✓</template>
            <template v-else-if="t.type === 'error'">✕</template>
            <template v-else>i</template>
          </span>
          <span class="toast-msg">{{ isLongMessage(t.message) ? preview(t.message) : t.message }}</span>
          <button v-if="isLongMessage(t.message)" class="toast-action" @click="viewLog(t, $event)">
            View log
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-stack {
  position: fixed;
  bottom: 20px;
  right: 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 9999;
  pointer-events: none;
}

.toast {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 14px;
  border-radius: 6px;
  font-size: 12px;
  max-width: 420px;
  cursor: pointer;
  pointer-events: all;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
  user-select: none;
}

.toast--success {
  background: #162a1e;
  border: 1px solid #2a5a38;
  color: #7de8a8;
}
.toast--error {
  background: #2a1616;
  border: 1px solid #5a2828;
  color: #f79090;
}
.toast--info {
  background: #151530;
  border: 1px solid #2d2d60;
  color: #99aadd;
}

.toast-icon {
  font-size: 11px;
  font-weight: 700;
  flex-shrink: 0;
  width: 14px;
  text-align: center;
  line-height: 1;
}

.toast-msg {
  flex: 1;
  line-height: 1.4;
}

.toast-action {
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 4px;
  color: inherit;
  font-size: 11px;
  font-weight: 600;
  padding: 3px 8px;
  cursor: pointer;
}
.toast-action:hover {
  background: rgba(255, 255, 255, 0.16);
}

/* Transitions */
.toast-enter-active {
  transition:
    transform 0.2s ease,
    opacity 0.2s ease;
}
.toast-leave-active {
  transition:
    transform 0.18s ease,
    opacity 0.18s ease;
}
.toast-enter-from {
  transform: translateX(20px);
  opacity: 0;
}
.toast-leave-to {
  transform: translateX(20px);
  opacity: 0;
}
.toast-move {
  transition: transform 0.2s ease;
}
</style>
