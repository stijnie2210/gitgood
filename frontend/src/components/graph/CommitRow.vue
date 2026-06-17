<script setup lang="ts">
import { ref, watchEffect, computed } from 'vue';
import type { GraphRow } from '../../stores/commits';
import { drawGraphCell } from './graphRenderer';
import { usePrefsStore } from '../../stores/prefs';
import { formatDate } from '../../utils/date';

const props = defineProps<{
  row: GraphRow;
  graphWidth: number;
  rowH: number;
  selected: boolean;
}>();

const prefsStore = usePrefsStore();

const displayDate = computed(() => {
  if (!props.row.timestamp) {
    return props.row.date;
  }
  return formatDate(props.row.timestamp, prefsStore.prefs.dateFormat, prefsStore.now);
});

const canvasRef = ref<HTMLCanvasElement | null>(null);

watchEffect(() => {
  const canvas = canvasRef.value;
  if (!canvas || !props.row) {
    return;
  }
  canvas.width = props.graphWidth;
  canvas.height = props.rowH;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    drawGraphCell(ctx, props.row, props.rowH);
  }
});
</script>

<template>
  <div class="row-inner" :class="{ selected }">
    <canvas
      ref="canvasRef"
      class="row-canvas"
      :style="{ width: `${graphWidth}px`, height: `${rowH}px` }"
    />
    <span class="row-hash">{{ row.shortHash }}</span>
    <span class="row-labels">
      <span v-for="l in row.labels" :key="l.name" class="label" :class="`label--${l.type}`">{{
        l.type === 'remote' ? `${l.remote}/${l.name}` : l.name
      }}</span>
    </span>
    <span class="row-subject">{{ row.subject }}</span>
    <span class="row-author">{{ row.author }}</span>
    <span class="row-date">{{ displayDate }}</span>
  </div>
</template>

<style src="../../assets/labels.css" />

<style scoped>
.row-inner {
  display: flex;
  align-items: center;
  width: 100%;
  gap: 8px;
  padding-right: 16px;
  white-space: nowrap;
  overflow: hidden;
  cursor: pointer;
  height: 100%;
}

.row-inner:hover {
  background: rgba(255, 255, 255, 0.04);
}
.row-inner.selected {
  background: rgba(79, 142, 247, 0.15);
}

.row-canvas {
  flex-shrink: 0;
  display: block;
}

.row-hash {
  font-family: monospace;
  color: #555;
  font-size: 11px;
  flex-shrink: 0;
  width: 52px;
}

.row-labels {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.row-subject {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  color: #ddd;
  font-size: 12px;
}
.row-author {
  width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  color: #777;
  flex-shrink: 0;
  font-size: 12px;
}
.row-date {
  width: 80px;
  color: #555;
  flex-shrink: 0;
  text-align: right;
  font-size: 12px;
}
</style>
