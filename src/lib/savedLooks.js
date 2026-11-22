// Saved looks live in this browser only (localStorage). Nothing is sent anywhere.
const KEY = "lash-tryon:looks:v1";

export function loadLooks() {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function storeLooks(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, 20)));
    return true;
  } catch {
    return false; // private mode or storage full: the list still works until the page closes
  }
}
