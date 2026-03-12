const tasks = [
  "Crear cuenta en la ticketera oficial y guardar contraseña.",
  "Tener tarjeta habilitada para compras online e internacionales.",
  "Cargar datos personales y de facturación antes de la venta.",
  "Seguir productora local + BTS oficial para cambios de fecha.",
  "Definir presupuesto y sector objetivo para decidir rápido.",
];

const checklistContainer = document.querySelector("#checklist");
const notifyBtn = document.querySelector("#notifyBtn");
const notifyMsg = document.querySelector("#notifyMsg");

function renderChecklist() {
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
    });

    wrapper.append(input, text);
    checklistContainer.appendChild(wrapper);
  });
}

notifyBtn.addEventListener("click", () => {
  localStorage.setItem("bts-alert-mode", "true");
  notifyMsg.textContent = "Listo 💜 Modo alerta activado. Revisá este panel todos los días.";
});

if (localStorage.getItem("bts-alert-mode") === "true") {
  notifyMsg.textContent = "Ya tenés el modo alerta activado.";
}

renderChecklist();
