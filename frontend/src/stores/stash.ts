import { defineStore } from 'pinia';
import { ref } from 'vue';
import { ListStashes } from '../../wailsjs/go/main/App';

export interface StashEntry {
  index: number;
  ref: string;
  message: string;
  branch: string;
  hash: string;
  date: string;
}

export const useStashStore = defineStore('stash', () => {
  const entries = ref<StashEntry[]>([]);

  async function load(repoPath: string) {
    if (!repoPath) {
      return;
    }
    try {
      const result = await ListStashes(repoPath);
      entries.value = (result as StashEntry[]) ?? [];
    } catch {
      entries.value = [];
    }
  }

  function clear() {
    entries.value = [];
  }

  return { entries, load, clear };
});
