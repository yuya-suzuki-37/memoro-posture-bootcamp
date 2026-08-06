// ===================================================================
// 30-DAY PROGRAM UI (Memoro posture-30day)
//   診断の problems → build30DayProgram → Memoroデザインで描画
//   ・花嫁向けの「ねらい」（式・前撮りでどう映えるか）
//   ・おすすめの軸（recommendCourse）
//   ・Phase 1/2/3 タブ（解放→活性化→統合）
//   ・Day 1〜30 カレンダー（WORK/REST・テーマ・所要時間・種目チラ見せ）
//   ・毎日の「完了」チェック＋進捗バー（端末内保存＝継続の仕組み）
//   ・Day クリックで種目詳細（イラスト＋やり方＋コツ）
//
//   ※ prescription-matrix.js（DB本体）は無変更。補強は本ファイルのキー拡張のみ。
//   ※ 生成軸は course='mixed'（AIおまかせ複合）。
// ===================================================================

import { build30DayProgram } from './program.js';
import { recommendCourse, COURSES } from './courses.js';
import { isDayDone, toggleDay, getDoneCount } from './progress-store.js';

// 種目カテゴリ → 日本語ラベル
function catLabel(ex){
  const map = {
    selfcare:'セルフケア', stretch:'ストレッチ', release:'リリース',
    mobility:'モビリティ', breath:'呼吸法', meditation:'瞑想',
    strength:'トレーニング', core:'コア', balance:'バランス',
    integration:'統合', yoga:'ヨガ',
  };
  return map[ex.category] || (ex.technique === 'pranayama' ? '呼吸法' : 'エクササイズ');
}
function catKind(ex){
  const self = ['selfcare','stretch','release','mobility','breath','meditation','pranayama','yoga'];
  return (self.includes(ex.category) || self.includes(ex.technique)) ? 'self' : 'train';
}

// 悩みキー → 式・前撮りでの「ねらい」（※見た目の印象表現に限定し、効果の断定は避ける）
const BRIDAL_GOALS = {
  forwardHead:         'あご下がすっきり見えて、正面・見上げカットが小顔印象に',
  roundedShoulders:    '肩が開いて、デコルテと鎖骨のラインがきれいに見える',
  thoracicKyphosis:    '背中が伸びて、後ろ姿・背中開きドレスが映える',
  anteriorPelvicTilt:  '腰の反りがやわらぎ、ドレスの横シルエットがすっきり見える',
  posteriorPelvicTilt: '骨盤が起きて、立ち姿がすっと自然に見える',
  swayBack:            '立ち姿に芯が通り、全身カットが凛として見える',
  lateralAsymmetry:    '左右の水平が整い、正面・お隣との並びカットが自然に',
  kneeValgus:          '脚のラインが整い、ショート丈・スリットで美脚に見える',
  kneeVarus:           '脚のラインが整い、まっすぐ伸びた印象に見える',
  scoliosis:           '左右のバランスが整い、写真での姿勢が安定して見える',
  general:             'いまの美姿勢をキープして、写真映えをさらに底上げ',
};
const GOAL_LABELS = {
  forwardHead:'頭の前傾', roundedShoulders:'巻き肩', thoracicKyphosis:'猫背',
  anteriorPelvicTilt:'反り腰', posteriorPelvicTilt:'骨盤後傾', swayBack:'スウェイバック',
  lateralAsymmetry:'左右差', kneeValgus:'X脚', kneeVarus:'O脚', scoliosis:'左右差(大)',
  general:'美姿勢キープ',
};

// プールが小さくなりがちな悩みを、近縁の悩みで補強する（種目の反復を減らす）
const RELATED_PROBLEMS = {
  kneeVarus:           ['lateralAsymmetry'],  // O脚: X脚(kneeValgus)は内転筋の扱いが逆→専用種目に切替え、流用しない
  kneeValgus:          ['lateralAsymmetry'],
  swayBack:            ['anteriorPelvicTilt','posteriorPelvicTilt'],
  posteriorPelvicTilt: ['anteriorPelvicTilt'],
  scoliosis:           ['lateralAsymmetry'],
  lateralAsymmetry:    ['scoliosis'],
};
function expandKeys(keys){
  const out = keys.slice();
  keys.forEach(k => (RELATED_PROBLEMS[k] || []).forEach(r => { if (!out.includes(r)) out.push(r); }));
  return out;
}

const PHASE_INFO = {
  1: { en:'RELEASE',     name:'解放',   days:'DAY 1–10',  desc:'硬くなった所をゆるめ、動きの土台を取り戻す最初の10日間。' },
  2: { en:'ACTIVATION',  name:'活性化', days:'DAY 11–20', desc:'眠っていた筋肉を目覚めさせ、姿勢を「支える力」をつける10日間。' },
  3: { en:'INTEGRATION', name:'統合',   days:'DAY 21–30', desc:'整えた身体を、写真映えする“きれいな立ち姿”として定着させる10日間。' },
};

// 1日の所要時間の目安（種目形式がバラバラのため、種目数からのざっくり目安）
function estimateMinutes(day){
  const n = (day.selfcare?.length || 0) + (day.training?.length || 0);
  if (day.isRest) return '約5〜10分';
  if (n >= 4) return '約15分';
  if (n >= 2) return '約10分';
  return '約5分';
}

export function render30DayProgram(problems, mountEl){
  if (!mountEl) return;
  const keys = (problems || []).map(p => p.key).filter(k => k && k !== 'general');
  const planKeys = keys.length ? keys : ['general'];   // 表示・推薦用（実際の診断結果）
  const engineKeys = expandKeys(planKeys);             // 生成用（近縁キーで補強）

  const rec = recommendCourse(planKeys);
  const recCourse = COURSES[rec.top] || COURSES.mixed;
  const program = build30DayProgram(engineKeys, 'mixed');

  let currentPhase = 1; // タブ状態（完了トグル後の再描画で使用）

  const goalItems = planKeys
    .filter(k => BRIDAL_GOALS[k])
    .map(k => `<li><span class="p30-goal-tag">${GOAL_LABELS[k] || ''}</span><span class="p30-goal-text">${BRIDAL_GOALS[k]}</span></li>`)
    .join('');

  mountEl.innerHTML = `
  <div class="section-head" style="margin-top:44px">
    <span class="num">YOUR 30-DAY PLAN</span>
    <h2>あなたの30日プログラム</h2>
    <p>診断結果から、いまのあなたに必要な動きを30日分に組みました。1日およそ15分・道具なしでOKです。</p>
  </div>

  ${goalItems ? `
  <div class="p30-goals">
    <span class="p30-goals-kicker">この30日でめざす“式映え”</span>
    <ul class="p30-goals-list">${goalItems}</ul>
    <p class="p30-goals-note">※ 変化には個人差があります。毎日の積み重ねで、写真の“見え方”を整えていくプログラムです。</p>
  </div>` : ''}

  <div class="p30-reco">
    <span class="p30-reco-kicker">おすすめの軸</span>
    <div class="p30-reco-body">
      <span class="p30-reco-icon">${recCourse.icon || '✨'}</span>
      <div>
        <div class="p30-reco-name">${recCourse.name}</div>
        <div class="p30-reco-desc">${recCourse.desc || ''}</div>
      </div>
    </div>
    <p class="p30-reco-note">※ 実際のメニューは、あなたの診断に合わせて4つの軸（整体・ピラティス・ヨガ・トレーニング）からバランスよく配合しています。</p>
  </div>

  <div class="p30-progress" id="p30-progress"></div>

  <div class="p30-phases">
    ${[1,2,3].map(ph => `
      <button class="p30-phase-tab ${ph===1?'active':''}" data-phase="${ph}">
        <span class="pt-en">${PHASE_INFO[ph].en}</span>
        <span class="pt-ja">Phase ${ph}・${PHASE_INFO[ph].name}</span>
        <span class="pt-days">${PHASE_INFO[ph].days}</span>
      </button>
    `).join('')}
  </div>

  <div class="p30-phase-desc" id="p30-phase-desc">${PHASE_INFO[1].desc}</div>
  <div class="p30-days" id="p30-days"></div>
  <div class="p30-detail" id="p30-detail" hidden></div>
  `;

  const daysEl     = mountEl.querySelector('#p30-days');
  const descEl     = mountEl.querySelector('#p30-phase-desc');
  const detailEl   = mountEl.querySelector('#p30-detail');
  const progressEl = mountEl.querySelector('#p30-progress');

  function renderProgressBar(){
    const done = getDoneCount();
    const pct = Math.round(done / 30 * 100);
    progressEl.innerHTML = `
      <div class="p30-progress-top">
        <span class="p30-progress-label">30日の進み具合</span>
        <span class="p30-progress-count"><b>${done}</b> / 30 日</span>
      </div>
      <div class="p30-progress-bar"><i style="width:${pct}%"></i></div>
      ${done >= 30 ? '<p class="p30-progress-done">🎉 30日おつかれさまでした！ もう一度診断して、変化を見てみましょう。</p>' : ''}
    `;
  }

  function renderDays(phase){
    const days = program.filter(d => d.phase === phase);
    daysEl.innerHTML = days.map(d => {
      const items = [...(d.selfcare||[]), ...(d.training||[])];
      const names = items.map(e => e.name).slice(0,4).join('・');
      return `
      <button class="p30-day ${d.isRest?'rest':''} ${isDayDone(d.day)?'is-done':''}" data-day="${d.day}">
        ${isDayDone(d.day) ? '<span class="p30-day-check">✓</span>' : ''}
        <span class="p30-day-badge">${d.isRest?'REST':'DAY'}</span>
        <span class="p30-day-num">${d.day}</span>
        <span class="p30-day-theme">${d.theme}</span>
        <span class="p30-day-time">${estimateMinutes(d)}</span>
        <span class="p30-day-items">${d.isRest ? '呼吸・軽いストレッチ' : names}</span>
      </button>`;
    }).join('');
  }

  function renderDetail(day){
    const d = program.find(x => x.day === day);
    if (!d){ detailEl.hidden = true; return; }
    const items = [...(d.selfcare||[]), ...(d.training||[])];
    const done = isDayDone(day);
    detailEl.innerHTML = `
      <div class="p30-detail-head">
        <div>
          <span class="p30-detail-kicker">PHASE ${d.phase} · DAY ${d.day}${d.isRest?' · REST':''} ・ ${estimateMinutes(d)}</span>
          <h3>${d.theme}</h3>
        </div>
        <button class="p30-detail-close" aria-label="閉じる">×</button>
      </div>
      ${(d.isRest && !items.length) ? `<p class="p30-rest-note">今日はお休みの日。深い呼吸とゆっくりのストレッチで、身体を労わりましょう。</p>` : ''}
      <div class="p30-ex-list">
        ${items.map(ex => `
          <div class="p30-ex ${catKind(ex)}">
            <div class="p30-ex-illust">${ex.illustration || ''}</div>
            <div class="p30-ex-body">
              <span class="p30-ex-cat">${catLabel(ex)}</span>
              <h4>${ex.name}</h4>
              <div class="p30-ex-meta"><span>⏱ ${ex.duration || ''}</span><span>🛠 ${ex.equipment || 'なし'}</span></div>
              <p class="p30-ex-purpose">${ex.purpose || ''}</p>
              ${(ex.how && ex.how.length) ? `<ol class="p30-ex-how">${ex.how.map(s => `<li>${s}</li>`).join('')}</ol>` : ''}
              ${ex.cues ? `<div class="p30-ex-cues"><span class="do">◎ ${ex.cues.do || ''}</span><span class="dont">× ${ex.cues.dont || ''}</span></div>` : ''}
            </div>
          </div>
        `).join('')}
      </div>
      <button class="p30-done-btn ${done?'done':''}" data-done-day="${day}">
        ${done ? '✓ 完了しました（取り消す）' : 'この日のメニューを完了にする'}
      </button>
    `;
    detailEl.hidden = false;
    detailEl.querySelector('.p30-detail-close').addEventListener('click', () => { detailEl.hidden = true; });
    detailEl.querySelector('.p30-done-btn').addEventListener('click', () => {
      toggleDay(day);
      renderProgressBar();
      renderDays(currentPhase);
      renderDetail(day);
    });
    detailEl.scrollIntoView({ behavior:'smooth', block:'nearest' });
  }

  mountEl.querySelectorAll('.p30-phase-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      currentPhase = +tab.dataset.phase;
      mountEl.querySelectorAll('.p30-phase-tab').forEach(t => t.classList.toggle('active', t === tab));
      descEl.textContent = PHASE_INFO[currentPhase].desc;
      renderDays(currentPhase);
      detailEl.hidden = true;
    });
  });

  daysEl.addEventListener('click', e => {
    const btn = e.target.closest('.p30-day');
    if (!btn) return;
    renderDetail(+btn.dataset.day);
  });

  renderProgressBar();
  renderDays(1);
}
