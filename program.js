// ===================================================================
// 30-DAY PROGRAM GENERATOR — 本物のフェーズ漸進（periodization）
//   Phase 1 (Day 1-10):  解放 Release    … セルフケア多め(3:1)・低強度・ほぐす
//   Phase 2 (Day 11-20): 活性化 Activation… 半々(2:2)・中強度・弱い筋を鍛える
//   Phase 3 (Day 21-30): 統合 Integration … トレ多め(1:3)・高強度・機能統合
//   Day 7,14,21,28 はアクティブレスト（呼吸・軽ストレッチのみ）
//
//   ★旧実装はフェーズがラベルだけで、種目選定は全30日で同一だった。
//     本実装は「本数配分・強度・technique」をフェーズごとに変え、実際に漸進させる。
//     ・セルフケアは常に低強度＝回復/準備の役割
//     ・トレーニングだけ 強度(intPref/Cap) と technique をフェーズで引き上げる
// ===================================================================
import {
  ALL_EXERCISES,
  buildPrescriptionPool,
  buildAnchors,
} from './prescription-matrix.js';

// ---- フェーズ別プロファイル ----
// self/train        : 1日の本数配分（合計4本固定。解放=セルフケア多め→統合=トレ多め）
// *_intPref/*_intCap: そのフェーズで望ましい強度／上限（超えると大きく減点＝重すぎ）
// selfTech/trainTech: そのフェーズで優先したい technique（外れると減点）
const PHASE_PROFILE = {
  1: { self:3, train:1,
       self_intPref:1, self_intCap:2, selfTech:['release','stretch','mobility','restorative','breathing','pranayama'],
       train_intPref:1, train_intCap:2, trainTech:['isometric','core','stretch'] },
  2: { self:2, train:2,
       self_intPref:1, self_intCap:2, selfTech:['mobility','stretch','release','breathing'],
       train_intPref:2, train_intCap:3, trainTech:['strength','core','isometric','pilates'] },
  3: { self:1, train:3,
       self_intPref:1, self_intCap:2, selfTech:['breathing','pranayama','meditation','mobility','stretch'],
       train_intPref:3, train_intCap:3, trainTech:['integration','balance','standing','cardio','strength','core','pilates'] },
};
// アクティブレスト（Day7/14/21/28）：とにかく軽く
const REST_TECH = ['breathing','pranayama','meditation','restorative','stretch','release'];

// ---- そのフェーズ／役割への適合度（0=理想・大きいほど不向き）----
function fitScore(ex, intPref, intCap, prefTech){
  const inten = ex.intensity || 1;
  let s = Math.abs(inten - intPref) * 0.8;            // 望ましい強度からの距離
  if (inten > intCap) s += (inten - intCap) * 2.0;   // 上限超え＝そのフェーズには重すぎ
  if (!prefTech.includes(ex.technique)) s += 1.2;    // technique がフェーズ外
  return s;
}

// ---- フェーズ適合 ＞ ローテーション（使用少）＞ アンカー の優先で count 本ピック ----
function pickPhase(list, usage, count, anchors, excludeIds, intPref, intCap, prefTech){
  if (count <= 0 || !list.length) return [];
  const score = (ex) =>
    fitScore(ex, intPref, intCap, prefTech) * 100   // フェーズ適合を最優先
    + (usage[ex.id] || 0) * 5                        // 使用回数が少ない順（飽きさせない）
    + (anchors.has(ex.id) ? -0.15 : 0);             // 同点ならアンカー(代表種目)を気持ち優先
  const avail = list.filter(ex => !excludeIds.includes(ex.id));
  const src = avail.length >= count ? avail : list;  // 除外で足りなければ重複を許可
  return src.slice().sort((a, b) => score(a) - score(b)).slice(0, count);
}

// ===== 今日のメニュー: セルフケア2 + トレーニング2（クイック用・据え置き）=====
function pickTodayMenu(problemKeys, course='mixed'){
  const pool = buildPrescriptionPool(problemKeys, course);
  const selfcare = pool.selfcare.slice(0, 2);
  const training = pool.training.slice(0, 2);
  return { selfcare, training };
}

// ===== 30日プログラム生成（フェーズ漸進版）=====
function build30DayProgram(problemKeys, course='mixed'){
  const pool = buildPrescriptionPool(problemKeys, course);
  const anchors = buildAnchors(problemKeys, course);
  const sList = pool.selfcare;
  const tList = pool.training;

  const sUsage = Object.fromEntries(sList.map(ex => [ex.id, 0]));
  const tUsage = Object.fromEntries(tList.map(ex => [ex.id, 0]));

  const days = [];

  for (let day = 1; day <= 30; day++) {
    const phase = day <= 10 ? 1 : day <= 20 ? 2 : 3;
    const isRest = (day % 7 === 0);
    const dayInPhase = day <= 10 ? day : day <= 20 ? day - 10 : day - 20;
    const prof = PHASE_PROFILE[phase];

    const prev = days[days.length - 1];
    const prevIds = prev
      ? [...(prev.selfcare || []), ...(prev.training || [])].map(e => e.id)
      : [];

    let selfcare, training;
    if (isRest) {
      // レストは強度1・呼吸/ストレッチ中心を2本
      selfcare = pickPhase(sList, sUsage, 2, anchors, prevIds, 1, 1, REST_TECH);
      training = [];
    } else {
      selfcare = pickPhase(sList, sUsage, prof.self, anchors, prevIds,
                           prof.self_intPref, prof.self_intCap, prof.selfTech);
      const sameDayIds = selfcare.map(e => e.id);
      training = pickPhase(tList, tUsage, prof.train, anchors, [...prevIds, ...sameDayIds],
                           prof.train_intPref, prof.train_intCap, prof.trainTech);
    }

    selfcare.forEach(ex => { sUsage[ex.id] = (sUsage[ex.id] || 0) + 1; });
    training.forEach(ex => { tUsage[ex.id] = (tUsage[ex.id] || 0) + 1; });

    days.push({
      day, phase, isRest,
      theme: themeFor(phase, dayInPhase, isRest),
      selfcare, training, course,
    });
  }

  return days;
}

function themeFor(phase, dayInPhase, isRest){
  if (isRest) return 'アクティブレスト・呼吸を整える';
  const themes = {
    1: [
      '導入・身体を知る', 'リリースの導入', '胸郭の解放', '股関節の解放', '首と肩のリセット',
      '骨盤の感覚を取り戻す', '休息日 (Rest)', '脊柱モビリティ', '深層筋への意識', 'Phase 1総仕上げ',
    ],
    2: [
      '臀筋の覚醒', '体幹深層の活性化', '肩甲骨スタビライザー', '骨盤底〜横隔膜', '中臀筋の活性化',
      '後面連鎖の起動', '休息日 (Rest)', '片脚バランスの導入', '抗回旋トレーニング', 'Phase 2総仕上げ',
    ],
    3: [
      '機能的動作の統合', '日常動作への応用', '左右差の最終調整', '呼吸と姿勢の統合', '片脚動作の完成',
      '回旋動作の制御', '休息日 (Rest)', '統合パターン', '動的バランス', '30日プログラム卒業',
    ],
  };
  return themes[phase][dayInPhase - 1];
}

export { pickTodayMenu, build30DayProgram, ALL_EXERCISES };
