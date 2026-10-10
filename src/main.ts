import './styles/main.css';
import { Game } from './app/Game';

const app = document.getElementById('app')!;
try {
  const game = new Game(app);
  (window as unknown as { __game: Game }).__game = game; // 除錯用
  game.init().catch(showFatal);
} catch (e) {
  showFatal(e);
}

function showFatal(e: unknown) {
  console.error(e);
  const d = document.createElement('div');
  d.className = 'fatal';
  d.innerHTML = `<h2>遊戲啟動失敗</h2><p>${String((e as Error)?.message ?? e)}</p><p>請確認瀏覽器支援 WebGL，並重新整理頁面。</p>`;
  document.body.appendChild(d);
}
