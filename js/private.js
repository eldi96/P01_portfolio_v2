'use strict';
const $ = id => document.getElementById(id);
const status = message => { for (const id of ['status','key-status','enrollment-status']) { const node=$(id); if(node)node.textContent=message; } };
let busy = false;
async function api(action, body, query = '') {
  const response = await fetch(`/api/passkey?action=${action}${query}`, {
    method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin', cache: 'no-store',
    signal: AbortSignal.timeout(20000),
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
  $('transfer').hidden = true; $('transfer-url').value = '';
}
async function refresh() {
  clearPrivate();
  $('login').hidden = false;
  if ($('invitation').value) {
    $('locked').hidden = false; $('enrollment').open = true; $('login').hidden = true;
    status('로그인 없이 이 기기에 패스키를 등록할 수 있어요. 이름을 입력해 주세요.'); return;
  }
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
    } else if (error.code === 'ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED' || error.name === 'InvalidStateError') {
      status('이 저장소에는 이미 패스키가 있어요. 다른 기기 등록 링크로 아이폰에 추가해 보세요.');
    } else if (error.name === 'TimeoutError' || error.name === 'TypeError') {
      status('서버 응답을 받지 못했어요. 네트워크를 확인한 뒤 다시 시도해 주세요. 이미 저장한 키는 삭제하지 않아도 돼요.');
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
  status('기기 확인을 마쳤어요. 서버에서 등록을 확인하고 있어요.');
  await api('register-verify', { credential });
  $('invitation').value = ''; $('first-name').value = ''; $('extra-name').value = '';
  await refresh();
  status('패스키 등록을 완료했어요. 이 기기에서 나만의 공간을 사용할 수 있어요.');
  $('unlocked').scrollIntoView({ block: 'start', behavior: 'smooth' });
}
$('login').addEventListener('click', () => run(async () => {
  status('등록한 패스키를 선택해 주세요.');
  const optionsJSON = await api('login-options', {});
  const credential = await SimpleWebAuthnBrowser.startAuthentication({ optionsJSON });
  await api('login-verify', { credential }); await refresh();
}));
$('first-key').addEventListener('submit', event => { event.preventDefault(); run(() => register($('first-name').value.trim(), $('invitation').value.trim())); });
$('extra-key').addEventListener('submit', event => { event.preventDefault(); run(() => register($('extra-name').value.trim())); });
$('make-link').addEventListener('click', () => run(async () => {
  const result = await api('enrollment-link', {});
  $('transfer-url').value = result.url; $('transfer').hidden = false;
  status('5분 안에 본인 아이폰의 Safari에서 링크를 열어 주세요. 등록이 끝날 때까지 이 PC에서 로그아웃하지 마세요.');
}));
$('copy-link').addEventListener('click', () => run(async () => {
  try { await navigator.clipboard.writeText($('transfer-url').value); status('링크를 복사했어요. 본인 아이폰으로 전달해 Safari에서 열어 주세요.'); }
  catch { $('transfer-url').select(); status('위 링크를 직접 복사해 주세요.'); }
}));
$('revoke-link').addEventListener('click', () => run(async () => {
  await api('revoke-enrollment-link', {});
  $('transfer-url').value = ''; $('transfer').hidden = true; status('추가 등록 링크를 취소했어요.');
}));
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
  if (busy) return; // Do not erase the registration form during an OS authentication prompt.
  if (document.hidden) clearPrivate(); else run(refresh);
});
if (!window.PublicKeyCredential || !window.isSecureContext) {
  status('패스키를 지원하는 최신 브라우저에서 HTTPS 주소로 열어 주세요.');
} else { run(refresh); }
