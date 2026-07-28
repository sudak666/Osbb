import { createProminPolling, prominClient } from '../src/promin-api.js';

const elements = {
  status: document.getElementById('connection-status'),
  help: document.getElementById('connection-help'),
  list: document.getElementById('houses-list'),
  search: document.getElementById('house-search'),
  refresh: document.getElementById('refresh-button'),
  dialog: document.getElementById('equipment-dialog'),
  title: document.getElementById('equipment-title'),
  loading: document.getElementById('equipment-loading'),
  content: document.getElementById('equipment-content'),
  duDialog: document.getElementById('du-confirm-dialog'),
  snackbar: document.getElementById('snackbar'),
};

let houses = [];
let selectedEquipmentId = null;
let pendingDuAction = null;
let focusReturn = null;

function textFromLegacyHtml(value) {
  const template = document.createElement('template');
  template.innerHTML = String(value || '');
  return template.content.textContent?.replace(/\s+/g, ' ').trim() || 'Немає даних';
}

function setConnectionState(kind, text) {
  elements.status.className = `status-chip is-${kind}`;
  const icon = kind === 'ok' ? 'check-circle-outline' : kind === 'error' ? 'lan-disconnect' : 'loading mdi-spin';
  elements.status.innerHTML = `<span class="mdi mdi-${icon}" aria-hidden="true"></span><span></span>`;
  elements.status.lastElementChild.textContent = text;
}

function updateSummary() {
  document.getElementById('house-count').textContent = String(houses.length);
  document.getElementById('alarm-count').textContent = String(houses.filter((house) => house.alarmed).length);
  document.getElementById('offline-count').textContent = String(houses.filter((house) => house.disconnected).length);
}

function renderHouses() {
  const query = elements.search.value.trim().toLocaleLowerCase('uk-UA');
  const visible = houses.filter((house) => !query || house.caption.toLocaleLowerCase('uk-UA').includes(query));
  elements.list.replaceChildren();
  if (!visible.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = houses.length ? 'За пошуком нічого не знайдено' : 'Будинків поки немає';
    elements.list.append(empty);
    return;
  }
  visible.forEach((house) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `house-card md-state-layer${house.alarmed ? ' is-alarmed' : ''}${house.disconnected ? ' is-disconnected' : ''}`;
    const icon = document.createElement('span');
    icon.className = `house-icon mdi mdi-${house.alarmed ? 'alarm-light-outline' : house.disconnected ? 'wifi-off' : 'home-outline'}`;
    icon.setAttribute('aria-hidden', 'true');
    const copy = document.createElement('span');
    copy.className = 'house-copy';
    const title = document.createElement('strong');
    title.textContent = house.caption || `Будинок ${house.globalId}`;
    const state = document.createElement('small');
    state.textContent = house.alarmed ? 'Тривога' : house.disconnected ? 'Немає зв’язку' : 'Зв’язок у нормі';
    copy.append(title, state);
    const arrow = document.createElement('span');
    arrow.className = 'mdi mdi-chevron-right';
    arrow.setAttribute('aria-hidden', 'true');
    button.append(icon, copy, arrow);
    button.addEventListener('click', () => openEquipment(house.globalId, title.textContent, button));
    elements.list.append(button);
  });
}

function showSnackbar(text) {
  elements.snackbar.textContent = text;
  elements.snackbar.classList.add('open');
  window.setTimeout(() => elements.snackbar.classList.remove('open'), 3200);
}

function openEquipment(id, caption, opener) {
  selectedEquipmentId = id;
  focusReturn = opener;
  elements.title.textContent = caption;
  elements.loading.hidden = false;
  elements.content.hidden = true;
  elements.dialog.classList.add('open');
  elements.dialog.setAttribute('aria-hidden', 'false');
  polling.selectEquipment(id);
  requestAnimationFrame(() => elements.dialog.querySelector('[data-close-equipment]').focus());
}

function closeEquipment() {
  polling.selectEquipment(null);
  selectedEquipmentId = null;
  elements.dialog.classList.remove('open');
  elements.dialog.setAttribute('aria-hidden', 'true');
  if (focusReturn?.isConnected) focusReturn.focus();
  focusReturn = null;
}

function renderEquipment(state) {
  elements.loading.hidden = true;
  elements.content.hidden = false;
  document.getElementById('equipment-updated').textContent = state.updated || 'Час не вказано';
  document.getElementById('equipment-window').textContent = state.currentWindow || 'Основний стан';
  document.getElementById('equipment-alarms').textContent = textFromLegacyHtml(state.avariasAsHtml);
  document.getElementById('equipment-temperature').textContent = textFromLegacyHtml(state.temperatureAsHtml);
  document.getElementById('calls-count').textContent = String(state.calls.length);
  const callsList = document.getElementById('calls-list');
  callsList.replaceChildren();
  if (!state.calls.length) {
    const empty = document.createElement('p');
    empty.className = 'calls-empty';
    empty.textContent = 'Активних викликів немає';
    callsList.append(empty);
  } else {
    state.calls.forEach((call, index) => {
      const item = document.createElement('div');
      item.className = 'call-item';
      item.textContent = Object.values(call).map(String).filter(Boolean).join(' · ') || `Виклик ${index + 1}`;
      callsList.append(item);
    });
  }
}

function openDuConfirm(action) {
  if (!selectedEquipmentId) return;
  pendingDuAction = action;
  document.getElementById('du-confirm-copy').textContent = action === 'On' ? 'Надіслати імпульс увімкнення обладнання?' : 'Надіслати імпульс вимкнення обладнання?';
  elements.duDialog.classList.add('open');
  elements.duDialog.setAttribute('aria-hidden', 'false');
  elements.duDialog.querySelector('[data-du-cancel]').focus();
}

function closeDuConfirm() {
  pendingDuAction = null;
  elements.duDialog.classList.remove('open');
  elements.duDialog.setAttribute('aria-hidden', 'true');
}

const polling = createProminPolling(prominClient, {
  onPultState(state) {
    houses = state.houses;
    elements.help.hidden = true;
    setConnectionState('ok', 'Онлайн');
    updateSummary();
    renderHouses();
  },
  onEquipmentState: renderEquipment,
  onError(error, source) {
    if (source === 'pultState') {
      setConnectionState('error', 'Немає зв’язку');
      elements.help.hidden = false;
    } else {
      elements.loading.textContent = 'Не вдалося отримати стан обладнання';
    }
    console.error(`Promin ${source}:`, error);
  },
});

elements.search.addEventListener('input', renderHouses);
elements.refresh.addEventListener('click', () => void polling.pollPults());
document.querySelector('[data-close-equipment]').addEventListener('click', closeEquipment);
elements.dialog.addEventListener('click', (event) => { if (event.target === elements.dialog) closeEquipment(); });
document.querySelectorAll('[data-du-action]').forEach((button) => button.addEventListener('click', () => openDuConfirm(button.dataset.duAction)));
document.querySelector('[data-du-cancel]').addEventListener('click', closeDuConfirm);
document.querySelector('[data-du-confirm]').addEventListener('click', async (event) => {
  if (!pendingDuAction || !selectedEquipmentId) return;
  const button = event.currentTarget;
  const action = pendingDuAction;
  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  try {
    await prominClient.executeDU(selectedEquipmentId, action);
    closeDuConfirm();
    showSnackbar('Команду виконано');
  } catch (error) {
    showSnackbar('Не вдалося виконати команду');
    console.error('Promin DU:', error);
  } finally {
    button.disabled = false;
    button.removeAttribute('aria-busy');
  }
});
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  if (elements.duDialog.classList.contains('open')) closeDuConfirm();
  else if (elements.dialog.classList.contains('open')) closeEquipment();
});
window.addEventListener('beforeunload', () => polling.stop());

polling.start();
