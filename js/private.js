'use strict';
const $ = id => document.getElementById(id);
const status = message => { $('status').textContent = message; };
let busy = false;
async function api(action, body, query = '') {
  const response = await fetch(`/api/passkey?action=${action}${query}`, {
    method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin', cache: 'no-store',
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const result = await response.json();
  if (!response.ok) throw Error(result.error || '요청을 완료하지 못했어요.');
  return result;
}
function clearPrivate() {
  $('unlocked').hidden = true;
  $('items').replaceChildren(); $('keys').replaceChildren();
}
async function refresh() {
  clearPrivate();
  const { user } = await api('session');
  $('locked').hidden = Boolean(user);
  if (!user) { status('잠겨 있어요. 패스키로 들어와 주세요.'); return; }
  const [{ items }, { keys }] = await Promise.all([api('items'), api('keys')]);
  for (const item of items) {
    const article = document.createElement('article');
    const title = document.createElement('h3'); title.textContent = item.title;
    const body = document.createElement('p'); body.textContent = item.body;
    article.append(title, body); $('items').append(article);
  }
  for (const key of keys) {
    const li = document.createElement('li'), label = document.createElement('div');
    label.textContent = key.name;
    const date = document.createElement('small');
    date.textContent = `등록 ${new Date(key.created_at).toLocaleDateString('ko-KR')} · ${key.device_type === 'multiDevice' ? '동기화 가능한 패스키' : '단일 기기 패스키'}`;
    label.append(date);
    const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = '삭제';
    remove.setAttribute('aria-label', `${key.name} 패스키 삭제`);
    remove.addEventListener('click', () => {
      if (confirm(`“${key.name}” 패스키를 삭제할까요? 이 키로 로그인한 세션도 종료돼요.`)) {
        run(async () => { await api('delete-key', { id: key.id }); await refresh(); });
      }
    });
    li.append(label, remove); $('keys').append(li);
  }
  $('unlocked').hidden = false;
  status(`${user.name}님의 공간이 열렸어요.`);
}
async function run(task) {
  if (busy) return;
  busy = true;
  document.querySelectorAll('button').forEach(button => { button.disabled = true; });
  try { await task(); }
  catch (error) {
    if (error.name === 'NotAllowedError' || error.cause?.name === 'NotAllowedError' || error.code === 'ERROR_CEREMONY_ABORTED') {
      status('패스키 확인이 취소됐거나 시간이 지났어요. 다시 시도할 수 있어요.');
    } else { status(error.message || '패스키 확인을 완료하지 못했어요.'); }
  } finally {
    busy = false;
    document.querySelectorAll('button').forEach(button => { button.disabled = false; });
  }
}
async function register(name, invitation) {
  status('패스키를 보관할 기기 또는 관리자를 선택해 주세요.');
  const optionsJSON = await api('register-options', { name, invitation });
  const credential = await SimpleWebAuthnBrowser.startRegistration({ optionsJSON });
  await api('register-verify', { credential });
  $('invitation').value = ''; $('first-name').value = ''; $('extra-name').value = '';
  await refresh();
}
$('login').addEventListener('click', () => run(async () => {
  status('등록한 패스키를 선택해 주세요.');
  const optionsJSON = await api('login-options', {});
  const credential = await SimpleWebAuthnBrowser.startAuthentication({ optionsJSON });
  await api('login-verify', { credential }); await refresh();
}));
$('first-key').addEventListener('submit', event => { event.preventDefault(); run(() => register($('first-name').value.trim(), $('invitation').value.trim())); });
$('extra-key').addEventListener('submit', event => { event.preventDefault(); run(() => register($('extra-name').value.trim())); });
$('logout').addEventListener('click', () => run(async () => {
  clearPrivate(); await api('logout', {}); await refresh();
}));
// Invitation is kept out of HTTP URLs/referrers, then removed from browser history.
if (location.hash.startsWith('#invite=')) {
  $('invitation').value = new URLSearchParams(location.hash.slice(1)).get('invite') || '';
  history.replaceState(null, '', location.pathname); $('enrollment').open = true;
}
addEventListener('pagehide', clearPrivate);
addEventListener('pageshow', () => run(refresh));
document.addEventListener('visibilitychange', () => {
  if (document.hidden) clearPrivate(); else run(refresh);
});
if (!window.PublicKeyCredential || !window.isSecureContext) {
  status('패스키를 지원하는 최신 브라우저에서 HTTPS 주소로 열어 주세요.');
} else { run(refresh); }
