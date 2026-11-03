import type { ReactNode } from 'react';

/** 왼쪽 소개 영역 + 오른쪽 폼 영역으로 나뉜 계정 화면 (모바일은 폼만) */
export function AuthShell({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="auth">
      <aside className="auth-visual">
        <div className="av-brand">Score<b>Room</b></div>
        <div className="av-copy">
          <h2>발표는 집중해서,<br />평가는 간편하게.</h2>
          <p>사내 발표를 바로 평가하고<br />결과를 한눈에 확인하세요.</p>
        </div>
      </aside>
      <section className="auth-panel">
        <div className="auth-inner">
          <div className="brand big center">Score<b>Room</b></div>
          {title && <h1 className="auth-title">{title}</h1>}
          {children}
        </div>
        <p className="auth-foot">사내 발표 평가 서비스 · 문의는 시스템 관리자에게</p>
      </section>
    </div>
  );
}
