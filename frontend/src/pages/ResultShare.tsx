// 결과 공유: 순위 결과를 이미지(PNG)로 만들어 내려받는다. 룸 운영자만 쓴다.
// 1단계 설정 → 2단계 테마 → 3단계 미리보기·다운로드
import { useEffect, useState } from 'react';
import type { DB, Project } from '../store';
import { Popup, toast } from '../ui';
import { Icon } from '../icons';
import { formatAvg, userName, type ResultRow } from '../logic';

type Basis = 'avg' | 'inAvg';
type Options = { top: number | null; basis: Basis; showScore: boolean };
const TOP_CHOICES: { value: number | null; label: string }[] = [
  { value: 1, label: '1위만' }, { value: 3, label: '3위까지' }, { value: 5, label: '5위까지' }, { value: null, label: '전체' },
];
const STEPS = ['설정', '테마', '미리보기'] as const;

/* ---------- 테마 ---------- */
type Theme = {
  key: string; name: string;
  headFrom: string; headTo: string; headText: string; headSub: string; pill: string; deco: string;
  bg: string; card: string; cardShadow: string; text: string; sub: string; muted: string;
  accent: string; chipBg: string; chipText: string; otherRankBg: string; otherRankText: string;
  medals: [string, string, string]; first: string; foot: string;
};
const THEMES: Theme[] = [
  {
    key: 'navy', name: '네이비',
    headFrom: '#0E2848', headTo: '#1D4F8C', headText: '#FFFFFF', headSub: 'rgba(255,255,255,0.75)', pill: 'rgba(255,255,255,0.16)', deco: 'rgba(255,255,255,0.06)',
    bg: '#F3F5F9', card: '#FFFFFF', cardShadow: 'rgba(16,38,70,0.08)', text: '#16202E', sub: '#4A5566', muted: '#8A93A3',
    accent: '#1D4F8C', chipBg: '#EAF0F8', chipText: '#1D4F8C', otherRankBg: '#E6ECF4', otherRankText: '#1D4F8C',
    medals: ['#E8A900', '#9AA5B4', '#C47A3F'], first: '#E8A900', foot: '#9AA3B2',
  },
  {
    key: 'dark', name: '다크',
    headFrom: '#0B0F17', headTo: '#1E2433', headText: '#FFFFFF', headSub: 'rgba(255,255,255,0.65)', pill: 'rgba(255,214,102,0.18)', deco: 'rgba(255,214,102,0.07)',
    bg: '#121722', card: '#1B2230', cardShadow: 'rgba(0,0,0,0.35)', text: '#F2F4F8', sub: '#B7BFCC', muted: '#7E8899',
    accent: '#FFD666', chipBg: '#2A3344', chipText: '#FFD666', otherRankBg: '#2A3344', otherRankText: '#D7DDE7',
    medals: ['#F5C542', '#BFC7D2', '#D58B4E'], first: '#F5C542', foot: '#6C7686',
  },
  {
    key: 'white', name: '화이트',
    headFrom: '#FFFFFF', headTo: '#F1F4F8', headText: '#111827', headSub: '#6B7280', pill: '#E9EDF3', deco: 'rgba(17,24,39,0.04)',
    bg: '#FFFFFF', card: '#F7F8FA', cardShadow: 'rgba(0,0,0,0)', text: '#111827', sub: '#4B5563', muted: '#9CA3AF',
    accent: '#111827', chipBg: '#E9EDF3', chipText: '#374151', otherRankBg: '#E9EDF3', otherRankText: '#374151',
    medals: ['#D4A017', '#A0A8B4', '#B8733A'], first: '#111827', foot: '#9CA3AF',
  },
  {
    key: 'forest', name: '포레스트',
    headFrom: '#0F3D2E', headTo: '#1F7A57', headText: '#FFFFFF', headSub: 'rgba(255,255,255,0.75)', pill: 'rgba(255,255,255,0.16)', deco: 'rgba(255,255,255,0.07)',
    bg: '#F1F6F3', card: '#FFFFFF', cardShadow: 'rgba(15,61,46,0.08)', text: '#13261E', sub: '#46594F', muted: '#859489',
    accent: '#1F7A57', chipBg: '#E3F1EA', chipText: '#1F7A57', otherRankBg: '#E3F1EA', otherRankText: '#1F7A57',
    medals: ['#E3A600', '#9AA5A0', '#C0773C'], first: '#E3A600', foot: '#93A39A',
  },
  {
    key: 'sunset', name: '선셋',
    headFrom: '#E8505B', headTo: '#F59E3D', headText: '#FFFFFF', headSub: 'rgba(255,255,255,0.85)', pill: 'rgba(255,255,255,0.22)', deco: 'rgba(255,255,255,0.1)',
    bg: '#FFF6F1', card: '#FFFFFF', cardShadow: 'rgba(232,80,91,0.1)', text: '#2B1A1A', sub: '#6B4F4A', muted: '#A88B85',
    accent: '#E8505B', chipBg: '#FDE8E3', chipText: '#D43F4A', otherRankBg: '#FDE8E3', otherRankText: '#D43F4A',
    medals: ['#F2B01E', '#AEB4BC', '#C97A43'], first: '#F2B01E', foot: '#B9A29C',
  },
];

type Entry = { key: string; rank: number; name: string; title: string; score: number };

export function ResultSharePopup({ db, project, rows, avgOf, inAvgOf, decimals, onClose }: {
  db: DB; project: Project; rows: ResultRow[];
  avgOf: (r: ResultRow) => number | null; inAvgOf: (r: ResultRow) => number | null;
  decimals: boolean; onClose: () => void;
}) {
  const s = project.settings;
  const hasAgg = s.aggMin !== null && s.aggMax !== null;
  const [step, setStep] = useState(0);
  const [opt, setOpt] = useState<Options>({ top: 3, basis: 'avg', showScore: true });
  const [themeKey, setThemeKey] = useState(THEMES[0].key);
  const [image, setImage] = useState<string | null>(null);
  const [making, setMaking] = useState(false);
  const theme = THEMES.find(t => t.key === themeKey)!;

  const valueOf = (r: ResultRow) => (opt.basis === 'inAvg' ? inAvgOf(r) : avgOf(r));
  const scored = rows.filter(r => valueOf(r) !== null);
  const entries: Entry[] = scored
    .map(r => ({ r, v: valueOf(r)! }))
    .map(({ r, v }) => ({
      key: r.key,
      rank: 1 + scored.filter(x => valueOf(x)! > v).length,
      name: userName(db, r.targetId), title: r.pres.title, score: v,
    }))
    .sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name) || a.key.localeCompare(b.key))
    .slice(0, opt.top ?? undefined);

  // 설정과 테마가 바뀔 때마다 실제 다운로드할 이미지를 다시 만든다.
  useEffect(() => {
    if (step === 0) return;
    let alive = true;
    setImage(null);
    setMaking(true);
    drawResultImage(project, entries, theme, {
      showScore: opt.showScore, basis: opt.basis, decimals,
      aggText: hasAgg ? `${s.aggMin}~${s.aggMax}점` : '', topLabel: opt.top === null ? '전체 순위' : `TOP ${opt.top}`,
    })
      .then(url => { if (alive) setImage(url); })
      .catch(() => { if (alive) toast('이미지를 만들지 못했습니다.', 'err'); })
      .finally(() => { if (alive) setMaking(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, opt.top, opt.basis, opt.showScore, themeKey, decimals, rows, db, project]);

  const download = () => {
    if (!image) return;
    const a = document.createElement('a');
    a.href = image;
    a.download = `${project.name} 결과.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const foot = (
    <>
      {step === 0
        ? <button type="button" className="btn" onClick={onClose}>닫기</button>
        : <button type="button" className="btn" onClick={() => setStep(step - 1)}><Icon name="back" size={15} />이전</button>}
      {step < 2
        ? <button type="button" className="btn primary solid" disabled={!entries.length} onClick={() => setStep(step + 1)}>다음<Icon name="right" size={15} /></button>
        : <button type="button" className="btn primary solid" disabled={!image} onClick={download}><Icon name="download" size={16} />이미지 다운로드</button>}
    </>
  );

  return (
    <Popup label="결과 공유" className="share-popup" onClose={onClose} foot={foot}
      head={<><span className="muted small">{project.name}</span><h2>결과 공유 이미지 만들기</h2></>}>
      <ol className="share-steps">
        {STEPS.map((name, i) => (
          <li key={name} className={i === step ? 'on' : i < step ? 'done' : ''}>
            <span className="share-step-no">{i < step ? <Icon name="check" size={13} /> : i + 1}</span>{name}
          </li>
        ))}
      </ol>

      {step === 0 && <>
        <dl className="info-table share-options">
          <div className="info-row">
            <dt>표시 순위</dt>
            <dd>
              <div className="segmented">
                {TOP_CHOICES.map(c => <button key={c.label} type="button" className={opt.top === c.value ? 'on' : ''} onClick={() => setOpt({ ...opt, top: c.value })}>{c.label}</button>)}
              </div>
            </dd>
          </div>
          {hasAgg && (
            <div className="info-row">
              <dt>순위 기준</dt>
              <dd>
                <div className="segmented">
                  <button type="button" className={opt.basis === 'avg' ? 'on' : ''} onClick={() => setOpt({ ...opt, basis: 'avg' })}>전체 평균</button>
                  <button type="button" className={opt.basis === 'inAvg' ? 'on' : ''} onClick={() => setOpt({ ...opt, basis: 'inAvg' })}>집계 기준 평균</button>
                </div>
              </dd>
            </div>
          )}
          <div className="info-row">
            <dt>점수 공개</dt>
            <dd><label className="switch"><input type="checkbox" checked={opt.showScore} onChange={e => setOpt({ ...opt, showScore: e.target.checked })} /><span />{opt.showScore ? `${opt.basis === 'inAvg' ? '집계 기준 평균' : '전체 평균'} 표시` : '숨김 (순위만 공개)'}</label></dd>
          </div>
        </dl>
        <span className="muted small">{entries.length
          ? `선택한 기준의 평균 점수가 있는 ${scored.length}명 중 ${entries.length}명이 이미지에 들어가요.${opt.top !== null && scored.length < opt.top ? ` 현재 ${opt.top}위까지 채울 점수가 없어요.` : ''}`
          : '선택한 기준의 평균 점수를 받은 사람이 없어 만들 수 없어요.'}</span>
      </>}

      {step === 1 && (
        <><div className="theme-grid" role="radiogroup" aria-label="테마">
          {THEMES.map(t => (
            <button key={t.key} type="button" role="radio" aria-checked={t.key === themeKey}
              className={`theme-card ${t.key === themeKey ? 'on' : ''}`} onClick={() => setThemeKey(t.key)}>
              <span className="theme-mini" style={{ background: t.bg }}>
                <span className="theme-mini-head" style={{ background: `linear-gradient(135deg, ${t.headFrom}, ${t.headTo})` }}>
                  <i style={{ background: t.headText }} />
                </span>
                {[0, 1, 2].map(i => (
                  <span key={i} className="theme-mini-row" style={{ background: t.card, boxShadow: i === 0 ? `inset 0 0 0 1.5px ${t.first}` : undefined }}>
                    <b style={{ background: t.medals[i] }} />
                    <i style={{ background: t.text }} />
                    <em style={{ background: t.accent }} />
                  </span>
                ))}
              </span>
              <span className="theme-name">{t.key === themeKey && <Icon name="checkCircle" size={15} />}{t.name}</span>
            </button>
          ))}
        </div>
        <div className="share-preview-wrap">
          <b className="small">선택한 설정과 테마 미리보기 · {entries.length}명</b>
          {image
            ? <div className="share-preview"><img src={image} alt={`${theme.name} 테마 결과 이미지 미리보기`} /></div>
            : <div className="share-preview empty muted small">{making ? '이미지를 만드는 중이에요…' : '이미지를 만들지 못했어요.'}</div>}
        </div></>
      )}

      {step === 2 && (image
        ? <div className="share-preview"><img src={image} alt="결과 이미지 미리보기" /></div>
        : <div className="share-preview empty muted small">{making ? '이미지를 만드는 중이에요…' : '이미지를 만들지 못했어요. 이전으로 돌아가 다시 시도해 주세요.'}</div>)}
    </Popup>
  );
}

/* ---------- 이미지 그리기 (Canvas) ---------- */
const FONT = `'Noto Sans KR', 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif`;

async function drawResultImage(project: Project, entries: Entry[], t: Theme, o: {
  showScore: boolean; basis: Basis; decimals: boolean; aggText: string; topLabel: string;
}): Promise<string> {
  // 웹 글꼴이 다 불러와진 뒤 그린다 (안 그러면 기본 글꼴로 그려진다)
  try { await Promise.all([document.fonts.load(`700 40px 'Noto Sans KR'`), document.fonts.load(`400 24px 'Noto Sans KR'`)]); } catch { /* 기본 글꼴 사용 */ }

  const W = 1080, PAD = 64, HEAD = 220, ROW = 104, GAP = 12;
  const H = HEAD + 32 + entries.length * (ROW + GAP) - GAP + 44;
  const SCALE = 2;
  const canvas = document.createElement('canvas');
  canvas.width = W * SCALE;
  canvas.height = H * SCALE;
  const c = canvas.getContext('2d')!;
  c.scale(SCALE, SCALE);
  c.textBaseline = 'middle';
  const font = (weight: number, size: number) => { c.font = `${weight} ${size}px ${FONT}`; };
  const fit = (text: string, max: number) => {
    if (c.measureText(text).width <= max) return text;
    let s = text;
    while (s.length > 1 && c.measureText(s + '…').width > max) s = s.slice(0, -1);
    return s + '…';
  };
  const round = (x: number, y: number, w: number, h: number, r: number) => { c.beginPath(); c.roundRect(x, y, w, h, r); };

  // 배경
  c.fillStyle = t.bg;
  c.fillRect(0, 0, W, H);

  // 평가룸과 순위 기준
  const g = c.createLinearGradient(0, 0, W, HEAD);
  g.addColorStop(0, t.headFrom);
  g.addColorStop(1, t.headTo);
  c.fillStyle = g;
  c.fillRect(0, 0, W, HEAD);
  c.fillStyle = t.headText;
  font(700, 50);
  c.fillText(fit(project.name, W - PAD * 2), PAD, 78);
  const d = new Date();
  const dateText = `${project.status === 'CLOSED' ? '최종 결과' : '중간 결과'} · ${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  c.fillStyle = t.headSub;
  font(400, 23);
  c.fillText(dateText, PAD, 138);
  const basisText = o.basis === 'inAvg' ? `집계 기준 평균 (${o.aggText})` : '전체 평균';
  c.fillText(`${basisText} · ${o.topLabel}`, PAD, 178);
  if (t.key === 'white') { c.fillStyle = '#E5E7EB'; c.fillRect(0, HEAD - 1, W, 1); }

  let y = HEAD + 32;
  for (const e of entries) {
    const x = PAD, w = W - PAD * 2;
    const top3 = e.rank <= 3;
    c.fillStyle = t.card;
    round(x, y, w, ROW, 16); c.fill();
    if (e.rank === 1) { c.strokeStyle = t.first; c.lineWidth = 2; round(x + 1, y + 1, w - 2, ROW - 2, 15); c.stroke(); }

    const cx = x + 52, cy = y + ROW / 2;
    c.fillStyle = top3 ? t.medals[e.rank - 1] : t.otherRankBg;
    c.beginPath(); c.arc(cx, cy, 30, 0, Math.PI * 2); c.fill();
    c.fillStyle = top3 ? '#FFFFFF' : t.otherRankText;
    font(700, e.rank >= 10 ? 23 : 27);
    c.textAlign = 'center';
    c.fillText(String(e.rank), cx, cy + 1);
    c.textAlign = 'left';

    const tx = x + 108;
    const scoreWidth = o.showScore ? (o.decimals ? 210 : 130) : 0;
    font(700, 34);
    c.fillStyle = t.text;
    const duplicateName = entries.some(other => other.key !== e.key && other.name === e.name);
    c.fillText(fit(e.name, w - 108 - scoreWidth - 48), tx, duplicateName ? y + 38 : cy);
    if (duplicateName) {
      font(400, 20);
      c.fillStyle = t.sub;
      c.fillText(fit(e.title, w - 108 - scoreWidth - 48), tx, y + 75);
    }

    if (o.showScore) {
      c.textAlign = 'right';
      const rx = x + w - 36;
      font(700, 36);
      c.fillStyle = t.accent;
      c.fillText(formatAvg(e.score, o.decimals), rx, cy);
      c.textAlign = 'left';
    }
    y += ROW + GAP;
  }

  const url = canvas.toDataURL('image/png');
  if (url === 'data:,') throw new Error('Canvas image export failed');
  return url;
}
