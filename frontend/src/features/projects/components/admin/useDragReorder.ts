import { useRef, useState } from 'react';

/**
 * 목록 끌어서 순서 바꾸기.
 * 마우스는 4px 이상 움직이면 바로 드래그를 시작하고,
 * 터치는 스크롤과 구분하기 위해 250ms 길게 누른 뒤 시작한다. 버튼·링크 위에서는 시작하지 않는다.
 */
export type DragState = { from: number; to: number; dy: number; shift: number };

export function useDragReorder(ids: string[], onDrop: (ids: string[]) => void) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const els = useRef<Record<string, HTMLElement | null>>({});
  const cardRef = (id: string) => (el: HTMLElement | null) => { els.current[id] = el; };

  const onPointerDown = (e: React.PointerEvent, from: number) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('button, a, input, select, textarea, label')) return;
    const isMouse = e.pointerType === 'mouse';
    const startY = e.clientY;
    const rects = ids.map(id => els.current[id]!.getBoundingClientRect());
    const gap = rects.length > 1 ? rects[1].top - rects[0].bottom : 12;
    let started = false;
    let state: DragState = { from, to: from, dy: 0, shift: rects[from].height + gap };

    const begin = () => {
      started = true;
      document.body.classList.add('dragging');
      if (!isMouse) navigator.vibrate?.(15);
      setDrag(state);
    };
    const timer = isMouse ? 0 : window.setTimeout(begin, 250);

    const move = (ev: PointerEvent) => {
      const dy = ev.clientY - startY;
      if (!started) {
        if (isMouse && Math.abs(dy) > 4) begin();
        else { if (!isMouse && Math.abs(dy) > 8) cleanup(); return; } // 길게 누르기 전에 움직이면 스크롤로 본다
      }
      const center = rects[from].top + rects[from].height / 2 + dy;
      const to = rects.filter((r, j) => j !== from && r.top + r.height / 2 < center).length;
      state = { ...state, dy, to };
      setDrag(state);
    };
    const blockTouch = (ev: TouchEvent) => { if (started) ev.preventDefault(); };
    const up = () => {
      const wasStarted = started;
      cleanup();
      if (wasStarted && state.to !== state.from) {
        const next = ids.slice();
        const [moved] = next.splice(state.from, 1);
        next.splice(state.to, 0, moved);
        onDrop(next);
      }
    };
    function cleanup() {
      clearTimeout(timer);
      started = false;
      document.body.classList.remove('dragging');
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      window.removeEventListener('touchmove', blockTouch);
      setDrag(null);
    }
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    window.addEventListener('touchmove', blockTouch, { passive: false });
  };

  /** 드래그 중: 잡은 카드는 포인터를 따라가고, 사이에 있는 카드는 한 칸씩 밀려난다 */
  const cardStyle = (i: number): React.CSSProperties | undefined => {
    if (!drag) return undefined;
    if (i === drag.from) return { transform: `translateY(${drag.dy}px)`, transition: 'none', zIndex: 5, position: 'relative' };
    if (drag.from < drag.to && i > drag.from && i <= drag.to) return { transform: `translateY(${-drag.shift}px)` };
    if (drag.to < drag.from && i >= drag.to && i < drag.from) return { transform: `translateY(${drag.shift}px)` };
    return undefined;
  };

  return { drag, cardRef, onPointerDown, cardStyle };
}
