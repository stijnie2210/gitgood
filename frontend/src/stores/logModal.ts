import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useLogModalStore = defineStore('logModal', () => {
  const open = ref(false);
  const title = ref('');
  const content = ref('');

  function show(t: string, c: string) {
    title.value = t;
    content.value = c;
    open.value = true;
  }

  function close() {
    open.value = false;
  }

  return { open, title, content, show, close };
});
