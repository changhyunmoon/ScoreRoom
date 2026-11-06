// 글자를 클립보드에 복사한다.
// navigator.clipboard는 https나 localhost에서만 동작한다. 운영 서버는 http라 그대로 쓰면 아무것도 복사되지 않고
// 전에 복사해 둔 값이 남는다. 그래서 숨긴 입력칸을 골라 복사하는 예전 방식으로 한 번 더 시도한다.

/** 실제로 복사했으면 true. 둘 다 안 되면 false (화면에서 직접 복사하라고 안내한다) */
export async function copyText(text: string): Promise<boolean> {
  if (window.isSecureContext && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // 권한 거부 등: 아래 방식으로 다시 시도
    }
  }
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  // 화면에 보이지 않게 두되, 선택은 되도록 문서 안에 붙인다 (모바일 확대·스크롤이 생기지 않게 고정 위치)
  area.style.position = 'fixed';
  area.style.top = '0';
  area.style.left = '0';
  area.style.opacity = '0';
  area.style.fontSize = '16px';
  document.body.appendChild(area);
  const active = document.activeElement as HTMLElement | null;
  area.select();
  area.setSelectionRange(0, text.length);
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  document.body.removeChild(area);
  active?.focus?.();
  return ok;
}
