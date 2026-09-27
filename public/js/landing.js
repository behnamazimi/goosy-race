import * as S from '../shared/sim.js';
import { drawGooseIcon } from './render.js';
import { bindCodeInput, normCode, createAndGo } from './room.js';

const $ = (s) => document.querySelector(s);
const msg = $('#landMsg');

const hero = $('#heroGoose');
let t = 0;
(function loop() {
  t += 1 / 60;
  const lane = Math.floor(t / 1.6) % 8;
  drawGooseIcon(hero, lane, S.HATS[lane % S.HATS.length], { run: 0.8, phase: t * 12, t, honk: (t % 1.6) < 0.3 ? 1 : 0 });
  requestAnimationFrame(loop);
})();

async function create(tv) {
  msg.textContent = 'Building a pond…';
  $('#createBtn').disabled = true;
  try {
    const status = await createAndGo(tv);
    if (status) msg.textContent = status === 429 ? 'Whoa, lots of rooms from here. Try again in a few minutes.' : 'The pond is packed right now. Try again in a minute.';
  } catch {
    msg.textContent = "Couldn't reach the server. Check your connection.";
  } finally {
    $('#createBtn').disabled = false;
  }
}

$('#createBtn').addEventListener('click', () => create(false));
$('#createTvBtn').addEventListener('click', () => create(true));

const codeIn = $('#codeIn');
bindCodeInput(codeIn);
$('#joinCode').addEventListener('submit', (e) => {
  e.preventDefault();
  const c = normCode(codeIn.value);
  if (c.length !== 5) { msg.textContent = 'Room codes have 5 characters, like KQ7-PZ.'; return; }
  location.href = `/r/${c}`;
});
