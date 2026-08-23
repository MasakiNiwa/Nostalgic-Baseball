// v0.5: 凡打・併殺 + 先発 → 中継ぎエース → FINAL BOSS守護神
// game.js / comeback-mode.js の基本ロジックを保ちながら、ゲーム終盤の難易度曲線を拡張します。

let pitcherTier = 'starter';

const v04StartGame = startGame;
const baseUpdateHud = updateHud;

startGame = function () {
  pitcherTier = 'starter';
  field.classList.remove('reliever-mode', 'closer-mode');
  pitcher.classList.remove('reliever', 'closer');
  v04StartGame();
};

updateHud = function () {
  baseUpdateHud();
  if (pitcherTier === 'reliever') {
    streakEl.textContent = '中継ぎエース 登板中';
  } else if (pitcherTier === 'closer') {
    streakEl.textContent = 'FINAL BOSS 守護神';
  }
};

choosePitch = function () {
  const starterPitches = [
    { name: 'ストレート', weight: 31, min: 27, max: 32, accel: 3.5, wave: 1.0, waveRate: 4.4, lateDrop: 0, zone: true, chase: false },
    { name: 'チェンジアップ', weight: 23, min: 22, max: 27, accel: -1.8, wave: 3.8, waveRate: 4.8, lateDrop: 1, zone: true, chase: false },
    { name: 'ツーシーム', weight: 18, min: 26, max: 31, accel: 1.2, wave: 2.6, waveRate: 6.0, lateDrop: 2.2, zone: true, chase: false },
    { name: 'カーブ', weight: 14, min: 22, max: 26, accel: -0.5, wave: 2.0, waveRate: 4.1, lateDrop: 5.5, zone: true, chase: false },
    { name: 'フォーク', weight: 14, min: 27, max: 31, accel: -2.0, wave: 1.0, waveRate: 5.5, lateDrop: 13, zone: false, chase: true }
  ];

  const relieverPitches = [
    { name: '速球', weight: 34, min: 31, max: 36, accel: 4.4, wave: 1.2, waveRate: 5.2, lateDrop: 0, zone: true, chase: false },
    { name: 'スライダー', weight: 24, min: 28, max: 34, accel: 1.0, wave: 4.0, waveRate: 7.0, lateDrop: 3.0, zone: true, chase: false },
    { name: 'チェンジアップ', weight: 18, min: 24, max: 29, accel: -2.5, wave: 4.8, waveRate: 5.0, lateDrop: 2.2, zone: true, chase: false },
    { name: 'フォーク', weight: 24, min: 30, max: 35, accel: -1.0, wave: 1.3, waveRate: 6.0, lateDrop: 14, zone: false, chase: true }
  ];

  const closerPitches = [
    { name: '164km級 剛速球', weight: 36, min: 39, max: 44, accel: 7.2, wave: 1.3, waveRate: 6.2, lateDrop: 0, zone: true, chase: false },
    { name: '高速スライダー', weight: 22, min: 36, max: 42, accel: 2.6, wave: 5.8, waveRate: 8.5, lateDrop: 4.0, zone: true, chase: false },
    { name: '消えるフォーク', weight: 34, min: 36, max: 42, accel: -0.4, wave: 1.6, waveRate: 6.8, lateDrop: 18, zone: false, chase: true },
    { name: '超遅球', weight: 8, min: 20, max: 24, accel: -3.5, wave: 6.5, waveRate: 4.5, lateDrop: 2, zone: true, chase: false }
  ];

  const pool = pitcherTier === 'closer' ? closerPitches : pitcherTier === 'reliever' ? relieverPitches : starterPitches;
  const pitch = weightedChoice(pool);
  pitch.baseSpeed = randomBetween(pitch.min, pitch.max);
  pitch.phase = Math.random() * Math.PI * 2;
  pitch.kmh = Math.round(82 + pitch.baseSpeed * 2);
  return pitch;
};

function registerGroundOut() {
  const canDoublePlay = runners[1] && outs <= 1;
  const dpChance = pitcherTier === 'closer' ? 0.78 : pitcherTier === 'reliever' ? 0.68 : 0.58;

  if (canDoublePlay && Math.random() < dpChance) {
    runners[1] = false;
    outs += 2;
    consecutiveHits = 0;
    resetCount();
    score += 40;
    resolvePitch('DOUBLE PLAY', 0, '痛恨の併殺！ バットには当たったのに2アウト…。', true);
    return;
  }

  outs += 1;
  consecutiveHits = 0;
  resetCount();
  score += 20;
  resolvePitch('GROUND OUT', 0, '打った！ ……しかし凡打。1アウト追加。', true);
}

swing = function () {
  if (phase !== 'pitching') return;
  phase = 'resolving';
  cancelAnimationFrame(animationId);

  batter.classList.remove('swinging');
  void batter.offsetWidth;
  batter.classList.add('swinging');

  if (currentPitch.chase) {
    registerStrike(`${currentPitch.name}にバットが空を切った！`);
    return;
  }

  const distance = Math.abs(ballX - HIT_X);
  const modifier = pitcherTier === 'closer' ? 0.55 : pitcherTier === 'reliever' ? 0.80 : 1;
  const homeRunRange = 2.1 * modifier;
  const doubleRange = 3.7 * modifier;
  const hitRange = 5.8 * modifier;
  const contactRange = 7.6 * modifier + 1.4;
  const foulRange = 9.2 * modifier + 1.0;

  // 「完璧に近い当たりでも野手の正面」が起きる、少し理不尽な野球らしさ。
  const unluckyOutChance = pitcherTier === 'closer' ? 0.27 : pitcherTier === 'reliever' ? 0.18 : 0.10;

  if (distance <= homeRunRange && Math.random() >= unluckyOutChance * 0.35) {
    registerHit('HOME RUN');
  } else if (distance <= doubleRange && Math.random() >= unluckyOutChance * 0.65) {
    registerHit('DOUBLE');
  } else if (distance <= hitRange && Math.random() >= unluckyOutChance) {
    registerHit('HIT');
  } else if (distance <= contactRange) {
    registerGroundOut();
  } else if (distance <= foulRange) {
    registerFoul();
  } else {
    registerStrike('空振り！');
  }
};

const baseOutcomeLabel = outcomeLabel;
outcomeLabel = function (kind) {
  if (kind === 'GROUND OUT') return '凡打…';
  if (kind === 'DOUBLE PLAY') return '併殺！';
  return baseOutcomeLabel(kind);
};

function sameRunOnBaseCount() {
  return runners.slice(1).filter(Boolean).length;
}

function shouldCallFinalBoss() {
  if (pitcherTier !== 'reliever') return false;
  const deficit = opponentRuns - playerRuns;
  const tyingRunDistance = deficit - sameRunOnBaseCount();
  return deficit <= 3 || tyingRunDistance <= 1 || playerRuns >= Math.max(6, opponentRuns - 4);
}

function showPitcherChange(nextTier) {
  const bannerLabel = closerBanner.querySelector('span');
  const bannerName = closerBanner.querySelector('strong');

  if (nextTier === 'reliever') {
    pitcherTier = 'reliever';
    closerActive = false;
    consecutiveHits = 0;
    field.classList.add('reliever-mode');
    field.classList.remove('closer-mode');
    pitcher.classList.add('reliever');
    pitcher.classList.remove('closer');
    bannerLabel.textContent = 'PITCHER CHANGE';
    bannerName.textContent = '中継ぎエース 登板';
    message.textContent = '3連打で先発KO。中継ぎエースが出てきた！';
    pitchInfo.textContent = '球速・変化球・凡打率がアップ';
    tone(150, .11, 'triangle', .035);
    tone(210, .16, 'square', .035, .12);
  } else {
    pitcherTier = 'closer';
    closerActive = true;
    consecutiveHits = 0;
    field.classList.remove('reliever-mode');
    field.classList.add('closer-mode');
    pitcher.classList.remove('reliever');
    pitcher.classList.add('closer');
    bannerLabel.textContent = 'FINAL BOSS';
    bannerName.textContent = '守護神 降臨';
    message.textContent = '逆転が見えた瞬間――本物の守護神が出てきた。';
    pitchInfo.textContent = '激ムズ：剛速球・消えるフォーク・極狭タイミング';
    tone(92, .16, 'sawtooth', .055);
    tone(70, .22, 'square', .05, .14);
    tone(185, .28, 'triangle', .05, .32);
  }

  updateHud();
  closerBanner.classList.remove('show');
  void closerBanner.offsetWidth;
  closerBanner.classList.add('show');
  later(() => closerBanner.classList.remove('show'), 1350);
}

resolvePitch = function (kind, points, detail, plateAppearanceEnded) {
  if (phase === 'pitching') cancelAnimationFrame(animationId);
  phase = 'resolving';
  score += points;
  revealPitch();
  message.textContent = detail;
  updateHud();
  playOutcomeSound(kind);

  result.textContent = outcomeLabel(kind);
  result.className = `result ${kind.toLowerCase().replace(/\s/g, '')}`;
  void result.offsetWidth;
  result.classList.add('show');

  if (kind === 'HOME RUN') {
    field.classList.remove('screen-shake');
    void field.offsetWidth;
    field.classList.add('screen-shake');
    animateBattedBall('homeRun');
  } else if (kind === 'DOUBLE' || kind === 'HIT') {
    animateBattedBall(kind === 'DOUBLE' ? 'double' : 'hit');
  } else {
    resetBall();
  }

  const delay = kind === 'HOME RUN' ? 1350 : (kind === 'DOUBLE PLAY' ? 1250 : 950);
  later(() => {
    field.classList.remove('screen-shake');
    result.classList.remove('show');

    if (walkOff) {
      endGame(true);
      return;
    }
    if (outs >= 3) {
      endGame(false);
      return;
    }

    if (plateAppearanceEnded && pitcherTier === 'starter' && consecutiveHits >= 3) {
      showPitcherChange('reliever');
      later(() => schedulePitch(350), 1500);
      return;
    }

    if (plateAppearanceEnded && shouldCallFinalBoss()) {
      showPitcherChange('closer');
      later(() => schedulePitch(350), 1650);
      return;
    }

    schedulePitch(380 + Math.random() * 300);
  }, delay);
};
