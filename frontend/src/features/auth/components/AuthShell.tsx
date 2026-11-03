import type { ReactNode } from 'react';
import { Icon } from '../../../shared/icons/Icon';

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
        <div className="av-cards" aria-hidden="true">
          <div className="av-card"><Icon name="paperclip" size={18} /> 디자인 시스템 2.0 · 발표 자료</div>
          <div className="av-card"><Icon name="star" size={18} /> 내 점수 <b>81</b> / 100</div>
          <div className="av-card"><Icon name="chart" size={18} /> 평균 <b>72.75</b> · 평가 4명</div>
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
