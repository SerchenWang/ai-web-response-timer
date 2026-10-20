// ==UserScript==
// @name         AI Web Response Timer (four platforms)
// @namespace    local.research.timer
// @version      1.3.0
// @description  跨设备便携版：内置四站计时规则，支持拖动和四角定位。本地运行，不上传数据。
// @match        https://chatgpt.com/*
// @match        https://gemini.google.com/*
// @match        https://chat.deepseek.com/*
// @match        https://chatglm.cn/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==
(() => {
  'use strict';
  if (window.__localAiTimerInstalled) return;

  const platform = location.hostname.includes('chatgpt') ? 'ChatGPT'
    : location.hostname.includes('gemini') ? 'Gemini'
    : location.hostname.includes('deepseek') ? 'DeepSeek' : '智谱清言';
  const EDITOR = '#prompt-textarea, textarea, [contenteditable="true"]';
  const customSite = platform === 'DeepSeek' || platform === '智谱清言';
  const BUTTON = customSite
    ? 'button, [role="button"], .ds-icon-button, .ds-button, .ds-button__icon, .enter-icon-container'
    : 'button, [role="button"]';
  const STORE = '__ai_timer_v12';
  function readSettings() {
    try {
      const value = JSON.parse(localStorage.getItem(STORE));
      return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    } catch { return {}; }
  }
  const settings = readSettings();
  function saveSettings() {
    try { localStorage.setItem(STORE, JSON.stringify(settings)); }
    catch { note.textContent = '浏览器不允许保存设置，本次仍可使用'; }
  }
  const STOP_SELECTOR = '[data-testid="stop-button"], [data-testid="stop-generation-button"]';
  const SEND_SELECTOR = '[data-testid="send-button"]';
  const STOP_NAME = /^(?:stop(?: generating| generation| response| responding)?|停止(?:生成|回答|回复|响应|输出)?|终止生成|中止生成)[.!。！]?$/i;
  const SEND_NAME = /^(?:send(?: message| prompt)?|submit|发送(?:消息|提示|提示词)?|提交)[.!。！]?$/i;

  const panel = document.createElement('div');
  panel.id = '__ai_response_timer_overlay';
  panel.style.cssText = 'position:fixed;right:18px;bottom:18px;z-index:2147483647;background:#18212df2;color:#fff;border:1px solid #607080;border-radius:12px;padding:12px 14px;box-shadow:0 6px 22px #0005;font:13px/1.5 system-ui,sans-serif;min-width:215px';
  function add(tag, text, style, parent = panel) {
    const el = document.createElement(tag);
    el.textContent = text;
    if (style) el.style.cssText = style;
    parent.appendChild(el);
    return el;
  }
  const handle = add('div', platform + ' · 拖动此处移动', 'cursor:move;touch-action:none;font-weight:600;padding:3px 0 7px;user-select:none');
  const state = add('div', '就绪');
  const clock = add('div', '0.0 s', 'font:600 28px/1.5 ui-monospace,Consolas,monospace');
  const note = add('div', '发送后自动开始', 'color:#c3cbd5;font-size:11px;max-width:260px');
  const row = add('div', '', 'display:flex;gap:6px;margin-top:9px');
  function button(label, action) {
    const el = add('button', label, 'background:#364b64;border:1px solid #8090a8;border-radius:6px;color:white;padding:4px 9px;cursor:pointer;font:inherit', row);
    el.type = 'button';
    el.addEventListener('click', action);
  }
  function mount() {
    if (!panel.isConnected) (document.body || document.documentElement).appendChild(panel);
  }

  const positionRow = add('label', '位置：', 'display:block;margin-top:8px;font-size:12px');
  const position = add('select', '', 'background:#364b64;color:white;border:1px solid #8090a8;border-radius:4px;padding:3px', positionRow);
  for (const [value, text] of [['top-left', '左上角'], ['top-right', '右上角'], ['bottom-left', '左下角'], ['bottom-right', '右下角'], ['custom', '拖动位置']]) {
    const option = add('option', text, '', position);
    option.value = value;
  }
  function place(x, y) {
    const rect = panel.getBoundingClientRect();
    const left = Math.max(0, Math.min(x, Math.max(0, innerWidth - rect.width)));
    const top = Math.max(0, Math.min(y, Math.max(0, innerHeight - rect.height)));
    Object.assign(panel.style, {left: left + 'px', top: top + 'px', right: 'auto', bottom: 'auto'});
    return {x: left, y: top};
  }
  function applyPosition() {
    const mode = ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'custom'].includes(settings.corner) ? settings.corner : 'top-left';
    position.value = mode;
    if (mode === 'custom' && Number.isFinite(settings.x) && Number.isFinite(settings.y)) {
      place(settings.x, settings.y);
    } else {
      const rect = panel.getBoundingClientRect();
      place(mode.endsWith('right') ? innerWidth - rect.width - 18 : 18,
        mode.startsWith('bottom') ? innerHeight - rect.height - 18 : 18);
    }
  }
  position.addEventListener('change', () => {
    settings.corner = position.value;
    if (position.value === 'custom') {
      const rect = panel.getBoundingClientRect();
      settings.x = rect.left; settings.y = rect.top;
    }
    applyPosition(); saveSettings();
  });
  let dragging = null;
  handle.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    const rect = panel.getBoundingClientRect();
    dragging = {id: event.pointerId, dx: event.clientX - rect.left, dy: event.clientY - rect.top};
    handle.setPointerCapture(event.pointerId);
    event.preventDefault();
  });
  handle.addEventListener('pointermove', event => {
    if (!dragging || event.pointerId !== dragging.id) return;
    const point = place(event.clientX - dragging.dx, event.clientY - dragging.dy);
    settings.corner = 'custom'; settings.x = point.x; settings.y = point.y;
    position.value = 'custom';
  });
  function stopDragging(event) {
    if (!dragging || event.pointerId !== dragging.id) return;
    dragging = null;
    saveSettings();
  }
  handle.addEventListener('pointerup', stopDragging);
  handle.addEventListener('pointercancel', stopDragging);
  window.addEventListener('resize', applyPosition);

  const now = () => performance.now();
  let running = false;
  let started = 0;
  let sawBusy = false;
  let missingSince = null;
  let candidate = null;
  let frame = 0;
  let lastBusy = false;
  let lastURL = location.href;
  let backgrounded = false;

  function visible(el) {
    if (panel.contains(el) || !el.isConnected || el.closest('[hidden], [aria-hidden="true"]')) return false;
    const style = getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden'
      && style.visibility !== 'collapse' && el.getClientRects().length > 0;
  }
  function names(el) {
    // Check each attribute separately: an unfamiliar aria-label must not mask a valid test ID.
    return ['aria-label', 'title', 'data-testid'].map(key => el.getAttribute(key) || '')
      .concat(el.textContent || '').map(s => s.trim().replace(/\s+/g, ' '));
  }
  function stopButton(el) {
    return el.matches(STOP_SELECTOR) || names(el).some(s => STOP_NAME.test(s)
      || /^(?:stop[-_](?:button|generation|generating)(?:[-_]button)?)$/i.test(s));
  }
  const SHAPE_ATTRS = ['d', 'x', 'y', 'width', 'height', 'rx', 'ry', 'cx', 'cy', 'r', 'points', 'x1', 'x2', 'y1', 'y2', 'transform'];
  // Embedded from the user's working calibration. No per-device learning is required.
  const DEEPSEEK_STOP_PATH = 'M2 4.88C2 3.68009 2 3.08013 2.30557 2.65954C2.40426 2.52371 2.52371 2.40426 2.65954 2.30557C3.08013 2 3.68009 2 4.88 2H11.12C12.3199 2 12.9199 2 13.3405 2.30557C13.4763 2.40426 13.5957 2.52371 13.6944 2.65954C14 3.08013 14 3.68009 14 4.88V11.12C14 12.3199 14 12.9199 13.6944 13.3405C13.5957 13.4763 13.4763 13.5957 13.3405 13.6944C12.9199 14 12.3199 14 11.12 14H4.88C3.68009 14 3.08013 14 2.65954 13.6944C2.52371 13.5957 2.40426 13.4763 2.30557 13.3405C2 12.9199 2 12.3199 2 11.12V4.88Z';
  const BUILTIN_STOP_ICONS = {
    DeepSeek: 'svg:' + JSON.stringify(['0 0 16 16', [['path',
      ...SHAPE_ATTRS.map(attr => attr === 'd' ? DEEPSEEK_STOP_PATH : null), null, null]]]),
    '智谱清言': 'img:data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjMyIiBoZWlnaHQ9IjMyIiByeD0iMTYiIGZpbGw9IiMxQTIwMjkiLz4KPHJlY3QgeD0iMTAiIHk9IjEwIiB3aWR0aD0iMTIiIGhlaWdodD0iMTIiIHJ4PSIyIiBmaWxsPSJ3aGl0ZSIvPgo8L3N2Zz4K'
  };
  function iconKey(icon) {
    if (icon.matches('img')) return 'img:' + (icon.getAttribute('src') || '');
    const shapes = Array.from(icon.querySelectorAll('path, rect, circle, ellipse, polygon, polyline, line, use'));
    if (!shapes.length || shapes.length > 32) return '';
    return 'svg:' + JSON.stringify([icon.getAttribute('viewBox'), shapes.map(shape => [shape.tagName,
      ...SHAPE_ATTRS.map(attr => shape.getAttribute(attr)), shape.getAttribute('href'), shape.getAttribute('xlink:href')])]);
  }
  function learnedBusy() {
    if (!customSite) return false;
    const known = new Set([BUILTIN_STOP_ICONS[platform], settings.stopIcon].filter(key => typeof key === 'string' && key));
    return Array.from(document.querySelectorAll('svg, img')).some(icon => visible(icon) && known.has(iconKey(icon)));
  }
  function busy() {
    return Array.from(document.querySelectorAll(BUTTON)).some(el => visible(el) && stopButton(el)) || learnedBusy();
  }
  function sendButton(el) {
    if (customSite && visible(el) && !el.disabled && el.getAttribute('aria-disabled') !== 'true'
      && !el.closest('.disabled, .is-disabled')) {
      // Exact arrow geometry supplied by the user, restricted to DeepSeek's button wrapper.
      if (platform === 'DeepSeek' && el.querySelector('.ds-button__icon path[d^="M8.3125 0.980206"], path[d^="M8.3125 0.980206"]')) return true;
      if (platform === '智谱清言' && el.matches('.enter-icon-container') && !el.matches('.empty')
        && el.closest('.enter') && !learnedBusy()) return true;
    }
    return !el.disabled && visible(el) && !stopButton(el)
      && (el.matches(SEND_SELECTOR) || names(el).some(s => SEND_NAME.test(s)
        || /^send[-_](?:button|message|prompt)$/i.test(s)));
  }
  function draw() {
    if (!running) return;
    clock.textContent = ((now() - started) / 1000).toFixed(1) + ' s';
    frame = requestAnimationFrame(draw);
  }
  function begin(via, at = now()) {
    if (running) return;
    started = at;
    running = true;
    sawBusy = false;
    missingSince = null;
    backgrounded = document.hidden;
    candidate = null;
    state.textContent = '计时中';
    note.textContent = via === 'busy' ? '已检测到生成状态，自动补启动' : '等待生成完成（包含思考和输出）';
    cancelAnimationFrame(frame);
    draw();
  }
  function finish(auto, at = now()) {
    if (!running) return;
    running = false;
    cancelAnimationFrame(frame);
    clock.textContent = (Math.max(0, at - started) / 1000).toFixed(1) + ' s';
    state.textContent = auto ? '自动结束' : '手动结束';
    note.textContent = (auto ? '生成控件已消失；取消或出错也可能触发结束' : '以手动点击为结束时间')
      + (backgrounded ? '；曾切入后台，误差可能增大' : '');
  }
  function reset() {
    running = false;
    cancelAnimationFrame(frame);
    candidate = null;
    sawBusy = false;
    missingSince = null;
    // Resetting during generation should not immediately start another timer.
    lastBusy = busy();
    clock.textContent = '0.0 s';
    state.textContent = '就绪';
    note.textContent = '发送后自动开始';
  }
  button('手动开始', () => begin('manual'));
  button('手动结束', () => finish(false));
  button('重置', reset);

  let learning = false;
  let hovered = null;
  if (customSite) {
    button('学习停止图标', () => {
      learning = !learning;
      hovered = null;
      note.textContent = learning ? '请在生成中悬停停止图标，按 F8；Esc 取消。不要点击。' : '已取消学习';
    });
    row.style.flexWrap = 'wrap';
    row.style.maxWidth = '270px';
    note.textContent = '已内置本站停止特征，无需首次学习';
  }
  window.addEventListener('pointermove', event => {
    if (learning) hovered = targetElement(event);
  }, true);
  window.addEventListener('keydown', event => {
    if (!learning || !event.isTrusted) return;
    if (event.key === 'Escape') {
      learning = false; hovered = null; note.textContent = '已取消学习'; return;
    }
    if (event.key !== 'F8') return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (!hovered || panel.contains(hovered)) {
      note.textContent = '请先将鼠标移到网页停止图标上，再按 F8'; return;
    }
    const icon = hovered.closest('svg, img') || hovered.querySelector('svg, img');
    const key = icon && visible(icon) && iconKey(icon);
    if (!key || key.length > 24000) {
      note.textContent = '未捕获到图标，请悬停图标中央再按 F8'; return;
    }
    settings.stopIcon = key;
    learning = false; hovered = null;
    saveSettings();
    note.textContent = '已学习停止图标；请等待本轮结束，观察能否自动结束';
    checkState();
  }, true);

  function targetElement(event) {
    const target = event.composedPath ? event.composedPath()[0] : event.target;
    return target instanceof Element ? target : target && target.parentElement;
  }
  function markCandidate() {
    if (!running) {
      candidate = now();
      // These sites use unlabeled div controls; don't require a recognized stop icon to start.
      if (customSite) begin('send', candidate);
    }
  }
  window.addEventListener('keydown', event => {
    if (!event.isTrusted || event.isComposing || event.keyCode === 229 || event.repeat
      || event.key !== 'Enter' || event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return;
    const el = targetElement(event);
    if (el && !panel.contains(el) && el.closest(EDITOR)) markCandidate();
  }, true);
  // Record the gesture before the site replaces its send button with a stop button.
  window.addEventListener('pointerdown', event => {
    if (!event.isTrusted || event.button !== 0) return;
    const el = targetElement(event);
    const btn = el && el.closest(BUTTON);
    if (btn && sendButton(btn)) markCandidate();
  }, true);
  window.addEventListener('click', event => {
    if (!event.isTrusted) return;
    const el = targetElement(event);
    const btn = el && el.closest(BUTTON);
    if (btn && sendButton(btn)) markCandidate();
  }, true);
  window.addEventListener('submit', event => {
    if (event.isTrusted && event.target && event.target.querySelector
      && event.target.querySelector(EDITOR)) markCandidate();
  }, true);

  function checkState() {
    mount();
    const t = now();
    const active = busy();
    if (location.href !== lastURL) {
      lastURL = location.href;
      if (!active) candidate = null;
      // A new idle conversation is navigation, not a completed response.
      // Keep an active timer when a first send changes the conversation URL.
      if (running && sawBusy && !active) {
        finish(false, t);
        state.textContent = '页面已切换';
        note.textContent = '本轮计时中断，请重新发送后计时';
      }
    }
    if (!running && active && !lastBusy) {
      const at = candidate !== null && t - candidate <= 15000 ? candidate : t;
      begin(at === t ? 'busy' : 'send', at);
    }
    if (candidate !== null && t - candidate > 15000) candidate = null;
    lastBusy = active;
    if (!running) return;
    if (customSite && !sawBusy && t - started > 2500 && !active && !learning) {
      note.textContent = '尚未检测到停止图标；若网站已改版，可重新学习或手动结束';
    }
    if (active) {
      sawBusy = true;
      missingSince = null;
    } else if (sawBusy) {
      if (missingSince === null) missingSince = t;
      // Confirm disappearance for one second, but report the first disappearance time.
      if (t - missingSince >= 1000) finish(true, missingSince);
    }
  }

  mount();
  applyPosition();
  // Do not time a response already in progress when the script is first loaded.
  lastBusy = busy();
  window.__localAiTimerInstalled = true;
  setInterval(checkState, 200);
  document.addEventListener('visibilitychange', () => {
    if (running && document.hidden) {
      backgrounded = true;
      note.textContent = '已切入后台；计时继续，状态检测可能延迟';
    }
  });
})();
