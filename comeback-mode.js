// v0.4: 「サヨナラは真のゲームクリア」にするための逆転チャレンジ調整。
// 既存の打撃・投球ロジックは game.js をそのまま使い、試合開始条件と終了評価を拡張します。

startGame = function () {
  clearTimers();
  cancelAnimationFrame(animationId);
  score = 0;
  playerRuns = 0;
  opponentRuns = randomInt(8, 12);
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

  message.textContent = `9回裏、まさかの${opponentRuns}点ビハインド。どこまで追いつけるか。`;
  pitchInfo.textContent = '球種は投球結果のあとに表示されます';
  later(() => schedulePitch(350), 850);
};

checkWalkOff = function () {
  if (playerRuns > opponentRuns) {
    walkOff = true;
    // 大差をひっくり返した時だけ得られる特大クリアボーナス。
    score += 7000;
  }
};

function comebackResult() {
  const remaining = Math.max(0, opponentRuns - playerRuns);
  const comebackRate = opponentRuns > 0 ? playerRuns / opponentRuns : 0;

  if (playerRuns > opponentRuns) {
    return {
      title: '伝説のサヨナラ！',
      label: 'GAME CLEAR',
      bonus: 0,
      description: `${opponentRuns}点ビハインドから${playerRuns}点を奪って大逆転。普通ならありえない試合をひっくり返した！`
    };
  }

  if (playerRuns === opponentRuns) {
    return {
      title: '奇跡の同点！',
      label: 'CLEAR目前',
      bonus: 2500,
      description: `${opponentRuns}点ビハインドから${playerRuns}点を返して同点。サヨナラまで、あと1点だった。`
    };
  }

  if (remaining <= 2) {
    return {
      title: 'あと一打！',
      label: '超猛追',
      bonus: 1200,
      description: `${opponentRuns}点ビハインドから${playerRuns}点を返し、あと${remaining}点まで迫った。`
    };
  }

  if (comebackRate >= 0.6 || playerRuns >= 5) {
    return {
      title: '猛追！',
      label: '大反撃',
      bonus: 600,
      description: `${opponentRuns}点ビハインドから${playerRuns}点を返し、${remaining}点差まで追い上げた。`
    };
  }

  return {
    title: '反撃終了',
    label: 'NEXT CHALLENGE',
    bonus: 0,
    description: `${opponentRuns}点ビハインドから${playerRuns}点を返した。残りは${remaining}点差。`
  };
}

endGame = function (won) {
  phase = 'gameover';
  clearTimers();
  cancelAnimationFrame(animationId);
  swingButton.disabled = true;
  resetBall();

  const evaluation = comebackResult();
  score += evaluation.bonus;

  const isNewBest = score > best;
  if (isNewBest) {
    best = score;
    localStorage.setItem('nostalgicBaseballBest', String(best));
  }
  updateHud();

  overlayTitle.textContent = evaluation.title;
  overlayText.textContent = `${evaluation.label} — ${evaluation.description} 最終ポイント ${score.toLocaleString()}${evaluation.bonus ? `（追い上げボーナス +${evaluation.bonus.toLocaleString()}）` : ''}${isNewBest ? '。自己ベスト更新！' : '。'}`;
  startButton.textContent = 'もう一度挑戦';
  startOverlay.classList.remove('hidden');

  if (won) {
    message.textContent = 'ありえない点差から、逆転サヨナラ！';
    pitchInfo.textContent = isNewBest ? 'GAME CLEAR ＋ 自己ベスト更新！' : 'GAME CLEAR！';
    tone(330, .12, 'triangle', .04);
    tone(440, .12, 'triangle', .04, .12);
    tone(660, .24, 'triangle', .05, .24);
    tone(880, .28, 'triangle', .04, .42);
  } else if (playerRuns === opponentRuns) {
    message.textContent = '追いついた。あと1点だった！';
    pitchInfo.textContent = isNewBest ? '奇跡の同点 ＋ 自己ベスト更新！' : '奇跡の同点！';
  } else {
    message.textContent = `3アウト。${playerRuns}点を返して試合終了。`;
    pitchInfo.textContent = isNewBest ? '追い上げで自己ベスト更新！' : `最終点差 ${opponentRuns - playerRuns}点`;
  }
};
