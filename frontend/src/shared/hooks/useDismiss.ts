import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * 드롭다운 메뉴를 자동으로 닫는다: 메뉴 바깥을 누르거나, ESC를 누르거나, 다른 화면으로 옮기면.
 * 돌려준 ref를 메뉴 버튼과 메뉴를 감싸는 요소에 단다.
 */
export function useDismiss<T extends HTMLElement>(open: boolean, close: () => void) {
  const ref = useRef<T>(null);
  const closeRef = useRef(close);
  closeRef.current = close;
  const { pathname } = useLocation();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) closeRef.current();
    };
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') closeRef.current(); };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  // 화면이 바뀌면 닫는다
  useEffect(() => { closeRef.current(); }, [pathname]);

  return ref;
}
