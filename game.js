const field = document.getElementById('field');
const ball = document.getElementById('ball');
const batter = document.getElementById('batter');
const pitcher = document.getElementById('pitcher');
const result = document.getElementById('result');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const runScoreEl = document.getElementById('runScore');
const countEl = document.getElementById('count');
const situationEl = document.getElementById('situation');
const streakEl = document.getElementById('streak');
const swingButton = document.getElementById('swingButton');
const startButton = document.getElementById('startButton');
const startOverlay = document.getElementById('startOverlay');
const overlayTitle = document.getElementById('overlayTitle');
const overlayText = document.getElementById('overlayText');
const message = document.getElementById('message');
const soundButton = document.getElementById('soundButton');
const pitchInfo = document.getElementById('pitchInfo');
const closerBanner = document.getElementById('closerBanner');
const baseEls = [
  null,
  document.getElementById('base1'),
  document.getElementById('base2'),
  document.getElementById('base3')
];

const HIT_X = 19.5;
const MISS_X = 8;
const START_X = 83;

let score = 0;
let best = Number(localStorage.getItem('nostalgicBaseballBest') || 0);
let phase = 'idle';
let playerRuns = 0;
let opponentRuns = 0;
let outs = 0;
let balls = 0;
let strikes = 0;
let runners = [false, false, false, false];
let consecutiveHits = 0;
let closerActive = false;
let pitchNumber = 0;
let currentPitch = null;
let ballX = START_X;
let elapsedPitch = 0;
let lastTime = 0;
let animationId = null;
let soundOn = true;
let audioContext = null;
let pendingTimers = [];
let walkOff = false;

bestEl.textContent = formatScore(best);
updateHud();

function formatScore(value) {
  return String(value).padStart(5, '0');
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function randomInt(min, max) {
  return Math.floor(randomBetween(min, max + 1));
}

function later(callback, delay) {
  const id = window.setTimeout(() => {
    pendingTimers = pendingTimers.filter(timer => timer !== id);
    callback();
  }, delay);
  pendingTimers.push(id);
  return id;
}

function clearTimers() {
  pendingTimers.forEach(id => window.clearTimeout(id));
  pendingTimers = [];
}

function ensureAudio() {
  if (!soundOn) return null;
  if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
  if (audioContext.state === 'suspended') audioContext.resume();
  return audioContext;
}

function tone(frequency, duration = 0.08, type = 'square', volume = 0.04, delay = 0) {
  const ctx = ensureAudio();
  if (!ctx) return;
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  const start = ctx.currentTime + delay;
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
  oscillator.connect(gain).connect(ctx.destination);
  oscillator.start(start);
  oscillator.stop(start + duration);
}

function playOutcomeSound(kind) {
  if (!soundOn) return;
  if (kind === 'HOME RUN') {
    tone(180, .08, 'square', .07);
    tone(300, .11, 'square', .055, .06);
    tone(480, .18, 'triangle', .05, .13);
  } else if (kind === 'DOUBLE' || kind === 'HIT') {
    tone(210, .08, 'square', .06);
    tone(330, .11, 'triangle', .04, .05);
  } else if (kind === 'WALK' || kind === 'BALL') {
    tone(260, .06, 'triangle', .025);
  } else if (kind === 'FOUL') {
    tone(155, .07, 'square', .045);
  } else {
    tone(92, .12, 'sawtooth', .035);
  }
}

function updateHud() {
  scoreEl.textContent = formatScore(score);
  bestEl.textContent = formatScore(best);
  runScoreEl.textContent = `${playerRuns} - ${opponentRuns}`;
  countEl.textContent = `B${balls} S${strikes} O${outs}`;
  streakEl.textContent = closerActive ? '守護神 登板中' : `連続安打 ${consecutiveHits}`;

  const need = Math.max(1, opponentRuns - playerRuns + 1);
  if (playerRuns > opponentRuns) {
    situationEl.textContent = '逆転サヨナラ！';
  } else if (playerRuns === opponentRuns) {
    situationEl.textContent = '同点！ あと1点でサヨナラ';
  } else {
    situationEl.textContent = `${opponentRuns - playerRuns}点ビハインド・あと${need}点で逆転`;
  }

  for (let base = 1; base <= 3; base += 1) {
    baseEls[base].classList.toggle('occupied', runners[base]);
  }
}

function resetCount() {
  balls = 0;
  strikes = 0;
}

function resetBall() {
  ball.classList.remove('flying', 'breaking');
  ball.style.left = `${START_X}%`;
  ball.style.top = '54%';
  ball.style.transform = 'scale(1)';
  ballX = START_X;
}

function startGame() {
  clearTimers();
  cancelAnimationFrame(animationId);
  score = 0;
  playerRuns = 0;
  opponentRuns = randomInt(2, 4);
  outs = 0;
  balls = 0;
  strikes = 0;
  runners = [false, false, false, false];
  consecutiveHits = 0;
  closerActive = false;
  pitchNumber = 0;
  currentPitch = null;
  walkOff = false;
  phase = 'between';

  field.classList.remove('closer-mode', 'screen-shake');
  pitcher.classList.remove('closer');
  closerBanner.classList.remove('show');
  startOverlay.classList.add('hidden');
  swingButton.disabled = false;
  resetBall();
  updateHud();

  message.textContent = `9回裏、${opponentRuns}点ビハインド。逆転するしかない。`;
  pitchInfo.textContent = '球種は投球結果のあとに表示されます';
  later(() => schedulePitch(350), 850);
}

function schedulePitch(delay = 650) {
  if (phase === 'gameover') return;
  phase = 'between';
  resetBall();
  pitchInfo.textContent = '球種：？？？';
  message.textContent = closerActive ? '守護神を攻略しろ…' : '投手をよく見て…';
  later(beginPitch, delay);
}

function weightedChoice(items) {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let roll = Math.random() * total;
  for (const item of items) {
    roll -= item.weight;
    if (roll <= 0) return { ...item };
  }
  return { ...items[items.length - 1] };
}

function choosePitch() {
  const starterPitches = [
    { name: 'ストレート', weight: 34, min: 27, max: 32, accel: 3.5, wave: 1.0, waveRate: 4.4, lateDrop: 0, zone: true, chase: false },
    { name: 'チェンジアップ', weight: 24, min: 22, max: 27, accel: -1.8, wave: 3.8, waveRate: 4.8, lateDrop: 1, zone: true, chase: false },
    { name: 'ツーシーム', weight: 18, min: 26, max: 31, accel: 1.2, wave: 2.6, waveRate: 6.0, lateDrop: 2.2, zone: true, chase: false },
    { name: 'カーブ', weight: 12, min: 22, max: 26, accel: -0.5, wave: 2.0, waveRate: 4.1, lateDrop: 5.5, zone: true, chase: false },
    { name: 'フォーク', weight: 12, min: 27, max: 31, accel: -2.0, wave: 1.0, waveRate: 5.5, lateDrop: 13, zone: false, chase: true }
  ];

  const closerPitches = [
    { name: '剛速球', weight: 38, min: 34, max: 39, accel: 5.5, wave: 1.0, waveRate: 5.5, lateDrop: 0, zone: true, chase: false },
    { name: '高速スライダー', weight: 22, min: 31, max: 36, accel: 1.8, wave: 4.4, waveRate: 7.3, lateDrop: 3.5, zone: true, chase: false },
    { name: 'フォーク', weight: 30, min: 31, max: 36, accel: -1.0, wave: 1.4, waveRate: 6.0, lateDrop: 15, zone: false, chase: true },
    { name: 'チェンジアップ', weight: 10, min: 25, max: 29, accel: -2.8, wave: 5.0, waveRate: 5.0, lateDrop: 2, zone: true, chase: false }
  ];

  const pitch = weightedChoice(closerActive ? closerPitches : starterPitches);
  pitch.baseSpeed = randomBetween(pitch.min, pitch.max);
  pitch.phase = Math.random() * Math.PI * 2;
  pitch.kmh = Math.round(82 + pitch.baseSpeed * 2);
  return pitch;
}

function beginPitch() {
  if (phase === 'gameover') return;
  phase = 'pitching';
  pitchNumber += 1;
  currentPitch = choosePitch();
  ballX = START_X;
  elapsedPitch = 0;
  lastTime = performance.now();

  pitcher.classList.remove('throwing');
  void pitcher.offsetWidth;
  pitcher.classList.add('throwing');
  message.textContent = '来る！';
  pitchInfo.textContent = '球種：？？？';
  tone(120, .04, 'triangle', .018);
  ball.classList.add('flying');
  animationId = requestAnimationFrame(updatePitch);
}

function currentPitchSpeed() {
  const wave = Math.sin(elapsedPitch * currentPitch.waveRate + currentPitch.phase) * currentPitch.wave;
  const speed = currentPitch.baseSpeed + currentPitch.accel * elapsedPitch + wave;
  const max = closerActive ? 48 : 43;
  return Math.max(13, Math.min(max, speed));
}

function pitchVerticalPosition(progress) {
  const naturalArc = Math.sin(progress * Math.PI) * 2.0;
  const micro = Math.sin(elapsedPitch * 8 + currentPitch.phase) * 0.28;
  const late = Math.max(0, (progress - 0.67) / 0.33);
  const drop = Math.pow(late, 2.3) * currentPitch.lateDrop;
  return 54 + naturalArc + micro + drop;
}

function updatePitch(now) {
  if (phase !== 'pitching') return;
  const delta = Math.min((now - lastTime) / 1000, 0.04);
  lastTime = now;
  elapsedPitch += delta;

  ballX -= currentPitchSpeed() * delta;
  ball.style.left = `${ballX}%`;

  const progress = Math.max(0, Math.min(1, (START_X - ballX) / (START_X - MISS_X)));
  ball.style.top = `${pitchVerticalPosition(progress)}%`;
  ball.style.transform = `scale(${1 + progress * .24}) rotate(${progress * 420}deg)`;
  ball.classList.toggle('breaking', currentPitch.lateDrop >= 8 && progress > .67);

  if (ballX <= MISS_X) {
    if (currentPitch.zone) {
      takeStrike();
    } else {
      takeBall();
    }
    return;
  }

  animationId = requestAnimationFrame(updatePitch);
}

function swing() {
  if (phase !== 'pitching') return;
  phase = 'resolving';
  cancelAnimationFrame(animationId);

  batter.classList.remove('swinging');
  void batter.offsetWidth;
  batter.classList.add('swinging');

  if (currentPitch.chase) {
    registerStrike('フォークにバットが空を切った！');
    return;
  }

  const distance = Math.abs(ballX - HIT_X);
  const modifier = closerActive ? 0.76 : 1;
  const homeRunRange = 2.1 * modifier;
  const doubleRange = 3.7 * modifier;
  const hitRange = 5.8 * modifier;
  const foulRange = 9.0 * modifier;

  if (distance <= homeRunRange) {
    registerHit('HOME RUN');
  } else if (distance <= doubleRange) {
    registerHit('DOUBLE');
  } else if (distance <= hitRange) {
    registerHit('HIT');
  } else if (distance <= foulRange) {
    registerFoul();
  } else {
    registerStrike('空振り！');
  }
}

function takeStrike() {
  phase = 'resolving';
  cancelAnimationFrame(animationId);
  registerStrike('見逃しストライク！');
}

function takeBall() {
  phase = 'resolving';
  cancelAnimationFrame(animationId);
  balls += 1;
  if (balls >= 4) {
    registerWalk();
    return;
  }
  resolvePitch('BALL', 0, 'ボール。よく見た！', false);
}

function registerStrike(detail) {
  strikes += 1;
  if (strikes >= 3) {
    outs += 1;
    consecutiveHits = 0;
    resetCount();
    resolvePitch('OUT', 0, '三振！ 1アウト追加', true);
    return;
  }
  resolvePitch('STRIKE', 0, detail, false);
}

function registerFoul() {
  if (strikes < 2) strikes += 1;
  score += 50;
  resolvePitch('FOUL', 0, 'ファウル！ 粘ってもう一球', false);
}

function registerWalk() {
  const runs = forceWalk();
  playerRuns += runs;
  score += 250 + runs * 250;
  consecutiveHits = 0;
  resetCount();
  checkWalkOff();
  resolvePitch('WALK', 0, runs ? `押し出し四球！ ${runs}点` : 'フォアボール！ 一塁へ', true);
}

function registerHit(kind) {
  let runs = 0;
  let points = 0;

  if (kind === 'HOME RUN') {
    runs = advanceRunners(4);
    points = 1500 + runs * 300;
  } else if (kind === 'DOUBLE') {
    runs = advanceRunners(2);
    points = 800 + runs * 250;
  } else {
    runs = advanceRunners(1);
    points = 500 + runs * 200;
  }

  playerRuns += runs;
  score += points;
  consecutiveHits += 1;
  resetCount();
  checkWalkOff();

  const labels = {
    'HOME RUN': `ホームラン！ ${runs}点`,
    'DOUBLE': runs ? `長打！ ${runs}点入った！` : 'ツーベース！',
    'HIT': runs ? `タイムリーヒット！ ${runs}点` : 'ヒット！ 走者が進む'
  };

  resolvePitch(kind, 0, labels[kind], true);
}

function advanceRunners(bases) {
  if (bases >= 4) {
    const existing = runners.slice(1).filter(Boolean).length;
    runners = [false, false, false, false];
    return existing + 1;
  }

  let scored = 0;
  const next = [false, false, false, false];

  for (let base = 3; base >= 1; base -= 1) {
    if (!runners[base]) continue;
    const destination = base + bases;
    if (destination >= 4) scored += 1;
    else next[destination] = true;
  }

  next[bases] = true;
  runners = next;
  return scored;
}

function forceWalk() {
  if (!runners[1]) {
    runners[1] = true;
    return 0;
  }
  if (!runners[2]) {
    runners[2] = true;
    return 0;
  }
  if (!runners[3]) {
    runners[3] = true;
    return 0;
  }
  return 1;
}

function checkWalkOff() {
  if (playerRuns > opponentRuns) {
    walkOff = true;
    score += 3000;
  }
}

function revealPitch() {
  if (!currentPitch) return;
  const suffix = currentPitch.zone ? '' : '・ボール球';
  pitchInfo.textContent = `球種：${currentPitch.name} / ${currentPitch.kmh} km/h${suffix}`;
}

function outcomeLabel(kind) {
  return {
    'HOME RUN': 'ホームラン！',
    'DOUBLE': 'ツーベース！',
    'HIT': 'ヒット！',
    'FOUL': 'ファウル',
    'STRIKE': 'ストライク',
    'BALL': 'ボール',
    'WALK': 'フォアボール',
    'OUT': '三振！'
  }[kind] || kind;
}

function resolvePitch(kind, points, detail, plateAppearanceEnded) {
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

  const delay = kind === 'HOME RUN' ? 1350 : 950;
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

    if (plateAppearanceEnded && !closerActive && consecutiveHits >= 3) {
      activateCloser();
      later(() => schedulePitch(350), 1500);
      return;
    }

    schedulePitch(380 + Math.random() * 300);
  }, delay);
}

function animateBattedBall(type) {
  const startX = ballX;
  const duration = type === 'homeRun' ? 900 : type === 'double' ? 690 : 560;
  const started = performance.now();
  ball.classList.add('flying');

  function frame(now) {
    const t = Math.min((now - started) / duration, 1);
    const ease = 1 - Math.pow(1 - t, 3);
    const xDistance = type === 'homeRun' ? 66 : type === 'double' ? 52 : 40;
    const height = type === 'homeRun' ? 48 : type === 'double' ? 31 : 22;
    const x = startX + ease * xDistance;
    const y = 54 - Math.sin(t * Math.PI) * height + t * 5;
    ball.style.left = `${x}%`;
    ball.style.top = `${y}%`;
    ball.style.transform = `scale(${1 - t * .55}) rotate(${t * 900}deg)`;
    if (t < 1) requestAnimationFrame(frame);
    else resetBall();
  }

  requestAnimationFrame(frame);
}

function activateCloser() {
  closerActive = true;
  consecutiveHits = 0;
  field.classList.add('closer-mode');
  pitcher.classList.add('closer');
  closerBanner.classList.add('show');
  message.textContent = '3連打で投手交代。守護神が出てきた！';
  pitchInfo.textContent = '球速アップ・フォーク率アップ・打撃判定がシビアに';
  updateHud();

  tone(110, .12, 'sawtooth', .045);
  tone(82, .18, 'square', .04, .12);
  tone(165, .2, 'triangle', .04, .28);

  later(() => closerBanner.classList.remove('show'), 1300);
}

function endGame(won) {
  phase = 'gameover';
  clearTimers();
  cancelAnimationFrame(animationId);
  swingButton.disabled = true;
  resetBall();

  const isNewBest = score > best;
  if (isNewBest) {
    best = score;
    localStorage.setItem('nostalgicBaseballBest', String(best));
  }
  updateHud();

  if (won) {
    overlayTitle.textContent = 'サヨナラ勝ち！';
    overlayText.textContent = `${playerRuns} - ${opponentRuns}。土壇場から逆転成功！ ポイント ${score.toLocaleString()}${isNewBest ? '、自己ベスト更新！' : '。'}`;
    message.textContent = '逆転サヨナラ！';
    tone(330, .12, 'triangle', .04);
    tone(440, .12, 'triangle', .04, .12);
    tone(660, .24, 'triangle', .05, .24);
  } else {
    overlayTitle.textContent = 'ゲームセット';
    overlayText.textContent = `${playerRuns} - ${opponentRuns}。あと一歩届かず…。ポイント ${score.toLocaleString()}${isNewBest ? '、それでも自己ベスト更新！' : '。もう一度挑戦しますか？'}`;
    message.textContent = '3アウト。試合終了。';
  }

  startButton.textContent = 'もう一度挑戦';
  startOverlay.classList.remove('hidden');
  pitchInfo.textContent = isNewBest ? '自己ベスト更新！' : '次は逆転しよう';
}

startButton.addEventListener('click', () => {
  ensureAudio();
  startGame();
});

swingButton.addEventListener('click', event => {
  event.stopPropagation();
  swing();
});

field.addEventListener('pointerdown', event => {
  if (event.target.closest('button')) return;
  swing();
});

window.addEventListener('keydown', event => {
  if (event.code !== 'Space') return;
  event.preventDefault();
  swing();
});

soundButton.addEventListener('click', () => {
  soundOn = !soundOn;
  soundButton.textContent = soundOn ? '♪' : '×';
  soundButton.setAttribute('aria-label', soundOn ? 'サウンドをオフ' : 'サウンドをオン');
  if (soundOn) tone(440, .06, 'triangle', .025);
});
