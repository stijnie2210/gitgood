// Call after nextTick — element must be rendered to measure its size.
export function clampMenuPosition(
  el: HTMLElement,
  x: number,
  y: number,
  padding = 8,
): { x: number; y: number } {
  const { width, height } = el.getBoundingClientRect()
  const vw = window.innerWidth
  const vh = window.innerHeight
  return {
    x: x + width + padding > vw ? Math.max(0, x - width) : x,
    y: y + height + padding > vh ? Math.max(0, y - height) : y,
  }
}
