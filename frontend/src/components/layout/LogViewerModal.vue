<script setup lang="ts">
import { ref } from 'vue';
import { useLogModalStore } from '../../stores/logModal';

const logModal = useLogModalStore();
const copied = ref(false);

async function onCopy() {
  await navigator.clipboard.writeText(logModal.content);
  copied.value = true;
  setTimeout(() => (copied.value = false), 1500);
}

function onOverlayClick(e: MouseEvent) {
  if (e.target === e.currentTarget) {
    logModal.close();
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="logModal.open" class="log-overlay" @click="onOverlayClick">
      <div class="log-panel">
        <div class="log-header">
          <span class="log-title">{{ logModal.title }}</span>
          <button class="log-close" @click="logModal.close()">✕</button>
        </div>

        <pre class="log-body">{{ logModal.content }}</pre>

        <div class="log-footer">
          <button class="log-btn-copy" @click="onCopy">{{ copied ? 'Copied' : 'Copy' }}</button>
          <button class="log-btn-close" @click="logModal.close()">Close</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.log-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.log-panel {
  background: #1a1a2e;
  border: 1px solid #252545;
  border-radius: 10px;
  width: 640px;
  max-width: 90vw;
  max-height: 82vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.7);
}

.log-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  border-bottom: 1px solid #222238;
  flex-shrink: 0;
}

.log-title {
  font-size: 14px;
  font-weight: 600;
  color: #dde;
}

.log-close {
  background: transparent;
  border: none;
  color: #556;
  font-size: 12px;
  cursor: pointer;
  padding: 3px 7px;
  border-radius: 4px;
  line-height: 1;
}
.log-close:hover {
  color: #99a;
  background: #222238;
}

.log-body {
  overflow: auto;
  flex: 1;
  margin: 0;
  padding: 14px 20px;
  font-family: monospace;
  font-size: 12px;
  line-height: 1.5;
  color: #ccd;
  white-space: pre-wrap;
  word-break: break-word;
  user-select: text;
}

.log-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 20px;
  border-top: 1px solid #222238;
  flex-shrink: 0;
}

.log-btn-copy {
  padding: 6px 16px;
  background: transparent;
  border: 1px solid #252545;
  border-radius: 6px;
  color: #667;
  font-size: 12px;
  cursor: pointer;
}
.log-btn-copy:hover {
  color: #99a;
  border-color: #3a3a5a;
}

.log-btn-close {
  padding: 6px 20px;
  background: #4f8ef7;
  border: none;
  border-radius: 6px;
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}
.log-btn-close:hover {
  background: #6aa0f8;
}
</style>
