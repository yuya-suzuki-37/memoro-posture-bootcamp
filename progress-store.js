// ===================================================================
// PROGRESS STORE — 30日プログラムの進捗＆診断履歴（localStorage・端末内）
//   ・進捗: どのDayを完了したか（毎日チェック用）
//   ・履歴: 診断スコアの記録（Before/After比較用）
//   写真だけ・端末内処理の方針に沿い、サーバーには一切送信しない。
// ===================================================================

const LS_PROGRESS = 'memoro_p30_progress_v1';
const LS_HISTORY  = 'memoro_p30_history_v1';

// ---------- 進捗（Day完了） ----------
function getProgress(){
  try { return JSON.parse(localStorage.getItem(LS_PROGRESS) || 'null') || { done:{}, startedAt:null }; }
  catch(e){ return { done:{}, startedAt:null }; }
}
function saveProgress(p){
  try { localStorage.setItem(LS_PROGRESS, JSON.stringify(p)); } catch(e){}
}
function isDayDone(day){
  return !!getProgress().done[day];
}
function toggleDay(day){
  const p = getProgress();
  if (p.done[day]) {
    delete p.done[day];
  } else {
    p.done[day] = new Date().toISOString();
    if (!p.startedAt) p.startedAt = p.done[day];
  }
  saveProgress(p);
  return !!p.done[day];
}
function getDoneCount(){
  return Object.keys(getProgress().done).length;
}
function resetProgress(){
  try { localStorage.removeItem(LS_PROGRESS); } catch(e){}
}

// ---------- 診断履歴（Before/After） ----------
function getHistory(){
  try { return JSON.parse(localStorage.getItem(LS_HISTORY) || '[]'); }
  catch(e){ return []; }
}
function addHistory(rec){
  const list = getHistory();
  list.push({ at: new Date().toISOString(), ...rec });
  try { localStorage.setItem(LS_HISTORY, JSON.stringify(list)); } catch(e){}
  return list;
}
function getBeforeAfter(){
  const list = getHistory();
  if (!list.length) return null;
  return { first: list[0], last: list[list.length-1], count: list.length };
}
function clearHistory(){
  try { localStorage.removeItem(LS_HISTORY); } catch(e){}
}

export {
  getProgress, isDayDone, toggleDay, getDoneCount, resetProgress,
  getHistory, addHistory, getBeforeAfter, clearHistory,
};
