const tasks = [
  "Crear cuenta en la ticketera oficial y guardar contraseña.",
  "Tener tarjeta habilitada para compras online e internacionales.",
  "Cargar datos personales y de facturación antes de la venta.",
  "Seguir productora local + BTS oficial para cambios de fecha.",
  "Definir presupuesto y sector objetivo para decidir rápido.",
];

const FEED_URL =
  "https://news.google.com/rss/search?q=BTS%20(entradas%20OR%20tickets%20OR%20tour%20OR%20concierto)%20Argentina&hl=es-419&gl=AR&ceid=AR:es-419";
const RSS_PROXY = "https://api.allorigins.win/raw?url=";
const MAX_ALERTS = 12;
const MAX_NEWS = 10;

const checklistContainer = document.querySelector("#checklistContainer");
const notifyBtn = document.querySelector("#notifyBtn");
const testAlertBtn = document.querySelector("#testAlertBtn");
const notifyMsg = document.querySelector("#notifyMsg");
const alertForm = document.querySelector("#alertForm");
const keywordsInput = document.querySelector("#keywordsInput");
const intervalInput = document.querySelector("#intervalInput");
const scanNowBtn = document.querySelector("#scanNowBtn");
const alertStatus = document.querySelector("#alertStatus");
const alertsList = document.querySelector("#alertsList");
const newsList = document.querySelector("#newsList");
const statAlerts = document.querySelector("#statAlerts");
const statNews = document.querySelector("#statNews");
const statTasks = document.querySelector("#statTasks");
const statNextScan = document.querySelector("#statNextScan");

let pollTimer;
let nextScanAt = null;
let latestNews = [];
let alertConfig = loadConfig();

function loadConfig() {
  return {
    keywords:
      JSON.parse(localStorage.getItem("alert-keywords")) || [
        "argentina",
        "buenos aires",
        "entradas",
        "tickets",
        "concierto",
        "show",
        "agenda",
        "fecha",
      ],
    intervalMinutes: Number(localStorage.getItem("alert-interval-mins")) || 10,
    seenIds: JSON.parse(localStorage.getItem("alert-seen-ids")) || [],
    alerts: JSON.parse(localStorage.getItem("alert-items")) || [],
  };
}

function persistConfig() {
  localStorage.setItem("alert-keywords", JSON.stringify(alertConfig.keywords));
  localStorage.setItem("alert-interval-mins", String(alertConfig.intervalMinutes));
  localStorage.setItem("alert-seen-ids", JSON.stringify(alertConfig.seenIds.slice(-100)));
  localStorage.setItem("alert-items", JSON.stringify(alertConfig.alerts.slice(0, MAX_ALERTS)));
}

function getTaskProgress() {
  const done = tasks.reduce((acc, _, idx) => acc + (localStorage.getItem(`task-${idx}`) === "true" ? 1 : 0), 0);
  return `${done}/${tasks.length}`;
}

function renderDashboard() {
  statAlerts.textContent = String(alertConfig.alerts.length);
  statNews.textContent = String(latestNews.length);
  statTasks.textContent = getTaskProgress();
  statNextScan.textContent = nextScanAt ? new Date(nextScanAt).toLocaleTimeString("es-AR") : "-";
}

function renderChecklist() {
  checklistContainer.innerHTML = "";

  tasks.forEach((task, idx) => {
    const wrapper = document.createElement("label");
    wrapper.className = "item";

    const input = document.createElement("input");
    input.type = "checkbox";
    input.id = `task-${idx}`;

    const done = localStorage.getItem(input.id) === "true";
    input.checked = done;

    const text = document.createElement("span");
    text.textContent = task;

    input.addEventListener("change", () => {
      localStorage.setItem(input.id, String(input.checked));
      renderDashboard();
    });

    wrapper.append(input, text);
    checklistContainer.appendChild(wrapper);
  });

  renderDashboard();
}

function renderAlerts() {
  alertsList.innerHTML = "";

  if (!alertConfig.alerts.length) {
    const empty = document.createElement("li");
    empty.textContent = "Sin alertas nuevas por ahora.";
    alertsList.appendChild(empty);
    renderDashboard();
    return;
  }

  alertConfig.alerts.forEach((item) => {
    const li = document.createElement("li");
    li.innerHTML = `<a href="${item.link}" target="_blank" rel="noreferrer">${item.title}</a><small>${item.date}</small>`;
    alertsList.appendChild(li);
  });

  renderDashboard();
}

function renderNews() {
  newsList.innerHTML = "";

  if (!latestNews.length) {
    const empty = document.createElement("li");
    empty.textContent = "Aún no hay noticias cargadas.";
    newsList.appendChild(empty);
    renderDashboard();
    return;
  }

  latestNews.forEach((item) => {
    const li = document.createElement("li");
    li.innerHTML = `<a href="${item.link}" target="_blank" rel="noreferrer">${item.title}</a><small>${item.date}</small>`;
    newsList.appendChild(li);
  });

  renderDashboard();
}

function updateStatus(message) {
  alertStatus.textContent = `Estado: ${message}`;
}

async function requestNotificationPermission() {
  if (!("Notification" in window)) {
    notifyMsg.textContent = "Tu navegador no soporta notificaciones.";
    return false;
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    notifyMsg.textContent = "No se habilitaron notificaciones. Igual verás alertas en pantalla.";
    return false;
  }

  localStorage.setItem("bts-alert-mode", "true");
  notifyMsg.textContent = "Notificaciones activadas 💜";
  return true;
}

function pushBrowserNotification(item) {
  if (!("Notification" in window) || Notification.permission !== "granted") {
    return;
  }

  new Notification("Nueva alerta BTS para Argentina", {
    body: item.title,
  });
}

function normalizeText(text) {
  return text.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

function matchesKeywords(text) {
  const normalized = normalizeText(text);
  return alertConfig.keywords.some((word) => normalized.includes(normalizeText(word.trim())));
}

async function fetchFeedItems() {
  const url = `${RSS_PROXY}${encodeURIComponent(FEED_URL)}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Error HTTP ${response.status}`);
  }

  const xmlText = await response.text();
  const parser = new DOMParser();
  const xml = parser.parseFromString(xmlText, "application/xml");

  return [...xml.querySelectorAll("item")].map((item) => ({
    id: item.querySelector("guid")?.textContent || item.querySelector("link")?.textContent,
    title: item.querySelector("title")?.textContent || "Sin título",
    link: item.querySelector("link")?.textContent || "#",
    date: item.querySelector("pubDate")?.textContent || "Fecha desconocida",
  }));
}

async function scanForAlerts({ manual = false } = {}) {
  try {
    updateStatus("escaneando novedades...");
    const items = await fetchFeedItems();

    latestNews = items.slice(0, MAX_NEWS).map((item) => ({
      ...item,
      date: new Date(item.date).toLocaleString("es-AR"),
    }));
    renderNews();

    const newMatches = items.filter((item) => {
      if (!item.id || alertConfig.seenIds.includes(item.id)) {
        return false;
      }
      return matchesKeywords(item.title);
    });

    items.forEach((item) => {
      if (item.id) {
        alertConfig.seenIds.push(item.id);
      }
    });

    if (newMatches.length) {
      const formatted = newMatches.map((item) => ({
        ...item,
        date: new Date(item.date).toLocaleString("es-AR"),
      }));

      alertConfig.alerts = [...formatted, ...alertConfig.alerts].slice(0, MAX_ALERTS);
      renderAlerts();
      persistConfig();
      updateStatus(`¡${newMatches.length} alerta(s) nueva(s)!`);
      pushBrowserNotification(formatted[0]);
      notifyMsg.textContent = "Se detectaron novedades para Argentina 💜";
      return;
    }

    persistConfig();
    renderAlerts();
    updateStatus(manual ? "sin novedades nuevas en este escaneo." : "monitor activo, sin novedades nuevas.");
  } catch (error) {
    console.error(error);
    updateStatus("no se pudo consultar el feed (reintentando automáticamente).");
  }
}

function schedulePolling() {
  clearInterval(pollTimer);
  nextScanAt = Date.now() + alertConfig.intervalMinutes * 60 * 1000;
  renderDashboard();

  pollTimer = setInterval(() => {
    nextScanAt = Date.now() + alertConfig.intervalMinutes * 60 * 1000;
    renderDashboard();
    scanForAlerts();
  }, alertConfig.intervalMinutes * 60 * 1000);
}

function bootstrapForm() {
  keywordsInput.value = alertConfig.keywords.join(",");
  intervalInput.value = String(alertConfig.intervalMinutes);

  alertForm.addEventListener("submit", (event) => {
    event.preventDefault();

    alertConfig.keywords = keywordsInput.value
      .split(",")
      .map((word) => word.trim())
      .filter(Boolean);

    alertConfig.intervalMinutes = Math.min(60, Math.max(1, Number(intervalInput.value) || 10));
    intervalInput.value = String(alertConfig.intervalMinutes);

    persistConfig();
    schedulePolling();
    updateStatus("configuración guardada. monitor reiniciado.");
    scanForAlerts({ manual: true });
  });
}

notifyBtn.addEventListener("click", requestNotificationPermission);

testAlertBtn.addEventListener("click", () => {
  const mock = {
    title: "[Prueba] Aviso de entradas BTS Argentina",
    link: "https://weverse.io",
    date: new Date().toLocaleString("es-AR"),
  };

  alertConfig.alerts = [mock, ...alertConfig.alerts].slice(0, MAX_ALERTS);
  renderAlerts();
  persistConfig();
  notifyMsg.textContent = "Alerta de prueba enviada.";
  pushBrowserNotification(mock);
});

scanNowBtn.addEventListener("click", () => scanForAlerts({ manual: true }));

if (localStorage.getItem("bts-alert-mode") === "true") {
  notifyMsg.textContent = "Modo notificaciones guardado para este navegador.";
}

renderChecklist();
bootstrapForm();
renderAlerts();
renderNews();
schedulePolling();
scanForAlerts({ manual: true });
