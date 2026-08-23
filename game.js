'use strict';
/*
 * Nostalgic Baseball v0.6
 *
 * 投手は「ティア表」で定義します。強さ・球種・判定幅・運の重さはすべて TIERS の中にあり、
 * 投手を増やすときは表に1行足すだけです。関数を後から上書きする必要はありません。
 */
(function () {

  /* ============================================================
   * DOM
   * ========================================================== */
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
  const bannerLabel = closerBanner.querySelector('span');
  const bannerName = closerBanner.querySelector('strong');
  const baseEls = [
    null,
    document.getElementById('base1'),
    document.getElementById('base2'),
    document.getElementById('base3')
  ];

  /* ============================================================
   * 座標系
   *
   * フィールド幅を 100 とした横方向の座標で投球を解きます。
   * HIT_X はミートポイント。CSS 側のタイミングメーターも同じ値から
   * 位置を決めるので、見た目と判定が必ず一致します。
   * ========================================================== */
  const START_X = 83;
  const HIT_X = 19.5;
  const MISS_X = 8;
  const BALL_TOP = 54;

  const BEST_KEY = 'nb:best';
  const LEGACY_BEST_KEY = 'nostalgicBaseballBest';

  /* ============================================================
   * 投手ティア表
   *
   * band  … ミートポイントからの距離。この値そのものが入力の猶予になる。
   *          hr < double < hit < foul で、foul を超えると空振り。
   * hrChance … 芯を食った打球がスタンドまで届く確率。外れると長打になる。
   *          芯を食う＝必ずホームランにしないための一段。
   * unlucky … 「芯を食ったのに野手の正面」が起きる確率。
   *          実際の野球の BABIP と同じ役割で、これが打者の主なアウト源。
   *          hr 帯は unlucky*0.40、double 帯は *0.70、hit 帯は *1.00 で判定する。
   * speedCap … 球速の上限。ティアごとに持たせることで
   *            「表の accel を上げたのに効かない」という取り残しが起きない。
   * ========================================================== */
  const TIERS = {
    starter: {
      key: 'starter',
      hudLabel: null,
      waitMessage: '投手をよく見て…',
      bodyClass: null,
      pitcherClass: null,
      speedCap: 44,
      band: { hr: 0.95, double: 2.00, hit: 3.40, foul: 5.20 },
      hrChance: 0.55,
      unlucky: 0.32,
      doublePlay: 0.55,
      pitches: [
        { name: 'ストレート',   weight: 30, min: 27, max: 32, accel:  3.5, wave: 1.0, waveRate: 4.4, lateDrop:   0, zone: true },
        { name: 'チェンジアップ', weight: 21, min: 24, max: 28, accel: -1.6, wave: 3.4, waveRate: 4.8, lateDrop:   1, zone: true },
        { name: 'ツーシーム',   weight: 17, min: 26, max: 31, accel:  1.2, wave: 2.6, waveRate: 6.0, lateDrop: 2.2, zone: true },
        { name: 'カーブ',       weight: 13, min: 23, max: 27, accel: -0.5, wave: 2.0, waveRate: 4.1, lateDrop: 5.5, zone: true },
        { name: 'フォーク',     weight: 13, min: 27, max: 31, accel: -2.0, wave: 1.0, waveRate: 5.5, lateDrop:  13, zone: false },
        { name: 'すっぽ抜け',   weight:  6, min: 24, max: 28, accel: -1.0, wave: 2.0, waveRate: 5.0, lateDrop:  -9, zone: false }
      ]
    },
    reliever: {
      key: 'reliever',
      hudLabel: '中継ぎエース 登板中',
      waitMessage: '中継ぎエースを崩せ…',
      bodyClass: 'reliever-mode',
      pitcherClass: 'reliever',
      speedCap: 48,
      band: { hr: 0.82, double: 1.72, hit: 2.95, foul: 4.55 },
      hrChance: 0.50,
      unlucky: 0.42,
      doublePlay: 0.66,
      banner: { label: 'PITCHER CHANGE', name: '中継ぎエース 登板' },
      enterMessage: '3連打で先発KO。中継ぎエースが出てきた！',
      enterInfo: '球速アップ・スライダー追加・打球が野手に掴まりやすい',
      enterTones: [[150, .11, 'triangle', .035, 0], [210, .16, 'square', .035, .12]],
      pitches: [
        { name: '速球',         weight: 31, min: 31, max: 36, accel:  4.4, wave: 1.2, waveRate: 5.2, lateDrop:   0, zone: true },
        { name: 'スライダー',   weight: 22, min: 28, max: 34, accel:  1.0, wave: 4.0, waveRate: 7.0, lateDrop: 3.0, zone: true },
        { name: 'チェンジアップ', weight: 16, min: 25, max: 29, accel: -2.3, wave: 4.6, waveRate: 5.0, lateDrop: 2.2, zone: true },
        { name: 'フォーク',     weight: 23, min: 30, max: 35, accel: -1.0, wave: 1.3, waveRate: 6.0, lateDrop:  14, zone: false },
        { name: '高め外し',     weight:  8, min: 30, max: 35, accel:  2.0, wave: 1.5, waveRate: 5.0, lateDrop: -11, zone: false }
      ]
    },
    closer: {
      key: 'closer',
      hudLabel: 'FINAL BOSS 守護神',
      waitMessage: '守護神を攻略しろ…',
      bodyClass: 'closer-mode',
      pitcherClass: 'closer',
      speedCap: 50,
      band: { hr: 0.70, double: 1.50, hit: 2.55, foul: 3.95 },
      hrChance: 0.45,
      unlucky: 0.52,
      doublePlay: 0.76,
      banner: { label: 'FINAL BOSS', name: '守護神 降臨' },
      enterMessage: '逆転が見えた瞬間――本物の守護神が出てきた。',
      enterInfo: '激ムズ：剛速球・消えるフォーク・極狭のミート幅',
      enterTones: [[92, .16, 'sawtooth', .055, 0], [70, .22, 'square', .05, .14], [185, .28, 'triangle', .05, .32]],
      pitches: [
        { name: '剛速球',         weight: 33, min: 37, max: 42, accel:  6.0, wave: 1.3, waveRate: 6.2, lateDrop:   0, zone: true },
        { name: '高速スライダー', weight: 21, min: 34, max: 40, accel:  2.2, wave: 5.6, waveRate: 8.5, lateDrop: 4.0, zone: true },
        { name: '消えるフォーク', weight: 31, min: 34, max: 40, accel: -0.4, wave: 1.6, waveRate: 6.8, lateDrop:  18, zone: false },
        { name: '超遅球',         weight:  9, min: 25, max: 29, accel: -2.4, wave: 5.5, waveRate: 4.5, lateDrop:   2, zone: true },
        { name: 'ボール球',       weight:  6, min: 34, max: 39, accel:  3.0, wave: 1.6, waveRate: 6.0, lateDrop: -13, zone: false }
      ]
    }
  };

  const ALL_TIER_CLASSES = Object.keys(TIERS)
    .map(key => TIERS[key])
    .filter(tier => tier.bodyClass);

  /* ============================================================
   * 状態
   *
   * 可変な状態はすべてこのオブジェクトに入れます。試合開始時は
   * newState() で作り直すので、変数を追加してもリセット漏れが起きません。
   * ========================================================== */
  function newState() {
    return {
      phase: 'idle',            // idle / between / pitching / resolving / gameover
      score: 0,
      playerRuns: 0,
      opponentRuns: 0,
      outs: 0,
      balls: 0,
      strikes: 0,
      runners: [false, false, false, false],
      consecutiveHits: 0,
      foulsInPa: 0,
      tierKey: 'starter',
      currentPitch: null,
      ballX: START_X,
      elapsed: 0,
      lastTime: 0,
      walkOff: false
    };
  }

  let state = newState();
  let best = loadBest();
  let soundOn = true;
  let audioContext = null;
  let audioBroken = false;
  let pitchFrame = null;
  let battedFrame = null;
  let pendingTimers = [];

  function tier() {
    return TIERS[state.tierKey];
  }

  /* ============================================================
   * 保存（失敗してもゲームは動き続ける）
   * ========================================================== */
  function loadBest() {
    try {
      const stored = window.localStorage.getItem(BEST_KEY);
      // v0.5 以前のキーからは一度だけ引き継ぐ。
      const raw = stored === null ? window.localStorage.getItem(LEGACY_BEST_KEY) : stored;
      const value = Number(raw);
      return Number.isFinite(value) && value >= 0 ? value : 0;
    } catch (error) {
      return 0;
    }
  }

  function saveBest(value) {
    try {
      window.localStorage.setItem(BEST_KEY, String(value));
    } catch (error) {
      /* プライベートブラウズなどでは保存できない。ゲームは続行する。 */
    }
  }

  /* ============================================================
   * ユーティリティ
   * ========================================================== */
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
    const id = window.setTimeout(function () {
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

  function stopAnimations() {
    if (pitchFrame !== null) {
      cancelAnimationFrame(pitchFrame);
      pitchFrame = null;
    }
    if (battedFrame !== null) {
      cancelAnimationFrame(battedFrame);
      battedFrame = null;
    }
  }

  function weightedChoice(items) {
    const total = items.reduce((sum, item) => sum + item.weight, 0);
    let roll = Math.random() * total;
    for (const item of items) {
      roll -= item.weight;
      if (roll <= 0) return Object.assign({}, item);
    }
    return Object.assign({}, items[items.length - 1]);
  }

  /* ============================================================
   * サウンド（生成に失敗しても投球は止めない）
   * ========================================================== */
  function ensureAudio() {
    if (!soundOn || audioBroken) return null;
    try {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) {
        audioBroken = true;
        return null;
      }
      if (!audioContext) audioContext = new Ctor();
      if (audioContext.state === 'suspended') audioContext.resume();
      return audioContext;
    } catch (error) {
      audioBroken = true;
      return null;
    }
  }

  function tone(frequency, duration, type, volume, delay) {
    const ctx = ensureAudio();
    if (!ctx) return;
    try {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = ctx.currentTime + (delay || 0);
      oscillator.type = type || 'square';
      oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(volume || 0.04, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + (duration || 0.08));
      oscillator.connect(gain).connect(ctx.destination);
      oscillator.start(start);
      oscillator.stop(start + (duration || 0.08));
    } catch (error) {
      audioBroken = true;
    }
  }

  function playTones(list) {
    list.forEach(args => tone(args[0], args[1], args[2], args[3], args[4]));
  }

  function playOutcomeSound(kind) {
    if (kind === 'HOME RUN') {
      playTones([[180, .08, 'square', .07, 0], [300, .11, 'square', .055, .06], [480, .18, 'triangle', .05, .13]]);
    } else if (kind === 'DOUBLE' || kind === 'HIT') {
      playTones([[210, .08, 'square', .06, 0], [330, .11, 'triangle', .04, .05]]);
    } else if (kind === 'WALK' || kind === 'BALL') {
      tone(260, .06, 'triangle', .025, 0);
    } else if (kind === 'FOUL') {
      tone(155, .07, 'square', .045, 0);
    } else if (kind === 'DOUBLE PLAY') {
      playTones([[110, .10, 'sawtooth', .04, 0], [78, .16, 'square', .04, .09]]);
    } else {
      tone(92, .12, 'sawtooth', .035, 0);
    }
  }

  /* ============================================================
   * 描画（ボールは transform だけで動かす）
   * ========================================================== */
  let fieldWidth = 0;
  let fieldHeight = 0;
  let ballSize = 12;
  // 最後に描いたボールの論理座標。画面サイズが変わっても飛行中の球が飛ばない。
  const lastDraw = { x: START_X, y: BALL_TOP, scale: 1, rotation: 0 };

  function measureField() {
    const rect = field.getBoundingClientRect();
    fieldWidth = rect.width;
    fieldHeight = rect.height;
    ballSize = Math.min(16, Math.max(10, fieldWidth * 0.015));
    ball.style.width = ballSize + 'px';
    ball.style.height = ballSize + 'px';
    placeBall(lastDraw.x, lastDraw.y, lastDraw.scale, lastDraw.rotation);
  }

  function placeBall(xPercent, yPercent, scale, rotation) {
    lastDraw.x = xPercent;
    lastDraw.y = yPercent;
    lastDraw.scale = scale;
    lastDraw.rotation = rotation;
    const x = xPercent / 100 * fieldWidth - ballSize / 2;
    const y = yPercent / 100 * fieldHeight - ballSize / 2;
    ball.style.transform =
      'translate3d(' + x.toFixed(2) + 'px,' + y.toFixed(2) + 'px,0) scale(' + scale.toFixed(3) + ') rotate(' + rotation.toFixed(1) + 'deg)';
  }

  function resetBall() {
    if (battedFrame !== null) {
      cancelAnimationFrame(battedFrame);
      battedFrame = null;
    }
    ball.classList.remove('flying', 'breaking');
    state.ballX = START_X;
    placeBall(START_X, BALL_TOP, 1, 0);
  }

  function applyTierVisuals() {
    const active = tier();
    ALL_TIER_CLASSES.forEach(function (t) {
      field.classList.toggle(t.bodyClass, t === active);
      pitcher.classList.toggle(t.pitcherClass, t === active);
    });
  }

  function updateHud() {
    scoreEl.textContent = formatScore(state.score);
    bestEl.textContent = formatScore(best);
    runScoreEl.textContent = state.playerRuns + ' - ' + state.opponentRuns;
    countEl.textContent = 'B' + state.balls + ' S' + state.strikes + ' O' + state.outs;
    streakEl.textContent = tier().hudLabel || ('連続安打 ' + state.consecutiveHits);

    const behind = state.opponentRuns - state.playerRuns;
    if (behind < 0) {
      situationEl.textContent = '逆転サヨナラ！';
    } else if (behind === 0) {
      situationEl.textContent = '同点！ あと1点でサヨナラ';
    } else {
      situationEl.textContent = behind + '点ビハインド・あと' + (behind + 1) + '点で逆転';
    }

    for (let base = 1; base <= 3; base += 1) {
      baseEls[base].classList.toggle('occupied', state.runners[base]);
    }
  }

  /* ============================================================
   * 投球
   * ========================================================== */
  function choosePitch() {
    const pitch = weightedChoice(tier().pitches);
    pitch.baseSpeed = randomBetween(pitch.min, pitch.max);
    pitch.phase = Math.random() * Math.PI * 2;
    pitch.kmh = Math.round(82 + pitch.baseSpeed * 2);
    return pitch;
  }

  function currentPitchSpeed() {
    const pitch = state.currentPitch;
    const wave = Math.sin(state.elapsed * pitch.waveRate + pitch.phase) * pitch.wave;
    const speed = pitch.baseSpeed + pitch.accel * state.elapsed + wave;
    return Math.max(13, Math.min(tier().speedCap, speed));
  }

  function pitchVerticalPosition(progress) {
    const pitch = state.currentPitch;
    const naturalArc = Math.sin(progress * Math.PI) * 2.0;
    const micro = Math.sin(state.elapsed * 8 + pitch.phase) * 0.28;
    const late = Math.max(0, (progress - 0.67) / 0.33);
    return BALL_TOP + naturalArc + micro + Math.pow(late, 2.3) * pitch.lateDrop;
  }

  function schedulePitch(delay) {
    if (state.phase === 'gameover') return;
    state.phase = 'between';
    resetBall();
    pitchInfo.textContent = '球種：？？？';
    message.textContent = tier().waitMessage;
    later(beginPitch, delay);
  }

  function beginPitch() {
    if (state.phase === 'gameover') return;
    state.phase = 'pitching';
    state.currentPitch = choosePitch();
    state.ballX = START_X;
    state.elapsed = 0;
    state.lastTime = performance.now();

    pitcher.classList.remove('throwing');
    void pitcher.offsetWidth;
    pitcher.classList.add('throwing');
    message.textContent = '来る！';
    pitchInfo.textContent = '球種：？？？';
    tone(120, .04, 'triangle', .018, 0);
    ball.classList.add('flying');
    pitchFrame = requestAnimationFrame(updatePitch);
  }

  function updatePitch(now) {
    pitchFrame = null;
    if (state.phase !== 'pitching') return;

    const delta = Math.min((now - state.lastTime) / 1000, 0.04);
    state.lastTime = now;
    state.elapsed += delta;
    state.ballX -= currentPitchSpeed() * delta;

    const progress = Math.max(0, Math.min(1, (START_X - state.ballX) / (START_X - MISS_X)));
    placeBall(state.ballX, pitchVerticalPosition(progress), 1 + progress * 0.24, progress * 420);
    ball.classList.toggle('breaking', Math.abs(state.currentPitch.lateDrop) >= 8 && progress > 0.67);

    if (state.ballX <= MISS_X) {
      state.phase = 'resolving';
      if (state.currentPitch.zone) registerStrike('見逃しストライク！');
      else takeBall();
      return;
    }

    pitchFrame = requestAnimationFrame(updatePitch);
  }

  /* ============================================================
   * 打撃判定
   *
   * 帯の順序は 本塁打 → 二塁打 → 単打 → ファウル → 空振り。
   * ファウルと空振りは打席が続くので、「惜しかった」ときほど次の球が来る。
   * 凡打は距離ではなく運判定から生まれる。ここが「打ったのにアウト」の正体。
   * 運（luck）は 1 回だけ引いて全帯で共有するので、芯を食うほどアウトになりにくい。
   * 芯を食った打球は、そのあと hrChance でスタンドインか長打かが決まる。
   * ========================================================== */
  function swing() {
    if (state.phase !== 'pitching') return;
    state.phase = 'resolving';
    stopAnimations();

    batter.classList.remove('swinging');
    void batter.offsetWidth;
    batter.classList.add('swinging');

    const active = tier();
    const band = active.band;
    const distance = Math.abs(state.ballX - HIT_X);
    const luck = Math.random();
    const unlucky = active.unlucky;

    if (!state.currentPitch.zone) {
      registerStrike(state.currentPitch.name + 'にバットが空を切った！');
    } else if (distance <= band.hr) {
      if (luck < unlucky * 0.40) registerGroundOut('会心の当たり。しかし正面を突いた…。');
      else if (Math.random() < active.hrChance) registerHit('HOME RUN');
      else registerHit('DOUBLE');
    } else if (distance <= band.double) {
      if (luck >= unlucky * 0.70) registerHit('DOUBLE');
      else registerGroundOut('抜けたかと思ったが、好守に阻まれた。');
    } else if (distance <= band.hit) {
      if (luck >= unlucky) registerHit('HIT');
      else registerGroundOut('打った！ ……しかし凡打。');
    } else if (distance <= band.foul) {
      registerFoul();
    } else {
      registerStrike('空振り！');
    }
  }

  function takeBall() {
    state.balls += 1;
    if (state.balls >= 4) {
      registerWalk();
      return;
    }
    resolvePitch('BALL', 'ボール。よく見た！', false);
  }

  function registerStrike(detail) {
    state.strikes += 1;
    if (state.strikes >= 3) {
      state.outs += 1;
      state.consecutiveHits = 0;
      resetCount();
      resolvePitch('OUT', '三振！ 1アウト追加', true);
      return;
    }
    resolvePitch('STRIKE', detail, false);
  }

  function registerFoul() {
    if (state.strikes < 2) state.strikes += 1;
    state.foulsInPa += 1;
    // 粘りは3球目までを評価する。無限にファウルしてもポイントは伸びない。
    if (state.foulsInPa <= 3) state.score += 50;
    resolvePitch('FOUL', 'ファウル！ 粘ってもう一球', false);
  }

  function registerWalk() {
    const runs = forceWalk();
    state.playerRuns += runs;
    state.score += 250 + runs * 250;
    state.consecutiveHits = 0;
    resetCount();
    checkWalkOff();
    resolvePitch('WALK', runs ? '押し出し四球！ ' + runs + '点' : 'フォアボール！ 一塁へ', true);
  }

  function registerGroundOut(detail) {
    const active = tier();
    const canDoublePlay = state.runners[1] && state.outs <= 1;

    state.consecutiveHits = 0;
    resetCount();

    if (canDoublePlay && Math.random() < active.doublePlay) {
      state.runners[1] = false;
      state.outs += 2;
      state.score += 40;
      resolvePitch('DOUBLE PLAY', '痛恨の併殺！ バットには当たったのに2アウト…。', true);
      return;
    }

    state.outs += 1;
    state.score += 20;
    resolvePitch('GROUND OUT', detail + ' 1アウト追加。', true);
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

    state.playerRuns += runs;
    state.score += points;
    state.consecutiveHits += 1;
    resetCount();
    checkWalkOff();

    const labels = {
      'HOME RUN': 'ホームラン！ ' + runs + '点',
      'DOUBLE': runs ? '長打！ ' + runs + '点入った！' : 'ツーベース！',
      'HIT': runs ? 'タイムリーヒット！ ' + runs + '点' : 'ヒット！ 走者が進む'
    };

    resolvePitch(kind, labels[kind], true);
  }

  function resetCount() {
    state.balls = 0;
    state.strikes = 0;
    state.foulsInPa = 0;
  }

  function advanceRunners(bases) {
    if (bases >= 4) {
      const existing = runnersOnBase();
      state.runners = [false, false, false, false];
      return existing + 1;
    }

    let scored = 0;
    const next = [false, false, false, false];

    for (let base = 3; base >= 1; base -= 1) {
      if (!state.runners[base]) continue;
      const destination = base + bases;
      if (destination >= 4) scored += 1;
      else next[destination] = true;
    }

    next[bases] = true;
    state.runners = next;
    return scored;
  }

  function forceWalk() {
    for (let base = 1; base <= 3; base += 1) {
      if (!state.runners[base]) {
        state.runners[base] = true;
        return 0;
      }
    }
    return 1;
  }

  function runnersOnBase() {
    return state.runners.slice(1).filter(Boolean).length;
  }

  function checkWalkOff() {
    if (state.playerRuns > state.opponentRuns) {
      state.walkOff = true;
      state.score += 7000;
    }
  }

  /* ============================================================
   * 結果表示と進行
   * ========================================================== */
  const OUTCOME_LABELS = {
    'HOME RUN': 'ホームラン！',
    'DOUBLE': 'ツーベース！',
    'HIT': 'ヒット！',
    'FOUL': 'ファウル',
    'STRIKE': 'ストライク',
    'BALL': 'ボール',
    'WALK': 'フォアボール',
    'OUT': '三振！',
    'GROUND OUT': '凡打…',
    'DOUBLE PLAY': '併殺！'
  };

  function revealPitch() {
    const pitch = state.currentPitch;
    if (!pitch) return;
    pitchInfo.textContent = '球種：' + pitch.name + ' / ' + pitch.kmh + ' km/h' + (pitch.zone ? '' : '・ボール球');
  }

  function resolvePitch(kind, detail, plateAppearanceEnded) {
    stopAnimations();
    state.phase = 'resolving';
    revealPitch();
    message.textContent = detail;
    updateHud();
    playOutcomeSound(kind);

    result.textContent = OUTCOME_LABELS[kind] || kind;
    result.className = 'result ' + kind.toLowerCase().replace(/\s/g, '');
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

    const delay = kind === 'HOME RUN' ? 1350 : kind === 'DOUBLE PLAY' ? 1250 : 950;
    later(function () {
      field.classList.remove('screen-shake');
      result.classList.remove('show');

      if (state.walkOff) {
        endGame(true);
        return;
      }
      if (state.outs >= 3) {
        endGame(false);
        return;
      }

      const nextTier = plateAppearanceEnded ? nextTierKey() : null;
      if (nextTier) {
        changePitcher(nextTier);
        later(function () { schedulePitch(350); }, nextTier === 'closer' ? 1650 : 1500);
        return;
      }

      schedulePitch(380 + Math.random() * 300);
    }, delay);
  }

  function nextTierKey() {
    // 先発 → 中継ぎ：3連打、または一気に4点取られたら降板。
    if (state.tierKey === 'starter') {
      return (state.consecutiveHits >= 3 || state.playerRuns >= 4) ? 'reliever' : null;
    }
    // 中継ぎ → 守護神：本当に逆転が見えたところで登場する。
    if (state.tierKey === 'reliever') {
      const deficit = state.opponentRuns - state.playerRuns;
      const tyingRunDistance = deficit - runnersOnBase();
      const closing = deficit <= 3
        || tyingRunDistance <= 1
        || state.playerRuns >= Math.max(5, state.opponentRuns - 3);
      return closing ? 'closer' : null;
    }
    return null;
  }

  function changePitcher(key) {
    state.tierKey = key;
    state.consecutiveHits = 0;
    const active = tier();

    applyTierVisuals();
    bannerLabel.textContent = active.banner.label;
    bannerName.textContent = active.banner.name;
    message.textContent = active.enterMessage;
    pitchInfo.textContent = active.enterInfo;
    playTones(active.enterTones);
    updateHud();

    closerBanner.classList.remove('show');
    void closerBanner.offsetWidth;
    closerBanner.classList.add('show');
    later(function () { closerBanner.classList.remove('show'); }, 1350);
  }

  function animateBattedBall(type) {
    const startX = state.ballX;
    const duration = type === 'homeRun' ? 900 : type === 'double' ? 690 : 560;
    const started = performance.now();
    const xDistance = type === 'homeRun' ? 66 : type === 'double' ? 52 : 40;
    const height = type === 'homeRun' ? 48 : type === 'double' ? 31 : 22;
    ball.classList.add('flying');

    function frame(now) {
      battedFrame = null;
      const t = Math.min((now - started) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      placeBall(
        startX + ease * xDistance,
        BALL_TOP - Math.sin(t * Math.PI) * height + t * 5,
        1 - t * 0.55,
        t * 900
      );
      if (t < 1) battedFrame = requestAnimationFrame(frame);
      else resetBall();
    }

    battedFrame = requestAnimationFrame(frame);
  }

  /* ============================================================
   * 試合の開始と終了
   * ========================================================== */
  function startGame() {
    clearTimers();
    stopAnimations();

    state = newState();
    state.opponentRuns = randomInt(8, 12);
    state.phase = 'between';

    field.classList.remove('screen-shake');
    closerBanner.classList.remove('show');
    applyTierVisuals();
    startOverlay.classList.add('hidden');
    swingButton.disabled = false;
    swingButton.focus({ preventScroll: true });
    resetBall();
    updateHud();

    message.textContent = '9回裏、まさかの' + state.opponentRuns + '点ビハインド。どこまで追いつけるか。';
    pitchInfo.textContent = '球種は投球結果のあとに表示されます';
    later(function () { schedulePitch(350); }, 850);
  }

  function comebackResult() {
    const remaining = Math.max(0, state.opponentRuns - state.playerRuns);
    const rate = state.opponentRuns > 0 ? state.playerRuns / state.opponentRuns : 0;

    if (state.playerRuns > state.opponentRuns) {
      return {
        title: '伝説のサヨナラ！',
        label: 'GAME CLEAR',
        bonus: 0,
        description: state.opponentRuns + '点ビハインドから' + state.playerRuns + '点を奪って大逆転。普通ならありえない試合をひっくり返した！'
      };
    }
    if (remaining === 0) {
      return {
        title: '奇跡の同点！',
        label: 'CLEAR目前',
        bonus: 2500,
        description: state.opponentRuns + '点ビハインドから' + state.playerRuns + '点を返して同点。サヨナラまで、あと1点だった。'
      };
    }
    if (remaining <= 2) {
      return {
        title: 'あと一打！',
        label: '超猛追',
        bonus: 1200,
        description: state.opponentRuns + '点ビハインドから' + state.playerRuns + '点を返し、あと' + remaining + '点まで迫った。'
      };
    }
    if (remaining <= 4) {
      return {
        title: '射程圏まで来た',
        label: '猛追',
        bonus: 700,
        description: state.opponentRuns + '点ビハインドから' + state.playerRuns + '点を返し、' + remaining + '点差まで詰めた。'
      };
    }
    if (rate >= 0.45 || state.playerRuns >= 4) {
      return {
        title: '反撃成功',
        label: '大反撃',
        bonus: 350,
        description: state.opponentRuns + '点ビハインドから' + state.playerRuns + '点を返した。残りは' + remaining + '点差。'
      };
    }
    return {
      title: '反撃終了',
      label: 'NEXT CHALLENGE',
      bonus: 0,
      description: state.opponentRuns + '点ビハインドから' + state.playerRuns + '点を返した。残りは' + remaining + '点差。'
    };
  }

  function endGame(won) {
    state.phase = 'gameover';
    clearTimers();
    stopAnimations();
    swingButton.disabled = true;
    resetBall();

    const evaluation = comebackResult();
    state.score += evaluation.bonus;

    const isNewBest = state.score > best;
    if (isNewBest) {
      best = state.score;
      saveBest(best);
    }
    updateHud();

    overlayTitle.textContent = evaluation.title;
    overlayText.textContent = evaluation.label + ' — ' + evaluation.description
      + ' 最終ポイント ' + state.score.toLocaleString()
      + (evaluation.bonus ? '（追い上げボーナス +' + evaluation.bonus.toLocaleString() + '）' : '')
      + (isNewBest ? '。自己ベスト更新！' : '。');
    startButton.textContent = 'もう一度挑戦';
    startOverlay.classList.remove('hidden');
    startButton.focus({ preventScroll: true });

    if (won) {
      message.textContent = 'ありえない点差から、逆転サヨナラ！';
      pitchInfo.textContent = isNewBest ? 'GAME CLEAR ＋ 自己ベスト更新！' : 'GAME CLEAR！';
      playTones([[330, .12, 'triangle', .04, 0], [440, .12, 'triangle', .04, .12], [660, .24, 'triangle', .05, .24], [880, .28, 'triangle', .04, .42]]);
    } else if (state.playerRuns === state.opponentRuns) {
      message.textContent = '追いついた。あと1点だった！';
      pitchInfo.textContent = isNewBest ? '奇跡の同点 ＋ 自己ベスト更新！' : '奇跡の同点！';
    } else {
      message.textContent = '3アウト。' + state.playerRuns + '点を返して試合終了。';
      pitchInfo.textContent = isNewBest ? '追い上げで自己ベスト更新！' : '最終点差 ' + (state.opponentRuns - state.playerRuns) + '点';
    }
  }

  /* ============================================================
   * 入力
   * ========================================================== */
  startButton.addEventListener('click', function () {
    ensureAudio();
    startGame();
  });

  swingButton.addEventListener('click', function (event) {
    event.stopPropagation();
    swing();
  });

  field.addEventListener('pointerdown', function (event) {
    if (event.button && event.button !== 0) return;
    if (event.target.closest('button')) return;
    swing();
  });

  window.addEventListener('keydown', function (event) {
    if (event.code !== 'Space' && event.key !== ' ') return;
    const target = event.target;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
    event.preventDefault();
    swing();
  });

  soundButton.addEventListener('click', function () {
    soundOn = !soundOn;
    soundButton.textContent = soundOn ? '♪' : '×';
    soundButton.setAttribute('aria-label', soundOn ? 'サウンドをオフ' : 'サウンドをオン');
    if (soundOn) tone(440, .06, 'triangle', .025, 0);
  });

  // タブを離れている間は投球を止める。戻ってきたら投げ直しから再開する。
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      if (state.phase === 'pitching' || state.phase === 'between') {
        stopAnimations();
        clearTimers();
        state.phase = 'paused';
        resetBall();
        message.textContent = '一時停止中…';
      }
      return;
    }
    if (state.phase === 'paused') {
      schedulePitch(700);
    } else if (state.phase === 'pitching') {
      // 裏に回っている間に投球が始まっていた場合の保険。
      state.lastTime = performance.now();
      if (pitchFrame === null) pitchFrame = requestAnimationFrame(updatePitch);
    }
  });

  /* ============================================================
   * 初期化
   * ========================================================== */
  field.style.setProperty('--hit-x', HIT_X + '%');
  measureField();
  if (typeof ResizeObserver === 'function') {
    new ResizeObserver(measureField).observe(field);
  } else {
    window.addEventListener('resize', measureField);
  }
  updateHud();
})();
