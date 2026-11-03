// 결과 공유: 순위 결과를 이미지(PNG)로 만들어 내려받는다. 룸 운영자만 쓴다.
// 1단계 설정 → 2단계 테마 → 3단계 미리보기·다운로드
import { useEffect, useState } from 'react';
import { Icon } from '../../../shared/icons/Icon';
import { saveFile } from '../../../shared/lib/download';
import { Popup, toast } from '../../../shared/ui';
import { userName } from '../../organization';
import type { Project } from '../../projects';
import type { DB } from '../../session';
import { drawResultImage, THEMES, type Basis, type Entry } from '../lib/renderResultImage';
import { rankBy, type ResultRow } from '../model/computeResults';

type Options = { top: number | null; basis: Basis; showScore: boolean };
const TOP_CHOICES: { value: number | null; label: string }[] = [
  { value: 1, label: '1위만' }, { value: 3, label: '3위까지' }, { value: 5, label: '5위까지' }, { value: null, label: '전체' },
];
const STEPS = ['설정', '테마', '미리보기'] as const;

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
  const rank = rankBy(scored, valueOf);
  const entries: Entry[] = scored
    .map(r => ({
      key: r.key,
      rank: rank.get(r.key)!,
      name: userName(db, r.targetId), title: r.pres.title, score: valueOf(r)!,
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
    if (image) saveFile(image, `${project.name} 결과.png`);
  };

  const foot = (
    <>
      <button type="button" className="btn foot-start" onClick={onClose}>닫기</button>
      {step > 0 && <button type="button" className="btn" onClick={() => setStep(step - 1)}><Icon name="back" size={15} />이전</button>}
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

