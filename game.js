const field = document.getElementById('field');
const ball = document.getElementById('ball');
const batter = document.getElementById('batter');
const pitcher = document.getElementById('pitcher');
const result = document.getElementById('result');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const pitchCountEl = document.getElementById('pitchCount');
const swingButton = document.getElementById('swingButton');
const startButton = document.getElementById('startButton');
const startOverlay = document.getElementById('startOverlay');
const overlayTitle = document.getElementById('overlayTitle');
const overlayText = document.getElementById('overlayText');
const message = document.getElementById('message');
const soundButton = document.getElementById('soundButton');

const TOTAL_PITCHES = 10;
const HIT_X = 19.5;
const MISS_X = 8;

let score = 0;
let pitchCount = 0;
let best = Number(localStorage.getItem('nostalgicBaseballBest') || 0);
let phase = 'idle';
let ballX = 83;
let pitchSpeed = 0;
let lastTime = 0;
let animationId = null;
let soundOn = true;
let audioContext = null;

bestEl.textContent = formatScore(best);

function formatScore(value) {
  return String(value).padStart(5, '0');
}

function ensureAudio() {
  if (!soundOn) return null;
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
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

function playHitSound(kind) {
  if (!soundOn) return;
  if (kind === 'HOME RUN') {
    tone(180, .08, 'square', .07);
    tone(300, .11, 'square', .055, .06);
    tone(480, .18, 'triangle', .05, .13);
  } else if (kind === 'HIT') {
    tone(210, .08, 'square', .06);
    tone(330, .11, 'triangle', .04, .05);
  } else if (kind === 'FOUL') {
    tone(155, .07, 'square', .045);
  } else {
    tone(92, .12, 'sawtooth', .035);
  }
}

function resetBall() {
  ball.classList.remove('flying');
  ball.style.left = '83%';
  ball.style.top = '54%';
  ball.style.transform = 'scale(1)';
  ballX = 83;
}

function startGame() {
  cancelAnimationFrame(animationId);
  score = 0;
  pitchCount = 0;
  phase = 'between';
  scoreEl.textContent = formatScore(score);
  pitchCountEl.textContent = pitchCount;
  startOverlay.classList.add('hidden');
  swingButton.disabled = false;
  resetBall();
  message.textContent = 'ピッチャーをよく見て…';
  schedulePitch(650);
}

function schedulePitch(delay = 700) {
  phase = 'between';
  resetBall();
  window.setTimeout(() => {
    if (pitchCount >= TOTAL_PITCHES) return endGame();
    beginPitch();
  }, delay);
}

function beginPitch() {
  phase = 'pitching';
  pitchCount += 1;
  pitchCountEl.textContent = pitchCount;
  ballX = 83;
  pitchSpeed = 24 + Math.random() * 9;
  lastTime = performance.now();
  pitcher.classList.remove('throwing');
  void pitcher.offsetWidth;
  pitcher.classList.add('throwing');
  message.textContent = pitchSpeed > 30 ? '速い！' : '来る！';
  tone(120, .04, 'triangle', .018);
  ball.classList.add('flying');
  animationId = requestAnimationFrame(updatePitch);
}

function updatePitch(now) {
  if (phase !== 'pitching') return;
  const delta = Math.min((now - lastTime) / 1000, 0.04);
  lastTime = now;
  ballX -= pitchSpeed * delta;
  ball.style.left = `${ballX}%`;

  const progress = (83 - ballX) / 75;
  ball.style.top = `${54 + Math.sin(progress * Math.PI) * 2.2}%`;
  ball.style.transform = `scale(${1 + progress * .23})`;

  if (ballX <= MISS_X) {
    resolvePitch('STRIKE', 0, '見逃し！');
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

  const distance = Math.abs(ballX - HIT_X);
  let kind = 'STRIKE';
  let points = 0;
  let detail = '空振り！';

  if (distance <= 2.2) {
    kind = 'HOME RUN';
    points = 1000;
    detail = '完璧なタイミング！ +1000';
  } else if (distance <= 5.2) {
    kind = 'HIT';
    points = 500;
    detail = distance < 3.8 ? 'ナイスバッティング！ +500' : 'ヒット！ +500';
  } else if (distance <= 9) {
    kind = 'FOUL';
    points = 100;
    detail = '惜しい！ +100';
  }

  resolvePitch(kind, points, detail);
}

function resolvePitch(kind, points, detail) {
  if (phase === 'pitching') cancelAnimationFrame(animationId);
  phase = 'resolving';
  score += points;
  scoreEl.textContent = formatScore(score);
  message.textContent = detail;
  playHitSound(kind);

  result.textContent = kind;
  result.className = `result ${kind.toLowerCase().replace(' ', '')}`;
  void result.offsetWidth;
  result.classList.add('show');

  if (kind === 'HOME RUN') {
    field.classList.remove('screen-shake');
    void field.offsetWidth;
    field.classList.add('screen-shake');
    animateBattedBall(true);
  } else if (kind === 'HIT' || kind === 'FOUL') {
    animateBattedBall(false);
  } else {
    resetBall();
  }

  const delay = kind === 'HOME RUN' ? 1250 : 900;
  window.setTimeout(() => {
    field.classList.remove('screen-shake');
    result.classList.remove('show');
    if (pitchCount >= TOTAL_PITCHES) endGame();
    else schedulePitch(380 + Math.random() * 350);
  }, delay);
}

function animateBattedBall(homeRun) {
  const startX = ballX;
  const duration = homeRun ? 900 : 560;
  const started = performance.now();
  ball.classList.add('flying');

  function frame(now) {
    const t = Math.min((now - started) / duration, 1);
    const x = startX + t * (homeRun ? 64 : 40);
    const y = 54 - Math.sin(t * Math.PI) * (homeRun ? 46 : 22) + t * 5;
    ball.style.left = `${x}%`;
    ball.style.top = `${y}%`;
    ball.style.transform = `scale(${1 - t * .55})`;
    if (t < 1) requestAnimationFrame(frame);
    else resetBall();
  }
  requestAnimationFrame(frame);
}

function endGame() {
  phase = 'gameover';
  swingButton.disabled = true;
  resetBall();

  const isNewBest = score > best;
  if (isNewBest) {
    best = score;
    localStorage.setItem('nostalgicBaseballBest', String(best));
    bestEl.textContent = formatScore(best);
  }

  overlayTitle.textContent = isNewBest ? 'NEW BEST!' : 'Game Set';
  overlayText.textContent = `10球のスコアは ${score.toLocaleString()} 点。${isNewBest ? '自己ベスト更新！' : 'もう一度挑戦しますか？'}`;
  startButton.textContent = 'PLAY AGAIN';
  startOverlay.classList.remove('hidden');
  message.textContent = 'ゲーム終了';

  if (isNewBest) {
    tone(330, .12, 'triangle', .035);
    tone(440, .12, 'triangle', .035, .12);
    tone(660, .2, 'triangle', .04, .24);
  }
}

startButton.addEventListener('click', () => {
  ensureAudio();
  startGame();
});

swingButton.addEventListener('click', (event) => {
  event.stopPropagation();
  swing();
});

field.addEventListener('pointerdown', (event) => {
  if (event.target.closest('button')) return;
  swing();
});

window.addEventListener('keydown', (event) => {
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
