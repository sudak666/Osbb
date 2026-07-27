const FIREBASE_API_KEY = process.env.SMENA_FIREBASE_API_KEY || 'AIzaSyAOhfHBOVExBXQDZeIQZq2jWAQoHK2ElBw';
const FIREBASE_PROJECT_ID = process.env.SMENA_FIREBASE_PROJECT_ID || 'smena-s777s';
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vkwkyhjjjmcpmiakxohw.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Вкажіть SUPABASE_SERVICE_ROLE_KEY для імпорту змін.');
  process.exit(1);
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  if (!response.ok) throw new Error(`${response.status}: ${text || response.statusText}`);
  return text ? JSON.parse(text) : null;
}

function firestoreValue(value) {
  if (!value || typeof value !== 'object') return null;
  if ('stringValue' in value) return value.stringValue;
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(firestoreValue).filter(item => typeof item === 'string');
  return null;
}

const auth = await requestJson(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${encodeURIComponent(FIREBASE_API_KEY)}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ returnSecureToken: true }),
});

const firestore = await requestJson(`https://firestore.googleapis.com/v1/projects/${encodeURIComponent(FIREBASE_PROJECT_ID)}/databases/(default)/documents/shifts?pageSize=366`, {
  headers: { Authorization: `Bearer ${auth.idToken}` },
});

const rows = (firestore.documents || []).map(document => {
  const shiftDate = document.name.split('/').pop();
  return {
    shift_date: shiftDate,
    month_key: shiftDate.slice(0, 7),
    sergiy: firestoreValue(document.fields?.sergiy) || [],
    oleksandr: firestoreValue(document.fields?.oleksandr) || [],
    updated_at: document.updateTime || new Date().toISOString(),
  };
}).filter(row => /^\d{4}-\d{2}-\d{2}$/.test(row.shift_date));

if (!rows.length) {
  console.log('У Firebase немає ручних корекцій графіка для імпорту.');
  process.exit(0);
}

await requestJson(`${SUPABASE_URL}/rest/v1/work_shifts?on_conflict=shift_date`, {
  method: 'POST',
  headers: {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
    Prefer: 'resolution=merge-duplicates,return=minimal',
  },
  body: JSON.stringify(rows),
});

console.log(`Імпортовано записів графіка: ${rows.length}`);
