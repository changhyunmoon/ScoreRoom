// 화면 그리기 중 오류가 나면 빈 화면 대신 안내를 보여 주고 서버 로그로 보낸다
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { reportError } from '../lib/errorReporter';

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    reportError(error, info.componentStack ?? undefined);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="container stack" style={{ padding: '60px 16px', alignItems: 'center', textAlign: 'center' }}>
        <h1>화면을 표시하지 못했어요</h1>
        <p className="muted">문제가 기록되었어요. 새로 고침해도 계속되면 시스템 관리자에게 알려 주세요.</p>
        <button type="button" className="btn primary" onClick={() => window.location.reload()}>새로 고침</button>
      </div>
    );
  }
}
