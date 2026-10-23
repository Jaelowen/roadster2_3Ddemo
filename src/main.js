import './style.css';
import { createScene } from './scene.js';

const container = document.querySelector('#scene');
const loading = document.querySelector('#loading');
const label = document.querySelector('#loading-label');
const progressBar = document.querySelector('#loading-bar');
const percent = document.querySelector('#loading-percent');
const retry = document.querySelector('#retry');
const inputs = Object.fromEntries(['rear', 'side', 'lift'].map(key => [key, document.querySelector(`#${key}-thrust`)]));
const zoom = document.querySelector('#zoom');
const state = { rear: 35, side: 0, lift: 0 };
const listeners = new AbortController();
let experience;

function updateControls() {
  for (const [key, input] of Object.entries(inputs)) {
    input.value = state[key];
    input.style.setProperty('--fill', `${state[key]}%`);
    document.querySelector(`#${key}-output`).innerHTML = `${state[key]}<span>%</span>`;
    input.setAttribute('aria-valuetext', `${state[key]}%`);
  }
  const active = Object.values(state).some(value => value > 0);
  document.querySelector('#thrust-status').textContent = active ? '喷气运行中' : '待机中';
  document.querySelector('#thrust-dot').classList.toggle('active', active);
  experience?.setThrust({ rear: state.rear / 100, side: state.side / 100, lift: state.lift / 100 });
}

try {
  experience = createScene(container, {
    onProgress(value) {
      progressBar.style.width = `${value}%`;
      percent.textContent = `${Math.round(value)}%`;
      label.textContent = value < 95 ? '正在加载 Roadster' : '正在准备材质';
    },
    onReady() {
      container.setAttribute('aria-busy', 'false');
      container.dataset.modelState = 'ready';
      progressBar.style.width = '100%';
      percent.textContent = '100%';
      label.textContent = '展台已就绪';
      loading.classList.add('complete');
    },
    onError(error) {
      console.error('Roadster 加载失败：', error);
      label.textContent = '模型加载失败，请重新尝试';
      retry.hidden = false;
      container.dataset.modelState = 'error';
      container.setAttribute('aria-busy', 'false');
    },
    onZoom(value) { zoom.value = Math.round(value); },
    onInteraction() {
      document.querySelectorAll('[data-view]').forEach(button => {
        button.classList.remove('active');
        button.setAttribute('aria-pressed', 'false');
      });
      document.querySelector('#scene-caption').innerHTML = '自由视角<span>拖动旋转 · 滚轮缩放</span>';
    },
  });
} catch (error) {
  console.error('三维展台初始化失败：', error);
  label.textContent = '请开启浏览器图形加速以查看三维展厅';
  retry.hidden = false;
  container.dataset.modelState = 'error';
}

for (const [key, input] of Object.entries(inputs)) {
  input.addEventListener('input', () => {
    state[key] = Number(input.value);
    updateControls();
  }, { signal: listeners.signal });
}
document.querySelector('#demo').addEventListener('click', () => {
  Object.assign(state, { rear: 85, side: 50, lift: 60 });
  updateControls();
  selectView('rear');
}, { signal: listeners.signal });
document.querySelector('#stop').addEventListener('click', () => {
  Object.assign(state, { rear: 0, side: 0, lift: 0 });
  updateControls();
}, { signal: listeners.signal });
zoom.addEventListener('input', () => experience?.setZoom(Number(zoom.value)), { signal: listeners.signal });

function selectView(view) {
  experience?.setView(view);
  document.querySelectorAll('[data-view]').forEach(button => {
    const active = button.dataset.view === view;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  const names = { front: '前侧视角', rear: '车尾视角', top: '俯视视角' };
  document.querySelector('.stage-index strong').textContent = `${String(['front', 'rear', 'top'].indexOf(view) + 1).padStart(3, '0')} / 003`;
  document.querySelector('#scene-caption').innerHTML = `${names[view]}<span>拖动旋转 · 滚轮缩放</span>`;
}
document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => selectView(button.dataset.view), { signal: listeners.signal }));
document.querySelector('#reset-view').addEventListener('click', () => selectView('front'), { signal: listeners.signal });
document.querySelectorAll('[data-color]').forEach(button => button.addEventListener('click', () => {
  experience?.setColor(button.dataset.color);
  document.querySelector('#paint-name').textContent = button.dataset.name;
  document.querySelectorAll('[data-color]').forEach(swatch => {
    const active = swatch === button;
    swatch.classList.toggle('active', active);
    swatch.setAttribute('aria-pressed', String(active));
  });
}, { signal: listeners.signal }));
retry.addEventListener('click', () => window.location.reload(), { signal: listeners.signal });
updateControls();

// 开发时可从模块查看实际场景状态，不污染 window 全局变量。
export function inspectExperience() { return experience?.inspect(); }
if (import.meta.hot) import.meta.hot.dispose(() => { listeners.abort(); experience?.dispose(); });
