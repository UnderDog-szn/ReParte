/* ReParte · frontend de la simulación (JavaScript sin dependencias, consume la API REST). */
"use strict";

const API = "/api";
const CLAVE_DEMO = "ReParte2026!";
const DEMO = [
  { grupo: "Donante", email: "elahorro@reparte.test", nombre: "Supermercado El Ahorro" },
  { grupo: "Donante", email: "laeconomia@reparte.test", nombre: "Supermercado La Economía (Valledupar)" },
  { grupo: "Receptor", email: "almendros@reparte.test", nombre: "Comedor Los Almendros" },
  { grupo: "Receptor", email: "manosqueayudan@reparte.test", nombre: "Fundación Manos que Ayudan" },
  { grupo: "Receptor", email: "laesperanza@reparte.test", nombre: "Hogar de Paso La Esperanza" },
  { grupo: "Voluntario", email: "vol.andres@reparte.test", nombre: "Andrés · moto" },
  { grupo: "Voluntario", email: "vol.laura@reparte.test", nombre: "Laura · carro con cava de frío" },
];

/* ---------------- utilidades ---------------- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const fmt = {
  kg: (v) => `${Number(v || 0).toLocaleString("es-CO", { maximumFractionDigits: 1 })} kg`,
  num: (v) => Number(v || 0).toLocaleString("es-CO", { maximumFractionDigits: 0 }),
  fecha: (v) => (v ? new Date(v).toLocaleString("es-CO", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "—"),
  hora: (v) => (v ? new Date(v).toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" }) : "—"),
  dia: (v) => new Date(v).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" }),
  mes: (v) => new Date(`${v}-15`).toLocaleDateString("es-CO", { month: "short" }).replace(".", ""),
  relativo(v) {
    const s = (new Date(v) - Date.now()) / 1000, a = Math.abs(s);
    const t = a < 60 ? "un momento" : a < 3600 ? `${Math.round(a / 60)} min` : a < 86400 ? `${Math.round(a / 3600)} h` : `${Math.round(a / 86400)} días`;
    return s >= 0 ? `en ${t}` : `hace ${t}`;
  },
  mmss: (seg) => `${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, "0")}`,
};
const pad = (n) => String(n).padStart(2, "0");
const sumarMin = (d, m) => new Date(d.getTime() + m * 60000);
const local = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const iso = (s) => new Date(s).toISOString();

const ICONOS = {
  inicio: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  mas: '<path d="M12 5v14M5 12h14"/>',
  lista: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  grafico: '<path d="M3 3v18h18"/><path d="M7 15v3M12 10v8M17 6v12"/>',
  campana: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  mapa: '<path d="M9 3 3 6v15l6-3 6 3 6-3V3l-6 3z"/><path d="M9 3v15M15 6v15"/>',
  camion: '<path d="M3 6h11v10H3zM14 9h4l3 3v4h-7z"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  caja: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/>',
  salir: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  edificio: '<path d="M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16M16 9h2a2 2 0 0 1 2 2v10M2 21h20M8 7h4M8 11h4M8 15h4"/>',
  reloj: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  medalla: '<circle cx="12" cy="9" r="6"/><path d="m8.5 14-1.5 7 5-3 5 3-1.5-7"/>',
  atras: '<path d="M15 18l-6-6 6-6"/>',
  copo: '<path d="M12 2v20M4.9 4.9l14.2 14.2M2 12h20M4.9 19.1 19.1 4.9"/>',
  pin: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  alerta: '<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
  manzana: '<path d="M12 7.5c-1.6-1.4-5-1.6-6.4.6-1.3 2-.9 6.6 1.4 10 1.4 2 3 2.4 5 1.4 2 1 3.6.6 5-1.4 2.3-3.4 2.7-8 1.4-10-1.4-2.2-4.8-2-6.4-.6z"/><path d="M12 7.5c0-2 1-3.6 3-4.5"/>',
  pan: '<path d="M4.5 12.5A4 4 0 0 1 7 5.5h10a4 4 0 0 1 2.5 7V18a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2z"/><path d="M9.5 10v6M14.5 10v6"/>',
  botella: '<path d="M9.5 2h5v3l2 3v12a2 2 0 0 1-2 2h-5a2 2 0 0 1-2-2V8l2-3z"/><path d="M7.5 12h9"/>',
  carne: '<path d="M14.5 3.5a5.5 5.5 0 0 1 2 9.2l-3.8 3.8-5.2-5.2 3.8-3.8a5.5 5.5 0 0 1 3.2-4z"/><path d="m7.5 11.3-2.3 2.3M10 16.5l-2.3 2.3M4 17l3 3"/>',
  trigo: '<path d="M12 22V9"/><path d="M12 9c-2.2-.8-3.4-2.8-3.4-5 2.2 0 3.4 1.8 3.4 3.4 0-1.6 1.2-3.4 3.4-3.4 0 2.2-1.2 4.2-3.4 5zM12 14.5c-2.2-.8-3.4-2.6-3.4-4.6M12 14.5c2.2-.8 3.4-2.6 3.4-4.6M12 19.5c-2.2-.8-3.4-2.6-3.4-4.6M12 19.5c2.2-.8 3.4-2.6 3.4-4.6"/>',
  lata: '<ellipse cx="12" cy="5" rx="6" ry="2"/><path d="M6 5v14c0 1.1 2.7 2 6 2s6-.9 6-2V5M6 10h12M6 15h12"/>',
  olla: '<path d="M3.5 11h17a8.5 8.5 0 0 1-17 0z"/><path d="M8 7.5c0-1 1-1.5 1-2.5M12 7.5c0-1 1-1.5 1-2.5M16 7.5c0-1 1-1.5 1-2.5"/>',
  vaso: '<path d="M6.5 4h11l-1.2 15.2a2 2 0 0 1-2 1.8H9.7a2 2 0 0 1-2-1.8z"/><path d="M7.2 9h9.6"/>',
  tienda: '<path d="M3 9.5 4.5 4h15L21 9.5a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0z"/><path d="M5 12v8h14v-8M10 20v-5h4v5"/>',
  bici: '<circle cx="6" cy="17" r="3.5"/><circle cx="18" cy="17" r="3.5"/><path d="M6 17l4-8h5l3 8M9 6h3M14.5 9 12 17"/>',
  estrella: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
  descargar: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
  repetir: '<path d="M17 2l3 3-3 3"/><path d="M4 11V9a4 4 0 0 1 4-4h12M7 22l-3-3 3-3"/><path d="M20 13v2a4 4 0 0 1-4 4H4"/>',
  camara: '<path d="M4 7h3l2-3h6l2 3h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="4"/>',
  documento: '<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5M8.5 13h7M8.5 17h5"/>',
  lapiz: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  cesta: '<path d="M4 10h16l-1.6 9.2a2 2 0 0 1-2 1.8H7.6a2 2 0 0 1-2-1.8z"/><path d="m9 10 3-6 3 6"/>',
  ruta: '<circle cx="6" cy="19" r="2"/><circle cx="18" cy="5" r="2"/><path d="M8 19h8.5a3.5 3.5 0 0 0 0-7h-9a3.5 3.5 0 0 1 0-7H16"/>',
  candado: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
};
const icono = (n, cls = "") => `<svg class="icono ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONOS[n] || ""}</svg>`;
const logo = (t = 32) => `<svg width="${t}" height="${t}" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="10" fill="#2E8B57"/><path d="M8.5 21c0-7 5-11.5 14-12-1 9.5-5.5 14-11.5 14" fill="#FFF8EF" stroke="#FFF8EF" stroke-width="1.5" stroke-linejoin="round"/><path d="M10 23c3-4.5 6-7 9.5-9" fill="none" stroke="#2E8B57" stroke-width="2" stroke-linecap="round"/><circle cx="24" cy="23" r="4" fill="#F4A261"/></svg>`;

const ESTADOS = {
  PUBLICADA: ["Publicada", "info"], ASIGNADA: ["Asignada", "sol"], EN_RECOGIDA: ["En recogida", "violeta"],
  EN_TRANSITO: ["En tránsito", "violeta"], ENTREGADA: ["Entregada", "exito"], CANCELADA: ["Cancelada", "gris"],
  VENCIDA: ["Vencida", "gris"], SUGERIDA: ["Por aceptar", "acento"], ACEPTADA: ["Aceptada", "exito"],
  RECHAZADA: ["Rechazada", "gris"], EXPIRADA: ["Sin respuesta", "gris"], DISPONIBLE: ["Disponible", "info"],
  TOMADA: ["Tomada", "violeta"], RECOGIDA: ["Recogida", "violeta"],
};
const chip = (e) => { const [t, c] = ESTADOS[e] || [e, "gris"]; return `<span class="chip chip-${c}">${esc(t)}</span>`; };
const estadoTexto = (e) => (ESTADOS[e] ? ESTADOS[e][0] : e);
const ACTIVOS = ["PUBLICADA", "ASIGNADA", "EN_RECOGIDA", "EN_TRANSITO"];

/* ---------------- sesión y API ---------------- */
const sesion = {
  leer: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  get access() { return this.leer("rp_access"); },
  get refresh() { return this.leer("rp_refresh"); },
  guardar(a, r) { try { localStorage.setItem("rp_access", a); if (r) localStorage.setItem("rp_refresh", r); } catch { /* sin almacenamiento */ } },
  cerrar() { try { localStorage.removeItem("rp_access"); localStorage.removeItem("rp_refresh"); } catch { /* nada */ } },
};
let YO = null;

class ErrorApi extends Error {
  constructor(status, data) { super(mensajeError(data)); this.status = status; this.data = data; }
}
function mensajeError(data) {
  if (!data) return "Ocurrió un error inesperado.";
  const d = data.detalle ?? data.detail ?? data;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.join(" ");
  if (typeof d === "object") return Object.values(d).flat().join(" ");
  return "Ocurrió un error.";
}
async function api(ruta, { metodo = "GET", datos, reintento = true } = {}) {
  const headers = { Accept: "application/json" };
  const esForm = datos instanceof FormData;
  if (datos !== undefined && !esForm) headers["Content-Type"] = "application/json";
  if (sesion.access) headers.Authorization = `Bearer ${sesion.access}`;
  let r;
  try {
    r = await fetch(API + ruta, { method: metodo, headers, body: datos === undefined ? undefined : esForm ? datos : JSON.stringify(datos) });
  } catch {
    throw new ErrorApi(0, { detalle: "No hay conexión con el servidor. ¿Está corriendo runserver?" });
  }
  if (r.status === 401 && reintento && sesion.refresh) {
    const rr = await fetch(`${API}/auth/token/renovar/`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refresh: sesion.refresh }) });
    if (rr.ok) { const j = await rr.json(); sesion.guardar(j.access, j.refresh); return api(ruta, { metodo, datos, reintento: false }); }
    salir();
    throw new ErrorApi(401, { detalle: "Tu sesión expiró. Ingresa de nuevo." });
  }
  const texto = await r.text();
  let data = null;
  try { data = texto ? JSON.parse(texto) : null; } catch { data = { detalle: `Error ${r.status} del servidor.` }; }
  if (!r.ok) throw new ErrorApi(r.status, data);
  return data;
}
const resultados = (d) => (Array.isArray(d) ? d : d?.results || []);

/** Descarga un archivo protegido (PDF, Excel) usando el token. */
async function descargar(ruta, nombre) {
  const r = await fetch(API + ruta, { headers: { Authorization: `Bearer ${sesion.access}` } });
  if (!r.ok) { let d = null; try { d = await r.json(); } catch { /* binario */ } throw new ErrorApi(r.status, d); }
  const url = URL.createObjectURL(await r.blob());
  const a = Object.assign(document.createElement("a"), { href: url, download: nombre });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** Reduce una foto en el navegador (máx. 1600 px, JPEG) antes de subirla. */
function comprimirFoto(archivo, max = 1600) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = Object.assign(document.createElement("canvas"), { width: Math.round(img.width * k), height: Math.round(img.height * k) });
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      c.toBlob((b) => (b ? res(new File([b], (archivo.name || "foto").replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" })) : rej(new Error("No se pudo procesar la foto"))), "image/jpeg", 0.82);
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => rej(new Error("El archivo no es una imagen válida"));
    img.src = URL.createObjectURL(archivo);
  });
}
async function subirFoto(donacionId, archivo, etapa) {
  const fd = new FormData();
  fd.append("imagen", await comprimirFoto(archivo));
  fd.append("etapa", etapa);
  return api(`/donaciones/${donacionId}/fotos/`, { metodo: "POST", datos: fd });
}

/* ---------- visual por categoría (ícono + color) ---------- */
const CATEGORIAS_VISUAL = {
  "Frutas y verduras": ["manzana", "#FDE2D6", "#C2502E"], "Panadería": ["pan", "#FFF0C9", "#A8730A"], "Lácteos": ["botella", "#E1F0FA", "#2F7DB3"],
  "Carnes y pescados": ["carne", "#FCE1E4", "#B8435A"], "Granos y cereales": ["trigo", "#F7EBD3", "#9A6B1F"], "Enlatados": ["lata", "#EFE8FB", "#6E4FB0"],
  "Comidas preparadas": ["olla", "#FDE6CF", "#C25F1A"], "Bebidas": ["vaso", "#DDF4EC", "#2C8A68"],
};
/** Devuelve [ícono HTML, color de fondo] de la categoría. */
const catVisual = (nombre) => {
  const [ic, fondo, trazo] = CATEGORIAS_VISUAL[nombre] || ["cesta", "#FFF4D6", "#A8730A"];
  return [`<span class="cat-icono" style="color:${trazo}">${icono(ic)}</span>`, fondo];
};
function miniatura(d, clase = "miniatura") {
  const [ic, fondo] = catVisual(d.categoria);
  return d.foto ? `<div class="${clase}"><img src="${esc(d.foto)}" alt="Foto de ${esc(d.descripcion)}" loading="lazy"></div>`
    : `<div class="${clase}" style="background:${fondo}" aria-hidden="true">${ic}</div>`;
}
const estrellas = (n) => `<span class="estrellas-fijas" aria-label="${n} de 5">${"★".repeat(n)}<span style="color:#E6DCCF">${"★".repeat(5 - n)}</span></span>`;

/* ---------------- componentes ---------------- */
function aviso(msg, tipo = "ok") {
  const t = document.createElement("div");
  t.className = `toast toast-${tipo}`;
  t.textContent = msg;
  $("#toasts").append(t);
  setTimeout(() => t.classList.add("salida"), 3500);
  setTimeout(() => t.remove(), 3900);
}
function modal({ titulo, cuerpo = "", confirmar = "Confirmar", peligro = false }) {
  return new Promise((res) => {
    const m = document.createElement("div");
    m.className = "modal-fondo";
    m.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-label="${esc(titulo)}"><h2>${esc(titulo)}</h2>${cuerpo}
      <div class="modal-acciones"><button class="btn btn-secundario" data-r="no" type="button">Volver</button>
      <button class="btn ${peligro ? "btn-peligro" : "btn-primario"}" data-r="si" type="button">${esc(confirmar)}</button></div></div>`;
    document.body.append(m);
    const cerrar = (ok) => {
      const campos = Object.fromEntries($$("input,textarea,select", m).map((i) => [i.name, i.value]));
      m.remove(); res(ok ? campos : null);
    };
    m.addEventListener("click", (e) => { if (e.target === m) cerrar(false); const b = e.target.closest("[data-r]"); if (b) cerrar(b.dataset.r === "si"); });
    m.addEventListener("keydown", (e) => { if (e.key === "Escape") cerrar(false); });
    ($("input,textarea", m) || $("[data-r=si]", m)).focus();
  });
}
const campo = (nombre, etiqueta, tipo, valor = "", ph = "", extra = "") => `
  <div class="campo" data-campo="${nombre}"><label for="c-${nombre}">${esc(etiqueta)}</label>
  <input id="c-${nombre}" name="${nombre}" type="${tipo}" value="${esc(valor)}" placeholder="${esc(ph)}" ${extra}>
  <p class="error-campo" id="e-${nombre}"></p></div>`;
const vacio = (ic, t, txt, accion = "") => `<div class="vacio"><span class="vacio-icono">${icono(ic)}</span><h3>${esc(t)}</h3><p>${esc(txt)}</p>${accion}</div>`;
const esqueleto = () => `<div class="esqueleto"><div></div><div></div><div></div></div>`;
const estadoError = (e) => vacio("alerta", "No se pudo cargar", e.message, `<button class="btn btn-secundario" id="reintentar">Reintentar</button>`);
function errorEnCampos(form, e) {
  $$(".error-campo", form).forEach((p) => (p.textContent = ""));
  $$(".campo", form).forEach((c) => c.classList.remove("invalido"));
  const d = e.data?.detalle;
  if (e.status === 400 && d && typeof d === "object") {
    let alguno = false;
    for (const [k, v] of Object.entries(d)) {
      const p = $(`#e-${k}`, form);
      if (p) { p.textContent = [].concat(v).join(" "); p.closest(".campo")?.classList.add("invalido"); alguno = true; }
    }
    if (alguno) return;
  }
  aviso(e.message, "error");
}
async function conCarga(boton, fn) {
  const txt = boton.innerHTML;
  boton.disabled = true; boton.textContent = "Un momento…";
  try { return await fn(); } finally { if (boton.isConnected) { boton.disabled = false; boton.innerHTML = txt; } }
}
const stepper = (actual, nombres) => `<div class="stepper" aria-label="Paso ${actual} de ${nombres.length}">${nombres.map((n, i) => {
  const k = i + 1, cls = k < actual ? "hecho" : k === actual ? "actual" : "";
  return `${i ? `<div class="linea ${k <= actual ? "hecha" : ""}"></div>` : ""}<div class="paso ${cls}"><span class="n">${k < actual ? icono("check") : k}</span><span>${esc(n)}</span></div>`;
}).join("")}</div>`;
const enlaceMapa = (lat, lon) => `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=17/${lat}/${lon}`;

function tarjetaDonacion(d) {
  const frio = d.condicion !== "AMBIENTE";
  const otro = YO.rol === "DONANTE" ? (d.receptor ? `Para ${d.receptor.razon_social}` : "") : `De ${d.donante.razon_social}`;
  return `<a class="tarjeta tarjeta-donacion" href="#/donacion/${d.id}">
    ${miniatura(d)}
    <div class="td-cuerpo">
      <strong>${esc(d.descripcion)}</strong>
      <div class="td-meta">${esc(d.codigo)} · ${fmt.kg(d.peso_estimado_kg)} · ${esc(d.categoria)}${frio ? "· ": ""}</div>
      ${otro ? `<div class="td-meta">${esc(otro)}</div>` : ""}
      <div class="td-fila">${chip(d.estado)}${ACTIVOS.includes(d.estado) ? `<span class="td-vence">Apto hasta ${fmt.fecha(d.fecha_limite_consumo)}</span>` : ""}</div>
      ${d.codigo_entrega && ACTIVOS.includes(d.estado) ? `<div class="codigo-entrega">Código de entrega <b>${esc(d.codigo_entrega)}</b></div>` : ""}
    </div></a>`;
}

/* ---------------- marco y navegación ---------------- */
const MENUS = {
  // [ruta, texto del menú lateral, ícono, texto corto para la barra inferior del celular]
  // el quinto valor (true) indica una ruta permitida que no aparece en el menú
  DONANTE: [["inicio", "Inicio", "inicio", "Inicio"], ["publicar", "Publicar", "mas", "Publicar"], ["donaciones", "Donaciones", "lista", "Donaciones"], ["impacto", "Impacto", "grafico", "Impacto"], ["certificados", "Certificados", "medalla", "Certificados"],
    ["recurrentes", "Automáticas", "reloj", "", true], ["ranking", "Ranking", "medalla", "", true]],
  RECEPTOR: [["pendientes", "Por aceptar", "reloj", "Aceptar"], ["disponibles", "Elegir excedentes", "cesta", "Elegir"], ["recibidas", "Recibidas", "caja", "Recibidas"], ["organizacion", "Mi organización", "edificio", "Perfil"], ["impacto", "Impacto", "grafico", "Impacto"],
    ["ranking", "Ranking", "medalla", "", true]],
  VOLUNTARIO: [["cerca", "Cerca de mí", "pin", "Cerca"], ["activa", "Mi recogida", "camion", "Recogida"], ["historial", "Historial", "lista", "Historial"], ["ranking", "Ranking", "medalla", "Ranking"], ["impacto", "Impacto", "grafico", "Impacto"]],
  ADMIN: [["panel", "Panel", "grafico", "Panel"], ["verificaciones", "Verificaciones", "edificio", "Verificar"], ["todas", "Donaciones", "lista", "Donaciones"], ["mapa", "Mapa", "mapa", "Mapa"], ["ranking", "Ranking", "medalla", "Ranking"]],
};
const ROL_TEXTO = { DONANTE: "Donante", RECEPTOR: "Receptor", VOLUNTARIO: "Voluntario", ADMIN: "Administrador" };
const rutasRol = () => MENUS[YO.rol] || MENUS.ADMIN;
const menu = () => rutasRol().filter((m) => !m[4]);
const nombreVisible = () => YO.organizacion?.razon_social || YO.nombre || YO.email;

function marco() {
  const items = menu();
  $("#app").innerHTML = `<div class="marco">
    <aside class="lateral">
      <div class="marca">${logo()}<span>ReParte</span></div>
      <nav class="nav-lateral" aria-label="Menú">${items.map(([r, t, i]) => `<a href="#/${r}" data-ruta="${r}">${icono(i)}<span>${t}</span></a>`).join("")}</nav>
      <div class="lateral-pie"><div class="usuario-mini"><strong>${esc(nombreVisible())}</strong><span>${ROL_TEXTO[YO.rol] || ""}${YO.region ? ` · ${esc(YO.region.nombre)}` : ""}</span></div>
      <button class="btn-fantasma boton-instalar" data-instalar type="button">${icono("descargar")} Instalar app</button>
      <button class="btn-fantasma" data-salir type="button">${icono("salir")} Salir</button></div>
    </aside>
    <header class="barra"><div class="marca marca-movil">${logo(28)}</div><h1 id="titulo" class="barra-titulo"></h1>
      <button class="btn-icono solo-movil boton-instalar" data-instalar type="button" aria-label="Instalar app">${icono("descargar")}</button>
      <a href="#/notificaciones" class="campana" aria-label="Notificaciones">${icono("campana")}<span id="badge" class="badge" hidden></span></a>
      <button class="btn-icono solo-movil" data-salir type="button" aria-label="Salir">${icono("salir")}</button></header>
    <main id="vista" class="vista"></main>
    <nav class="nav-inferior" aria-label="Menú">${items.map(([r, , i, corto]) => `<a href="#/${r}" data-ruta="${r}">${icono(i)}<span>${corto}</span></a>`).join("")}</nav>
  </div>`;
  $$("[data-salir]").forEach((b) => b.addEventListener("click", salir));
  $$("[data-instalar]").forEach((b) => b.addEventListener("click", instalarApp));
  mostrarInstalar();
}

/* ---------- PWA ---------- */
let eventoInstalar = null;
window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); eventoInstalar = e; mostrarInstalar(); });
window.addEventListener("appinstalled", () => { eventoInstalar = null; mostrarInstalar(); aviso("¡ReParte quedó instalada!"); });
function mostrarInstalar() { $$("[data-instalar]").forEach((b) => b.classList.toggle("visible", !!eventoInstalar)); }
async function instalarApp() { if (!eventoInstalar) return; eventoInstalar.prompt(); await eventoInstalar.userChoice; eventoInstalar = null; mostrarInstalar(); }
if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
function titulo(t) { const h = $("#titulo"); if (h) h.textContent = t; document.title = `${t} · ReParte`; }

let temporizadores = [];
let mapaActual = null;
let observadores = [];
function limpiar() {
  temporizadores.forEach(clearInterval); temporizadores = [];
  observadores.forEach((id) => navigator.geolocation?.clearWatch(id)); observadores = [];
  if (mapaActual) { mapaActual.remove(); mapaActual = null; }
}
const RUTAS_COMUNES = ["donacion", "notificaciones"];
const organizacionPendiente = () => YO.organizacion && YO.organizacion.estado_verificacion !== "VERIFICADA";

async function navegar() {
  if (!YO) return;
  if (organizacionPendiente()) { vEspera(); return; }
  const [ruta, param] = location.hash.replace(/^#\/?/, "").split("/");
  const permitidas = rutasRol().map((m) => m[0]).concat(RUTAS_COMUNES);
  if (!RUTAS[ruta] || !permitidas.includes(ruta)) { location.replace(`#/${menu()[0][0]}`); return; }
  limpiar();
  $$("[data-ruta]").forEach((a) => a.classList.toggle("activo", a.dataset.ruta === ruta));
  const vista = $("#vista");
  vista.innerHTML = esqueleto();
  window.scrollTo(0, 0);
  try { await RUTAS[ruta](vista, param); } catch (e) {
    if (e.status === 401) return;
    vista.innerHTML = estadoError(e);
    $("#reintentar")?.addEventListener("click", navegar);
  }
  actualizarBadge();
}
async function actualizarBadge() {
  try {
    YO = await api("/auth/yo/");
    const b = $("#badge"); if (!b) return;
    const n = YO.notificaciones_sin_leer;
    b.hidden = !n; b.textContent = n > 9 ? "9+" : n;
  } catch { /* se ignora */ }
}
function salir() { limpiar(); sesion.cerrar(); YO = null; history.replaceState(null, "", "/"); vLogin(); }

/* ================= LOGIN, REGISTRO Y ESPERA ================= */
function vLogin() {
  document.title = "Ingresar · ReParte";
  const grupos = [...new Set(DEMO.map((d) => d.grupo))];
  const EMO = { Donante: "", Receptor: "", Voluntario: "" };
  $("#app").innerHTML = `<div class="login">
    <div class="login-marca">${logo(64)}<h1>ReParte</h1><p>Excedentes de alimentos que llegan a quien los necesita</p>
</div>
    <form class="tarjeta login-form" id="f-login" novalidate>
      <h2>Ingresar</h2>
      ${campo("email", "Correo", "email", "", "tu@correo.com", 'autocomplete="username" required')}
      ${campo("password", "Contraseña", "password", "", "", 'autocomplete="current-password" required')}
      <p class="error-campo" id="e-general" role="alert"></p>
      <button class="btn btn-primario btn-bloque" type="submit">Ingresar</button>
      <p class="ayuda" style="text-align:center;margin-top:14px">¿Primera vez? <a href="#/registro" id="ir-registro">Crea tu cuenta</a></p>
    </form>
    <section class="demo"><h3>Usuarios de prueba</h3>
      <p class="ayuda">Toca uno para entrar. Clave de todos: <code>${CLAVE_DEMO}</code>. El administrador es tu superusuario.</p>
      ${grupos.map((g) => `<div class="demo-lista"><p class="ayuda"><b>${EMO[g] || ""} ${g}</b></p>${DEMO.filter((d) => d.grupo === g).map((d) =>
        `<button class="demo-btn" type="button" data-email="${d.email}"><strong>${esc(d.nombre)}</strong><span>${esc(d.email.split("@")[0])}</span></button>`).join("")}</div>`).join("")}
    </section></div>`;
  const f = $("#f-login");
  $("#ir-registro").addEventListener("click", (e) => { e.preventDefault(); vRegistro(); });
  f.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = f.email.value.trim(), password = f.password.value;
    if (!email || !password) { $("#e-general").textContent = "Escribe tu correo y contraseña."; return; }
    await conCarga($("button[type=submit]", f), async () => {
      try { await entrar(email, password); }
      catch (err) { $("#e-general").textContent = err.status === 401 ? "Correo o contraseña incorrectos." : err.message; }
    });
  });
  $$(".demo-btn").forEach((b) => b.addEventListener("click", () => {
    f.email.value = b.dataset.email; f.password.value = CLAVE_DEMO; f.requestSubmit();
  }));
}
async function entrar(email, password) {
  sesion.cerrar();
  const t = await api("/auth/token/", { metodo: "POST", datos: { email, password }, reintento: false });
  sesion.guardar(t.access, t.refresh);
  YO = await api("/auth/yo/");
  if (organizacionPendiente()) { vEspera(); return; }
  marco();
  if (!location.hash || location.hash === "#/" || location.hash === "#/registro") location.hash = `#/${menu()[0][0]}`; else navegar();
}

function vEspera() {
  const o = YO.organizacion, rechazada = o.estado_verificacion === "RECHAZADA";
  document.title = "Verificación · ReParte";
  $("#app").innerHTML = `<div class="espera">${logo(56)}<span class="grande">${icono(rechazada ? "alerta" : "reloj")}</span>
    <h1 style="font-size:26px">${rechazada ? "Tu registro no fue aprobado" : "¡Registro recibido!"}</h1>
    <p class="ayuda" style="font-size:16px">${rechazada ? `Motivo: ${esc(o.motivo_rechazo || "no indicado")}. Escríbenos para revisarlo.`
      : `Estamos verificando a <b>${esc(o.razon_social)}</b>. Te avisaremos cuando puedas empezar a ${o.tipo === "DONANTE" ? "publicar excedentes" : "recibir donaciones"}.`}</p>
    <div class="td-fila" style="justify-content:center"><button class="btn btn-secundario" id="revisar" type="button">Revisar de nuevo</button>
    <button class="btn btn-fantasma" data-salir type="button">${icono("salir")} Salir</button></div></div>`;
  $("[data-salir]").addEventListener("click", salir);
  $("#revisar").addEventListener("click", async () => { YO = await api("/auth/yo/"); if (organizacionPendiente()) aviso("Aún está en revisión."); else { marco(); location.hash = `#/${menu()[0][0]}`; navegar(); } });
}

async function vRegistro() {
  document.title = "Crear cuenta · ReParte";
  history.replaceState(null, "", "#/registro");
  let regiones = [];
  try { regiones = resultados(await api("/regiones/")); } catch { /* sin conexión */ }
  const st = { paso: 1, rol: null, datos: { region: regiones[0]?.id, tiene_refrigeracion: false, tiene_cava_frio: false, acepta_politica: false } };
  const ROLES = [
    ["DONANTE", "tienda", "Quiero donar", "Supermercado, restaurante, panadería, productor…"],
    ["RECEPTOR", "olla", "Quiero recibir", "Comedor, fundación, banco de alimentos, hogar de paso…"],
    ["VOLUNTARIO", "bici", "Quiero transportar", "Persona con moto, carro, bici o a pie"],
  ];
  const CATS_ORG = {
    DONANTE: [["SUPERMERCADO", "Supermercado"], ["RESTAURANTE", "Restaurante"], ["PANADERIA", "Panadería"], ["PRODUCTOR", "Productor"], ["CENTRAL_ABASTOS", "Central de abastos"], ["OTRO", "Otro"]],
    RECEPTOR: [["COMEDOR", "Comedor comunitario"], ["FUNDACION", "Fundación"], ["BANCO_ALIMENTOS", "Banco de alimentos"], ["HOGAR_PASO", "Hogar de paso"], ["OTRO", "Otro"]],
  };
  const VEHICULOS = [["A_PIE", "A pie"], ["BICICLETA", "Bicicleta"], ["MOTO", "Moto"], ["CARRO", "Carro"], ["CAMIONETA", "Camioneta"]];
  const d = st.datos;
  const sel = (nombre, opciones, valor) => `<select id="c-${nombre}" name="${nombre}">${opciones.map(([k, t]) => `<option value="${k}" ${String(valor) === String(k) ? "selected" : ""}>${t}</option>`).join("")}</select>`;
  const guardar = () => {
    $$("#f-reg input, #f-reg select").forEach((i) => { if (!i.name) return; d[i.name] = i.type === "checkbox" ? i.checked : i.value; });
  };
  const pasoHtml = () => {
    if (st.paso === 1) return `<div class="roles">${ROLES.map(([k, e, t, s]) => `<button type="button" class="rol-opcion ${st.rol === k ? "sel" : ""}" data-rol="${k}"><span class="rol-icono">${icono(e)}</span><div><strong>${t}</strong><span>${s}</span></div></button>`).join("")}</div>`;
    if (st.paso === 2) return `<div class="fila-2">${campo("first_name", "Nombre", "text", d.first_name || "", "", 'autocomplete="given-name"')}${campo("last_name", "Apellido", "text", d.last_name || "", "", 'autocomplete="family-name"')}</div>
      ${campo("email", "Correo", "email", d.email || "", "tu@correo.com", 'autocomplete="email"')}
      ${campo("telefono", "Celular", "tel", d.telefono || "", "300 000 0000", 'autocomplete="tel"')}
      ${campo("password", "Contraseña (mínimo 8 caracteres)", "password", d.password || "", "", 'autocomplete="new-password"')}
      <div class="campo"><label for="c-region">Ciudad</label>${sel("region", regiones.map((r) => [r.id, `${r.nombre}, ${r.departamento}`]), d.region)}</div>`;
    if (st.rol === "VOLUNTARIO") return `<div class="campo"><label for="c-tipo_vehiculo">¿Cómo te movilizas?</label>${sel("tipo_vehiculo", VEHICULOS, d.tipo_vehiculo || "MOTO")}</div>
      ${campo("capacidad_kg", "¿Cuántos kg puedes llevar?", "number", d.capacidad_kg || "", "40", 'min="1" step="1" inputmode="numeric"')}
      <label class="interruptor"><input type="checkbox"name="tiene_cava_frio"${d.tiene_cava_frio ? "checked": ""}>Tengo nevera portátil o cava de frío </label>
      ${politica()}`;
    return `${campo("razon_social", "Nombre de la organización", "text", d.razon_social || "")}
      <div class="fila-2">${campo("nit", "NIT", "text", d.nit || "", "900123456-7")}
      <div class="campo"><label for="c-categoria">Tipo</label>${sel("categoria", CATS_ORG[st.rol], d.categoria || CATS_ORG[st.rol][0][0])}</div></div>
      ${campo("direccion", "Dirección", "text", d.direccion || "", "Calle 1 # 2-3, barrio")}
      <div class="campo"><label>Ubicación en el mapa <span class="ayuda">(toca el mapa para marcarla)</span></label>
        <div id="mapa-reg" class="mapa mapa-pequeno"></div>
        <div class="td-fila"><button type="button" class="btn btn-secundario btn-pequeno" id="mi-ubic">${icono("pin")} Usar mi ubicación</button><span class="ayuda" id="txt-ubic">${d.latitud ? `${Number(d.latitud).toFixed(5)}, ${Number(d.longitud).toFixed(5)}` : "Sin marcar"}</span></div>
        <p class="error-campo" id="e-latitud"></p></div>
      ${st.rol === "RECEPTOR" ? `<div class="fila-2">${campo("capacidad_kg_dia", "Kg que pueden recibir por día", "number", d.capacidad_kg_dia || "", "100", 'min="1" inputmode="numeric"')}
        ${campo("personas_atendidas", "Personas que atienden por semana", "number", d.personas_atendidas || "", "200", 'min="0" inputmode="numeric"')}</div>
        <label class="interruptor"><input type="checkbox"name="tiene_refrigeracion"${d.tiene_refrigeracion ? "checked": ""}>Tenemos nevera o cuarto frío </label>`: ""}
      <div class="campo" style="margin-top:12px"><label for="c-documento_soporte">RUT o certificado de existencia (opcional)</label><input id="c-documento_soporte" type="file" accept=".pdf,image/*"></div>
      ${politica()}`;
  };
  const politica = () => `<label class="interruptor"><input type="checkbox" name="acepta_politica" ${d.acepta_politica ? "checked" : ""}> Autorizo el tratamiento de mis datos personales (Ley 1581 de 2012)</label><p class="error-campo" id="e-acepta_politica"></p>`;
  const pinta = () => {
    $("#app").innerHTML = `<div class="login" style="max-width:560px">
      <div class="login-marca">${logo(48)}<h1 style="font-size:30px">Crear cuenta</h1><p>Súmate a la red que rescata alimentos </p></div>
      <section class="tarjeta">${stepper(st.paso, ["Rol", "Tus datos", st.rol === "VOLUNTARIO" ? "Vehículo" : "Organización"])}
        <form id="f-reg" novalidate>${pasoHtml()}
        <div class="acciones">${st.paso > 1 ? `<button class="btn btn-secundario" type="button" id="atras">Atrás</button>` : `<button class="btn btn-fantasma" type="button" id="cancelar">Ya tengo cuenta</button>`}
        <button class="btn btn-primario" type="submit">${st.paso < 3 ? "Siguiente" : "Crear cuenta"}</button></div></form></section></div>`;
    $$("[data-rol]").forEach((b) => b.addEventListener("click", () => { st.rol = b.dataset.rol; st.paso = 2; pinta(); }));
    $("#atras")?.addEventListener("click", () => { guardar(); st.paso -= 1; pinta(); });
    $("#cancelar")?.addEventListener("click", () => { history.replaceState(null, "", "/"); vLogin(); });
    $("#f-reg").addEventListener("submit", enviar);
    if (st.paso === 3 && st.rol !== "VOLUNTARIO") mapaRegistro();
  };
  const mapaRegistro = () => {
    const reg = regiones.find((r) => String(r.id) === String(d.region)) || regiones[0];
    const centro = d.latitud ? [Number(d.latitud), Number(d.longitud)] : [Number(reg?.latitud || 11.5444), Number(reg?.longitud || -72.9072)];
    const m = crearMapa($("#mapa-reg"), centro);
    if (!m) return;
    const nuevaMarca = (p) => L.circleMarker(p, { radius: 11, color: "#fff", weight: 3, fillColor: "#E76F51", fillOpacity: 1 }).addTo(m);
    let marca = d.latitud ? nuevaMarca(centro) : null;
    const fijar = (lat, lon) => {
      d.latitud = lat.toFixed(6); d.longitud = lon.toFixed(6);
      if (marca) marca.setLatLng([lat, lon]); else marca = nuevaMarca([lat, lon]);
      $("#txt-ubic").textContent = `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
    };
    m.on("click", (e) => fijar(e.latlng.lat, e.latlng.lng));
    $("#mi-ubic").addEventListener("click", async () => { const u = await miUbicacion(); if (!u) { aviso("No se pudo obtener tu ubicación", "error"); return; } fijar(u.lat, u.lon); m.setView([u.lat, u.lon], 16); });
  };
  async function enviar(e) {
    e.preventDefault(); guardar();
    $$(".error-campo").forEach((p) => (p.textContent = ""));
    if (st.paso === 2) {
      const falta = ["first_name", "email", "telefono", "password"].filter((k) => !d[k]);
      if (falta.length) { falta.forEach((k) => ($(`#e-${k}`).textContent = "Obligatorio.")); return; }
      if (d.password.length < 8) { $("#e-password").textContent = "Mínimo 8 caracteres."; return; }
      st.paso = 3; pinta(); return;
    }
    if (!d.acepta_politica) { $("#e-acepta_politica").textContent = "Debes autorizar el tratamiento de datos."; return; }
    if (st.rol !== "VOLUNTARIO" && !d.latitud) { $("#e-latitud").textContent = "Marca la ubicación en el mapa."; return; }
    const fd = new FormData();
    Object.entries({ ...d, rol: st.rol }).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== "") fd.append(k, typeof v === "boolean" ? (v ? "true" : "false") : v); });
    const doc = $("#c-documento_soporte")?.files[0];
    if (doc) fd.append("documento_soporte", doc);
    await conCarga($("#f-reg button[type=submit]"), async () => {
      try {
        await api("/auth/registro/", { metodo: "POST", datos: fd });
        aviso("¡Cuenta creada! ");
        await entrar(d.email, d.password);
      } catch (err) {
        if (err.status === 400 && typeof err.data?.detalle === "object") {
          const det = err.data.detalle;
          const paso2 = ["first_name", "last_name", "email", "telefono", "password", "region"];
          if (Object.keys(det).some((k) => paso2.includes(k))) { st.paso = 2; pinta(); }
          Object.entries(det).forEach(([k, v]) => { const p = $(`#e-${k}`); if (p) p.textContent = [].concat(v).join(" "); });
          aviso(mensajeError(err.data), "error");
        } else aviso(err.message, "error");
      }
    });
  }
  pinta();
}

/* ================= DONANTE ================= */
async function vInicioDonante(v) {
  titulo("Inicio");
  const [imp, act, rec] = await Promise.all([api("/impacto/"), api("/donaciones/?estado=ACTIVAS"), api("/recurrentes/")]);
  const lista = resultados(act);
  const hora = new Date().getHours();
  const saludo = hora < 12 ? "Buenos días" : hora < 19 ? "Buenas tardes" : "Buenas noches";
  v.innerHTML = `<p class="saludo">${saludo} </p><p class="subsaludo">${esc(YO.organizacion?.razon_social)}</p>
    <section class="tarjeta-impacto">
      <div><span class="etq">Has rescatado</span><strong class="cifra">${fmt.kg(imp.kg_rescatados)}</strong>
      <span class="etq">${imp.donaciones_entregadas} ${imp.donaciones_entregadas === 1 ? "donación entregada" : "donaciones entregadas"} · ≈ ${fmt.num(imp.raciones_equivalentes)} raciones</span></div>
      <a class="btn btn-claro" href="#/impacto">Ver impacto</a>
    </section>
    <div class="accesos">
      <a class="acceso c1" href="#/publicar"><span>${icono("camara")}</span>Publicar excedente<small>Con foto, en 1 minuto</small></a>
      <a class="acceso c2" href="#/recurrentes"><span>${icono("repetir")}</span>Automáticas<small>${rec.filter((r) => r.activa).length} activas</small></a>
      <a class="acceso c3" href="#/certificados"><span>${icono("medalla")}</span>Certificados<small>Descarga en PDF</small></a>
      <a class="acceso c4" href="#/ranking"><span>${icono("estrella")}</span>Ranking<small>Donantes que más rescatan</small></a>
    </div>
    <div class="seccion-cab"><h2>Donaciones activas</h2><a href="#/donaciones">Ver todas</a></div>
    ${lista.length ? `<div class="lista">${lista.map(tarjetaDonacion).join("")}</div>`
      : vacio("caja", "No tienes donaciones activas", "Publica un excedente y te avisaremos cuando un receptor lo acepte.")}
    <a class="fab" href="#/publicar">${icono("mas")}<span>Publicar excedente</span></a>`;
}

const DIAS_CORTOS = ["L", "M", "X", "J", "V", "S", "D"];
const DIAS_LARGOS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
async function vPublicar(v) {
  titulo("Publicar excedente");
  const cats = await api("/categorias/");
  const ahora = new Date();
  const st = { paso: 1, categoria: null, descripcion: "", cantidad: "", unidad: "KG", peso: "", condicion: "AMBIENTE", fotos: [],
    limite: local(sumarMin(ahora, 24 * 60)), desde: local(sumarMin(ahora, 30)), hasta: local(sumarMin(ahora, 180)),
    repetir: false, dias: [0, 1, 2, 3, 4, 5], horaRep: `${pad(ahora.getHours())}:00` };
  const UNIDADES = { KG: "kg", UNIDAD: "unidades", LITRO: "litros", CAJA: "cajas" };
  const CONDICIONES = { AMBIENTE: "Ambiente", REFRIGERADO: "Refrigerado", CONGELADO: "Congelado" };

  const pasoHtml = () => {
    if (st.paso === 1) return `
      <fieldset><legend>¿Qué vas a donar?</legend><div class="opciones-cat">${cats.map((c) =>
        `<button type="button" class="opcion ${st.categoria === c.id ? "sel" : ""}" data-cat="${c.id}" aria-pressed="${st.categoria === c.id}" style="${st.categoria === c.id ? "" : `background:${catVisual(c.nombre)[1]}`}">${catVisual(c.nombre)[0]}<span>${esc(c.nombre)}</span></button>`).join("")}</div>
      <p class="error-campo" id="e-categoria"></p></fieldset>
      ${campo("descripcion", "Descripción", "text", st.descripcion, "Ej.: tomate, cebolla y papa en buen estado", 'maxlength="300"')}
      <fieldset><legend>Fotos <span class="ayuda">(opcional, hasta 4)</span></legend>
        <div class="fotos-picker">${st.fotos.map((f, i) => `<div class="foto-mini"><img src="${f.url}" alt="Foto ${i + 1}"><button type="button" data-quitar="${i}" aria-label="Quitar foto">×</button></div>`).join("")}
        ${st.fotos.length < 4 ? `<label class="foto-agregar">${icono("camara")}Agregar<input type="file" accept="image/*" capture="environment" id="in-foto" hidden multiple></label>` : ""}</div>
        <p class="ayuda" style="margin-top:6px">Una buena foto ayuda a que el receptor decida más rápido.</p></fieldset>`;
    if (st.paso === 2) return `
      <div class="fila-campos">${campo("cantidad", "Cantidad", "number", st.cantidad, "40", 'min="0.1" step="0.1" inputmode="decimal"')}
        <div class="campo"><label for="c-unidad">Unidad</label><select id="c-unidad" name="unidad">${Object.entries(UNIDADES).map(([k, t]) =>
          `<option value="${k}" ${st.unidad === k ? "selected" : ""}>${t}</option>`).join("")}</select></div></div>
      ${st.unidad !== "KG" ? campo("peso_estimado_kg", "Peso aproximado (kg)", "number", st.peso, "Para medir el impacto", 'min="0.1" step="0.1" inputmode="decimal"') : ""}
      <fieldset><legend>¿Cómo se conserva?</legend><div class="pildoras">${Object.entries(CONDICIONES).map(([k, t]) =>
        `<button type="button" class="pildora ${st.condicion === k ? "sel" : ""}" data-cond="${k}" aria-pressed="${st.condicion === k}">${t}</button>`).join("")}</div></fieldset>
      ${campo("fecha_limite_consumo", "Apto para consumo hasta", "datetime-local", st.limite)}`;
    const cat = cats.find((c) => c.id === st.categoria);
    return `<div class="fila-2">${campo("recogida_desde", "Se puede recoger desde", "datetime-local", st.desde)}
      ${campo("recogida_hasta", "Hasta", "datetime-local", st.hasta)}</div>
      <section class="tarjeta" style="margin-bottom:16px;background:var(--cielo-suave);border:0">
        <label class="interruptor"><input type="checkbox"id="repetir"${st.repetir ? "checked": ""}>Esto sobra seguido: publicarlo automáticamente</label>
        ${st.repetir ? `<p class="ayuda" style="margin:6px 0 10px">Se publicará solo los días marcados a la hora indicada.</p>
          <div class="dias">${DIAS_CORTOS.map((d, i) => `<button type="button" class="dia ${st.dias.includes(i) ? "sel" : ""}" data-dia="${i}" aria-label="${DIAS_LARGOS[i]}" aria-pressed="${st.dias.includes(i)}">${d}</button>`).join("")}</div>
          <div class="campo" style="margin:12px 0 0;max-width:200px"><label for="c-hora">Hora</label><input id="c-hora" type="time" value="${st.horaRep}"></div>
          <p class="error-campo" id="e-dias"></p>` : ""}
      </section>
      <div class="tarjeta"><h3 style="margin-bottom:12px">Resumen</h3>
        ${st.fotos.length ? `<div class="fotos-picker" style="margin-bottom:12px">${st.fotos.map((f) => `<div class="foto-mini"><img src="${f.url}" alt=""></div>`).join("")}</div>` : ""}
        <dl class="resumen">
        <dt>Qué</dt><dd>${catVisual(cat?.nombre)[0]} ${esc(st.descripcion)} · ${esc(cat?.nombre)}</dd>
        <dt>Cantidad</dt><dd>${esc(st.cantidad)} ${UNIDADES[st.unidad]}${st.unidad !== "KG" ? ` (≈ ${esc(st.peso)} kg)` : ""}</dd>
        <dt>Conservación</dt><dd>${CONDICIONES[st.condicion]}</dd>
        <dt>Apto hasta</dt><dd>${fmt.fecha(st.limite)}</dd></dl></div>
      <p class="error-campo" id="e-fecha_limite_consumo"></p>`;
  };
  const pinta = () => {
    v.innerHTML = `<div class="formulario">${stepper(st.paso, ["Qué donas", "Cantidad", "Recogida"])}
      <form id="f" novalidate>${pasoHtml()}
      <div class="acciones">${st.paso > 1 ? `<button class="btn btn-secundario" type="button" id="atras">Atrás</button>` : "<span></span>"}
      <button class="btn ${st.paso < 3 ? "btn-primario" : "btn-acento"}" type="submit">${st.paso < 3 ? "Siguiente" : "Publicar"}</button></div></form></div>`;
    const f = $("#f");
    $$("[data-cat]", f).forEach((b) => b.addEventListener("click", () => { guardar(); st.categoria = Number(b.dataset.cat); pinta(); }));
    $$("[data-cond]", f).forEach((b) => b.addEventListener("click", () => { guardar(); st.condicion = b.dataset.cond; pinta(); }));
    $$("[data-quitar]", f).forEach((b) => b.addEventListener("click", () => { guardar(); st.fotos.splice(Number(b.dataset.quitar), 1); pinta(); }));
    $$("[data-dia]", f).forEach((b) => b.addEventListener("click", () => { guardar(); const i = Number(b.dataset.dia); st.dias = st.dias.includes(i) ? st.dias.filter((x) => x !== i) : [...st.dias, i]; pinta(); }));
    $("#repetir")?.addEventListener("change", (e) => { guardar(); st.repetir = e.target.checked; pinta(); });
    $("#in-foto")?.addEventListener("change", (e) => {
      guardar();
      [...e.target.files].slice(0, 4 - st.fotos.length).forEach((archivo) => st.fotos.push({ archivo, url: URL.createObjectURL(archivo) }));
      pinta();
    });
    $("#c-unidad")?.addEventListener("change", (e) => { guardar(); st.unidad = e.target.value; pinta(); });
    $("#atras")?.addEventListener("click", () => { guardar(); st.paso -= 1; pinta(); });
    f.addEventListener("submit", enviar);
  };
  const guardar = () => {
    const f = $("#f"); if (!f) return;
    const val = (n) => f.elements[n]?.value;
    if (val("descripcion") !== undefined) st.descripcion = val("descripcion").trim();
    if (val("cantidad") !== undefined) st.cantidad = val("cantidad");
    if (val("peso_estimado_kg") !== undefined) st.peso = val("peso_estimado_kg");
    if (val("fecha_limite_consumo") !== undefined) st.limite = val("fecha_limite_consumo");
    if (val("recogida_desde") !== undefined) st.desde = val("recogida_desde");
    if (val("recogida_hasta") !== undefined) st.hasta = val("recogida_hasta");
    if ($("#c-hora")) st.horaRep = $("#c-hora").value;
  };
  const marcar = (n, msg) => { const p = $(`#e-${n}`); if (p) { p.textContent = msg; p.closest(".campo")?.classList.add("invalido"); } return false; };
  const validar = () => {
    $$(".error-campo").forEach((p) => (p.textContent = "")); $$(".campo").forEach((c) => c.classList.remove("invalido"));
    if (st.paso === 1) {
      let ok = true;
      if (!st.categoria) ok = marcar("categoria", "Elige una categoría.");
      if (st.descripcion.length < 3) ok = marcar("descripcion", "Describe brevemente el alimento.");
      return ok;
    }
    if (st.paso === 2) {
      let ok = true;
      if (!(Number(st.cantidad) > 0)) ok = marcar("cantidad", "Debe ser mayor que cero.");
      if (st.unidad !== "KG" && !(Number(st.peso) > 0)) ok = marcar("peso_estimado_kg", "Indica el peso aproximado.");
      if (!st.limite || new Date(st.limite) <= new Date()) ok = marcar("fecha_limite_consumo", "Debe ser una fecha futura.");
      return ok;
    }
    let ok = true;
    if (!(new Date(st.hasta) > new Date(st.desde))) ok = marcar("recogida_hasta", "Debe ser posterior al inicio.");
    if (!(new Date(st.desde) < new Date(st.limite))) ok = marcar("recogida_desde", "La recogida debe empezar antes de la fecha límite.");
    if (st.repetir && !st.dias.length) ok = marcar("dias", "Elige al menos un día.");
    return ok;
  };
  async function enviar(e) {
    e.preventDefault(); guardar();
    if (!validar()) return;
    if (st.paso < 3) { st.paso += 1; pinta(); return; }
    const datos = { categoria: st.categoria, descripcion: st.descripcion, cantidad: st.cantidad, unidad: st.unidad,
      condicion: st.condicion, fecha_limite_consumo: iso(st.limite), recogida_desde: iso(st.desde), recogida_hasta: iso(st.hasta) };
    if (st.unidad !== "KG") datos.peso_estimado_kg = st.peso;
    await conCarga($("#f button[type=submit]"), async () => {
      try {
        const d = await api("/donaciones/", { metodo: "POST", datos });
        for (const f of st.fotos) {
          try { await subirFoto(d.id, f.archivo, "PUBLICACION"); } catch (err) { aviso(`Una foto no se pudo subir: ${err.message}`, "error"); }
        }
        if (st.repetir) {
          const horas = (a, b) => Math.max(1, Math.round((new Date(b) - new Date(a)) / 3600000));
          await api("/recurrentes/", { metodo: "POST", datos: { categoria: st.categoria, descripcion: st.descripcion, cantidad: st.cantidad,
            unidad: st.unidad, peso_estimado_kg: st.unidad !== "KG" ? st.peso : undefined, condicion: st.condicion, dias: st.dias,
            hora_publicacion: st.horaRep, horas_para_recoger: horas(st.desde, st.hasta), horas_vida_util: horas(st.desde, st.limite) } });
          aviso("Quedó programada la publicación automática");
        }
        const sug = d.asignaciones.find((a) => a.estado === "SUGERIDA");
        aviso(sug ? `¡Publicada! Sugerida a ${sug.receptor} `: "¡Publicada! Te avisamos cuando alguien la tome.");
        location.hash = `#/donacion/${d.id}`;
      } catch (err) { errorEnCampos($("#f"), err); }
    });
  }
  pinta();
}

async function listaDonaciones(v, { tituloVista, pestanas, vacioTxt }) {
  titulo(tituloVista);
  let actual = pestanas[0][0];
  const cargar = async () => {
    v.innerHTML = `<div class="pestanas" role="tablist">${pestanas.map(([k, t]) =>
      `<button class="pestana ${k === actual ? "sel" : ""}" role="tab" aria-selected="${k === actual}" data-p="${k}">${t}</button>`).join("")}</div><div id="cont">${esqueleto()}</div>`;
    $$("[data-p]", v).forEach((b) => b.addEventListener("click", () => { actual = b.dataset.p; cargar(); }));
    const datos = resultados(await api(`/donaciones/${actual ? `?estado=${actual}` : ""}`));
    $("#cont", v).innerHTML = datos.length ? `<div class="lista">${datos.map(tarjetaDonacion).join("")}</div>` : vacio("caja", "Nada por aquí", vacioTxt);
  };
  await cargar();
}
const vDonaciones = (v) => listaDonaciones(v, { tituloVista: "Mis donaciones",
  pestanas: [["ACTIVAS", "Activas"], ["ENTREGADA", "Entregadas"], ["CANCELADA,VENCIDA", "Canceladas y vencidas"], ["", "Todas"]],
  vacioTxt: "No hay donaciones en este estado." });

async function vDonacion(v, id) {
  const d = await api(`/donaciones/${id}/`);
  titulo(d.codigo);
  const esDonante = YO.rol === "DONANTE", esAdmin = YO.rol === "ADMIN";
  const cancelable = esDonante && ["PUBLICADA", "ASIGNADA", "EN_RECOGIDA"].includes(d.estado);
  const enCamino = ["EN_RECOGIDA", "EN_TRANSITO"].includes(d.estado) && YO.rol !== "VOLUNTARIO";
  const portada = d.fotos.find((f) => f.etapa === "PUBLICACION");
  const [ic, fondo] = catVisual(d.categoria);
  v.innerHTML = `<button class="volver" type="button" id="volver">${icono("atras")} Volver</button>
  <div class="detalle"><div style="display:grid;gap:16px">
    <section class="tarjeta cab-detalle">
      ${portada ? `<img class="portada-foto" src="${esc(portada.url)}" alt="Foto de ${esc(d.descripcion)}">` : `<div style="height:110px;border-radius:18px;background:${fondo};display:grid;place-items:center" class="portada-cat" aria-hidden="true">${ic}</div>`}
      <div class="td-fila">${chip(d.estado)}<span class="td-meta">${esc(d.codigo)}</span></div>
      <h2>${esc(d.descripcion)}</h2>
      ${d.codigo_entrega && ACTIVOS.includes(d.estado) ? `<div class="codigo-grande"><span>Dale este código al voluntario cuando llegue</span><strong>${esc(d.codigo_entrega)}</strong></div>`: ""}
      <div class="datos" style="margin-top:8px">
        <div><span>Categoría</span><strong>${ic} ${esc(d.categoria)}</strong></div>
        <div><span>Cantidad</span><strong>${d.unidad === "KG" ? fmt.kg(d.cantidad) : `${fmt.num(d.cantidad)} ${esc(d.unidad_display.toLowerCase())} · ${fmt.kg(d.peso_estimado_kg)}`}</strong></div>
        <div><span>Conservación</span><strong>${esc(d.condicion_display)}</strong></div>
        <div><span>Apto hasta</span><strong>${fmt.fecha(d.fecha_limite_consumo)}</strong></div>
        <div><span>Recogida</span><strong>${fmt.fecha(d.recogida_desde)} – ${fmt.hora(d.recogida_hasta)}</strong></div>
        <div><span>Donante</span><strong>${esc(d.donante.razon_social)}</strong></div>
        <div><span>Receptor</span><strong>${esc(d.receptor?.razon_social || "Por definir")}</strong></div>
        <div><span>Voluntario</span><strong>${esc(d.recogida?.voluntario ? `${d.recogida.voluntario} · ${d.recogida.vehiculo}` : "Por definir")}</strong></div>
      </div>
      ${d.motivo_cancelacion ? `<p class="nota">Motivo: ${esc(d.motivo_cancelacion)}</p>` : ""}
      ${cancelable ? `<div><button class="btn btn-peligro" id="cancelar" type="button">Cancelar donación</button></div>` : ""}
    </section>
    ${enCamino ? `<section class="tarjeta"style="display:flex;flex-direction:column;gap:10px"><div class="td-fila"style="justify-content:space-between"><h3>Seguimiento en vivo</h3><span class="vivo">En vivo</span></div>
      <div id="mapa" class="mapa" style="height:300px"></div><p class="estado-ubicacion" id="estado-seg">Buscando al voluntario…</p></section>` : ""}
    ${d.puede_calificar ? `<section class="tarjeta" id="calificar" style="display:flex;flex-direction:column;gap:12px;background:var(--sol-suave);border:0">
      <h3>¿Cómo llegó la donación?</h3>
      <div><p class="ayuda">Calidad del alimento</p><div class="estrellas" data-grupo="calidad">${[1, 2, 3, 4, 5].map((n) => `<button type="button" data-n="${n}" aria-label="${n} estrellas">★</button>`).join("")}</div></div>
      ${d.recogida?.voluntario ? `<div><p class="ayuda">Servicio de ${esc(d.recogida.voluntario)}</p><div class="estrellas" data-grupo="servicio">${[1, 2, 3, 4, 5].map((n) => `<button type="button" data-n="${n}" aria-label="${n} estrellas">★</button>`).join("")}</div></div>` : ""}
      <div class="campo" style="margin:0"><label for="c-coment">Comentario (opcional)</label><input id="c-coment" maxlength="300" placeholder="Ej.: llegó fresco y a tiempo"></div>
      <button class="btn btn-primario" id="enviar-cal" type="button" style="align-self:flex-start">Enviar calificación</button></section>` : ""}
    ${d.calificacion ? `<section class="tarjeta"><h3 style="margin-bottom:8px">Calificación del receptor</h3>
      <p>Alimento: ${estrellas(d.calificacion.calidad_alimento)}</p>
      ${d.calificacion.servicio_voluntario ? `<p>Voluntario: ${estrellas(d.calificacion.servicio_voluntario)}</p>` : ""}
      ${d.calificacion.comentario ? `<p class="ayuda" style="margin-top:6px">“${esc(d.calificacion.comentario)}”</p>` : ""}</section>` : ""}
    ${d.certificado ? `<section class="tarjeta"><div class="td-fila"style="margin-bottom:8px"><span style="font-size:24px"></span><h3>Certificado ${esc(d.certificado.consecutivo)}</h3></div>
      <p>${fmt.kg(d.certificado.kg)} entregados el ${fmt.dia(d.certificado.emitido_en)}.</p><p class="hash" title="Huella SHA-256">${esc(d.certificado.hash)}</p>
      ${esDonante ? `<button class="btn btn-secundario" id="pdf" type="button" style="margin-top:10px">${icono("documento")} Descargar PDF</button>` : ""}</section>` : ""}
    ${d.fotos.length ? `<section class="tarjeta"><h3 style="margin-bottom:10px">Fotos</h3><div class="galeria">${d.fotos.map((f) =>
      `<figure><a href="${esc(f.url)}" target="_blank" rel="noopener"><img src="${esc(f.url)}" alt="Foto de ${esc(f.etapa_display)}" loading="lazy"></a><figcaption>${esc(f.etapa_display)}</figcaption></figure>`).join("")}</div></section>` : ""}
    ${esDonante && ACTIVOS.includes(d.estado) && d.fotos.filter((f) => f.etapa === "PUBLICACION").length < 4 ? `<label class="btn btn-secundario" style="align-self:flex-start">${icono("camara")} Agregar foto<input type="file" accept="image/*" id="mas-foto" hidden></label>` : ""}
    ${(esDonante || esAdmin) && d.asignaciones.length ? `<section class="tarjeta"><h3 style="margin-bottom:8px">Intentos de asignación</h3><div class="tabla-scroll"><table class="tabla">
      <tr><th>#</th><th>Receptor</th><th>Puntaje</th><th>Distancia</th><th>Estado</th></tr>
      ${d.asignaciones.map((a) => `<tr><td>${a.intento}</td><td>${esc(a.receptor)}</td><td>${a.origen === "SOLICITUD" ? "Elegida" : Number(a.puntaje).toFixed(3)}</td><td>${a.distancia_km} km</td><td>${chip(a.estado)}</td></tr>`).join("")}
      </table></div>${esAdmin ? `<button class="btn btn-secundario" id="explicar" type="button" style="margin-top:12px">Ver cálculo de candidatos</button><div id="explicacion"></div>` : ""}</section>` : ""}
  </div>
  <section class="tarjeta"><h3 style="margin-bottom:16px">Línea de tiempo</h3><ol class="tiempo">${d.linea_tiempo.map((e) =>
    `<li><strong>${esc(e.titulo)}</strong><span>${fmt.fecha(e.fecha)}${e.detalle ? ` · ${esc(e.detalle)}` : ""}</span></li>`).join("")}</ol></section>
  </div>`;
  $("#volver").addEventListener("click", () => (history.length > 1 ? history.back() : (location.hash = `#/${menu()[0][0]}`)));
  $("#cancelar")?.addEventListener("click", async () => {
    const r = await modal({ titulo: "¿Cancelar esta donación?", confirmar: "Sí, cancelar", peligro: true,
      cuerpo: `<div class="campo"><label for="m-motivo">Motivo (opcional)</label><input id="m-motivo" name="motivo" placeholder="Ej.: se vendió el producto"></div>` });
    if (!r) return;
    try { await api(`/donaciones/${id}/cancelar/`, { metodo: "POST", datos: { motivo: r.motivo } }); aviso("Donación cancelada"); navegar(); }
    catch (e) { aviso(e.message, "error"); }
  });
  $("#pdf")?.addEventListener("click", (e) => conCarga(e.currentTarget, async () => {
    const certs = await api("/certificados/");
    const c = certs.find((x) => x.consecutivo === d.certificado.consecutivo);
    try { await descargar(`/certificados/${c.id}/pdf/`, `certificado_${c.consecutivo}.pdf`); } catch (err) { aviso(err.message, "error"); }
  }));
  $("#mas-foto")?.addEventListener("change", async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try { await subirFoto(id, f, "PUBLICACION"); aviso("Foto agregada"); navegar(); } catch (err) { aviso(err.message, "error"); }
  });
  // calificación
  const valores = {};
  $$(".estrellas[data-grupo]").forEach((g) => $$("button", g).forEach((b) => b.addEventListener("click", () => {
    valores[g.dataset.grupo] = Number(b.dataset.n);
    $$("button", g).forEach((x) => x.classList.toggle("on", Number(x.dataset.n) <= valores[g.dataset.grupo]));
  })));
  $("#enviar-cal")?.addEventListener("click", (e) => conCarga(e.currentTarget, async () => {
    if (!valores.calidad) { aviso("Elige las estrellas de la calidad del alimento", "error"); return; }
    try {
      await api(`/donaciones/${id}/calificar/`, { metodo: "POST", datos: { calidad: valores.calidad, servicio: valores.servicio || null, comentario: $("#c-coment").value } });
      aviso("¡Gracias por calificar! "); navegar();
    } catch (err) { aviso(err.message, "error"); }
  }));
  $("#explicar")?.addEventListener("click", async () => {
    const x = await api(`/simulacion/puntaje/${id}/`);
    $("#explicacion").innerHTML = x.candidatos.length ? `<p class="nota">Receptores que aún no han recibido esta sugerencia, con pesos w1–w4 = ${Object.values(x.pesos).join(" · ")}</p>
      <div class="tabla-scroll"><table class="tabla"><tr><th>Receptor</th><th>km</th><th>Prox.</th><th>Urg.</th><th>Nec.</th><th>Eq.</th><th>Puntaje</th></tr>
      ${x.candidatos.map((c) => `<tr><td>${esc(c.receptor)}</td><td>${c.distancia_km}</td><td>${c.factores.proximidad}</td><td>${c.factores.urgencia}</td><td>${c.factores.necesidad}</td><td>${c.factores.equidad}</td><td><b>${c.puntaje}</b></td></tr>`).join("")}</table></div>`
      : `<p class="nota">No quedan otros receptores compatibles para esta donación.</p>`;
  });
  if (enCamino) seguirEnVivo(id);
}

/** Mapa del donante/receptor con la posición del voluntario, actualizada cada 10 s. */
async function seguirEnVivo(id) {
  let s;
  try { s = await api(`/donaciones/${id}/seguimiento/`); } catch (e) { $("#estado-seg").textContent = e.message; return; }
  const m = crearMapa($("#mapa"), [s.origen.lat, s.origen.lon]);
  if (!m) return;
  const pin = (p, color, txt) => L.circleMarker([p.lat, p.lon], { radius: 11, color: "#fff", weight: 3, fillColor: color, fillOpacity: 1 })
    .addTo(m).bindTooltip(txt, { permanent: true, direction: "top", offset: [0, -10] });
  pin(s.origen, "#2E8B57", `Recoger: ${esc(s.origen.nombre)}`);
  pin(s.destino, "#F4A261", `Entregar: ${esc(s.destino.nombre)}`);
  L.polyline([[s.origen.lat, s.origen.lon], [s.destino.lat, s.destino.lon]], { color: "#6E625A", weight: 2, dashArray: "5 7" }).addTo(m);
  const icon = L.divIcon({ className: "marcador-voluntario", html: "<span></span>", iconSize: [22, 22], iconAnchor: [11, 11] });
  let marca = null;
  const actualizar = (s2) => {
    const txt = $("#estado-seg"); if (!txt) return;
    if (!["TOMADA", "RECOGIDA"].includes(s2.estado)) { txt.textContent = `Recogida ${s2.estado_display.toLowerCase()}.`; return; }
    if (!s2.posicion) { txt.textContent = `${s2.voluntario} aún no comparte su ubicación.`; return; }
    const pos = [s2.posicion.lat, s2.posicion.lon];
    if (marca) marca.setLatLng(pos); else marca = L.marker(pos, { icon }).addTo(m).bindTooltip(esc(s2.voluntario), { direction: "bottom" });
    txt.textContent = `${s2.voluntario} (${s2.vehiculo}) · ${s2.estado === "TOMADA" ? "va hacia el donante" : "va hacia el receptor"} · actualizado ${fmt.relativo(s2.posicion.actualizada_en)}`;
  };
  m.fitBounds([[s.origen.lat, s.origen.lon], [s.destino.lat, s.destino.lon], ...(s.posicion ? [[s.posicion.lat, s.posicion.lon]] : [])], { padding: [50, 50], maxZoom: 16 });
  actualizar(s);
  temporizadores.push(setInterval(async () => { try { actualizar(await api(`/donaciones/${id}/seguimiento/`)); } catch { /* reintenta luego */ } }, 10000));
}

async function vImpacto(v) {
  const imp = await api("/impacto/");
  titulo("Impacto");
  v.innerHTML = panelImpacto(imp) + `<a class="acceso c4" href="#/ranking" style="margin-top:16px;flex-direction:row;align-items:center;gap:12px"><span>${icono("estrella")}</span><div>Ver el ranking<br><small>Quiénes más rescatan alimentos</small></div></a>`;
}
function panelImpacto(imp) {
  const max = Math.max(1, ...imp.por_mes.map((m) => Number(m.kg)));
  const co2 = Number(imp.kg_co2_evitados);
  const est = (e, valor, txt) => `<div class="estadistica"><span class="e-icono">${icono(e)}</span><strong>${valor}</strong><span>${txt}</span></div>`;
  return `<p class="ayuda" style="margin-bottom:12px">Alcance: <b>${esc(imp.alcance)}</b></p>
    <div class="estadisticas">
      ${est("caja", fmt.kg(imp.kg_rescatados), "rescatados")}
      ${est("check", fmt.num(imp.donaciones_entregadas), "donaciones entregadas")}
      ${est("olla", fmt.num(imp.raciones_equivalentes), "raciones equivalentes")}
      ${est("edificio", fmt.num(imp.receptores_atendidos), "receptores atendidos")}
      ${est("camion", fmt.num(imp.voluntarios_activos), "voluntarios activos")}
      ${est("estrella", imp.calificacion_promedio ? `${imp.calificacion_promedio}/5`: "—", "calidad promedio")}
    </div>
    <section class="tarjeta"style="margin-top:16px"><h3>Kilos rescatados por mes</h3>
      ${imp.por_mes.length ? `<div class="grafico" role="img" aria-label="Gráfico de kilos por mes">${imp.por_mes.map((m) =>
        `<div class="barra-col"><span class="v">${fmt.num(m.kg)}</span><div class="b" style="height:${(Number(m.kg) / max) * 85}%"></div><small>${fmt.mes(m.mes)}</small></div>`).join("")}</div>`
      : vacio("grafico", "Aún no hay entregas", "Cuando se entregue la primera donación verás aquí el avance.")}
      <p class="nota">Supuesto: 1 ración ≈ ${esc(imp.supuestos.kg_por_racion)} kg.${co2 ? ` CO₂ evitado: ${fmt.kg(co2)}.` : " El factor de CO₂ por categoría está por definir con fuentes."}</p>
    </section>`;
}

async function vCertificados(v) {
  titulo("Certificados");
  const certs = await api("/certificados/");
  v.innerHTML = certs.length ? `<div class="lista">${certs.map((c) => `<div class="tarjeta" style="display:flex;flex-direction:column;gap:6px">
      <div class="td-fila"style="justify-content:space-between"><h3>${esc(c.consecutivo)}</h3><span class="td-meta">${fmt.dia(c.emitido_en)}</span></div>
      <p>${esc(c.descripcion)} · <b>${fmt.kg(c.kg_certificados)}</b></p>
      <p class="td-meta">Entregado a ${esc(c.receptor || "—")} · ${esc(c.codigo_donacion)}</p>
      <p class="hash">${esc(c.hash_sha256)}</p>
      <button class="btn btn-secundario btn-pequeno" data-pdf="${c.id}" data-nombre="${esc(c.consecutivo)}" type="button" style="align-self:flex-start;margin-top:4px">${icono("documento")} Descargar PDF</button></div>`).join("")}</div>`
    : vacio("medalla", "Aún no tienes certificados", "Se emiten automáticamente cuando una donación se entrega.");
  $$("[data-pdf]", v).forEach((b) => b.addEventListener("click", () => conCarga(b, async () => {
    try { await descargar(`/certificados/${b.dataset.pdf}/pdf/`, `certificado_${b.dataset.nombre}.pdf`); } catch (e) { aviso(e.message, "error"); }
  })));
}

async function vRecurrentes(v) {
  titulo("Publicaciones automáticas");
  const lista = await api("/recurrentes/");
  v.innerHTML = `<p class="ayuda" style="margin-bottom:14px">Si algo te sobra seguido (por ejemplo, pan todas las tardes), ReParte lo publica solo los días y a la hora que elijas.</p>
    ${lista.length ? `<div class="lista">${lista.map((r) => `<article class="tarjeta" style="display:flex;flex-direction:column;gap:8px;${r.activa ? "" : "opacity:.6"}">
      <div class="td-fila" style="justify-content:space-between"><strong style="font-size:17px">${catVisual(r.categoria_nombre)[0]} ${esc(r.descripcion)}</strong>${r.activa ? '<span class="chip chip-exito">Activa</span>' : '<span class="chip chip-gris">Pausada</span>'}</div>
      <p class="td-meta">${fmt.num(r.cantidad)} ${r.unidad === "KG" ? "kg" : esc(r.unidad.toLowerCase())} · ${esc(r.categoria_nombre)}</p>
      <div class="dias">${DIAS_CORTOS.map((d, i) => `<span class="dia ${r.dias_lista.includes(i) ? "sel" : ""}" style="display:grid;place-items:center;width:34px;height:34px;font-size:13px">${d}</span>`).join("")}</div>
      <p class="td-meta">A las ${r.hora_publicacion.slice(0, 5)} · se recoge en ${r.horas_para_recoger} h${r.ultima_publicacion ? `· última vez: ${fmt.dia(r.ultima_publicacion + "T12:00:00")}`: ""}</p>
      <div class="td-fila"><button class="btn btn-secundario btn-pequeno" data-alternar="${r.id}" data-activa="${r.activa}" type="button">${r.activa ? "Pausar" : "Activar"}</button>
      <button class="btn btn-fantasma btn-pequeno" data-borrar="${r.id}" type="button">Eliminar</button></div></article>`).join("")}</div>`
    : vacio("reloj", "No tienes publicaciones automáticas", "Al publicar un excedente marca “publicarlo automáticamente”.")}
    <a class="btn btn-acento" href="#/publicar" style="margin-top:18px">${icono("mas")} Nueva publicación</a>`;
  $$("[data-alternar]", v).forEach((b) => b.addEventListener("click", async () => {
    await api(`/recurrentes/${b.dataset.alternar}/`, { metodo: "PATCH", datos: { activa: b.dataset.activa !== "true" } }); navegar();
  }));
  $$("[data-borrar]", v).forEach((b) => b.addEventListener("click", async () => {
    if (!(await modal({ titulo: "¿Eliminar esta publicación automática?", confirmar: "Eliminar", peligro: true }))) return;
    await api(`/recurrentes/${b.dataset.borrar}/`, { metodo: "DELETE" }); aviso("Eliminada"); navegar();
  }));
}

async function vRanking(v) {
  titulo("Ranking");
  const r = await api("/impacto/ranking/");
  const MED = ["1", "2", "3"];
  const VEH = { A_PIE: "A pie ·", BICICLETA: "Bicicleta ·", MOTO: "Moto ·", CARRO: "Carro ·", CAMIONETA: "Camioneta ·" };
  const insignias = (l) => (l.length ? `<div class="insignias">${l.map((i) => `<span class="insignia">${esc(i)}</span>`).join("")}</div>` : "");
  const podio = (lista, sub) => (lista.length ? `<div class="podio">${lista.slice(0, 3).map((x, i) =>
    `<div class="podio-item p${i + 1}"><span class="medalla">${MED[i]}</span><strong>${esc(x.nombre)}</strong><small>${sub(x)}</small></div>`).join("")}</div>` : "");
  const filas = (lista, sub) => lista.map((x) => `<div class="fila-rank"><span class="pos">${x.posicion}</span><div style="flex:1"><strong>${esc(x.nombre)}</strong>
    <div class="td-meta">${sub(x)}</div>${insignias(x.insignias)}</div></div>`).join("");
  const subV = (x) => `${VEH[x.vehiculo] || ""} ${x.entregas} ${x.entregas === 1 ? "entrega" : "entregas"} · ${fmt.kg(x.kg)}`;
  const subD = (x) => `${fmt.kg(x.kg)} · ${x.donaciones} donaciones`;
  v.innerHTML = `<p class="ayuda"style="margin-bottom:14px">Alcance: <b>${esc(r.alcance)}</b>· Gracias a quienes hacen posible el rescate </p>
    <div class="detalle">
      <section class="tarjeta"><h2 style="margin-bottom:14px">Voluntarios</h2>${r.voluntarios.length ? podio(r.voluntarios, subV) + filas(r.voluntarios, subV) : vacio("camion", "Aún sin entregas", "")}</section>
      <section class="tarjeta"><h2 style="margin-bottom:14px">Donantes</h2>${r.donantes.length ? podio(r.donantes, subD) + filas(r.donantes, subD) : vacio("caja", "Aún sin donaciones entregadas", "")}</section>
    </div>`;
}

/* ================= RECEPTOR ================= */
async function vPendientes(v) {
  titulo("Por aceptar");
  const pinta = async () => {
    const lista = await api("/asignaciones/pendientes/");
    const fin = Date.now();
    v.innerHTML = lista.length ? `<p class="ayuda" style="margin-bottom:12px">El sistema te sugiere estas donaciones. Si no respondes a tiempo, pasan a otra organización.</p>
      <div class="lista">${lista.map((a) => {
        const d = a.donacion, frio = d.condicion !== "AMBIENTE";
        return `<article class="tarjeta tarjeta-sugerida">
          <div class="portada" style="background:${catVisual(d.categoria)[1]}">${d.foto ? `<img src="${esc(d.foto)}" alt="Foto de ${esc(d.descripcion)}">` : catVisual(d.categoria)[0]}</div>
          <div class="cuerpo"><h3>${esc(d.descripcion)}</h3>
            <p class="td-meta">${fmt.kg(d.peso_estimado_kg)} · ${esc(d.categoria)} · ${esc(d.condicion_display)}</p>
            <p class="td-meta">${esc(d.donante.razon_social)} · ${a.distancia_km} km</p>
            <p class="td-meta">Apto hasta ${fmt.fecha(d.fecha_limite_consumo)} · recoger antes de ${fmt.hora(d.recogida_hasta)}</p>
            <span class="cuenta" data-fin="${fin + a.segundos_restantes * 1000}">${icono("reloj")} <span>${fmt.mmss(a.segundos_restantes)}</span></span>
          </div>
          <div class="acciones"><button class="btn btn-secundario" data-rechazar="${a.id}" type="button">Rechazar</button>
            <button class="btn btn-primario" data-aceptar="${a.id}" data-don="${d.id}" type="button">Aceptar</button></div></article>`;
      }).join("")}</div>` : vacio("reloj", "No tienes donaciones por aceptar", "Te avisaremos cuando el sistema te sugiera una. Esta pantalla se actualiza sola.");
    $$("[data-aceptar]", v).forEach((b) => b.addEventListener("click", () => conCarga(b, async () => {
      try { await api(`/asignaciones/${b.dataset.aceptar}/aceptar/`, { metodo: "POST" }); aviso("¡Aceptada! Ya se avisó a los voluntarios."); location.hash = `#/donacion/${b.dataset.don}`; }
      catch (e) { aviso(e.message, "error"); pinta(); }
    })));
    $$("[data-rechazar]", v).forEach((b) => b.addEventListener("click", async () => {
      const r = await modal({ titulo: "¿Rechazar esta donación?", confirmar: "Rechazar", peligro: true,
        cuerpo: `<div class="campo"><label for="m-motivo">Motivo</label><input id="m-motivo" name="motivo" placeholder="Ej.: no tenemos espacio hoy"></div>` });
      if (!r) return;
      try {
        const x = await api(`/asignaciones/${b.dataset.rechazar}/rechazar/`, { metodo: "POST", datos: { motivo: r.motivo } });
        aviso(x.reasignada_a ? `Rechazada. Se sugirió a ${x.reasignada_a}.` : "Rechazada.");
      } catch (e) { aviso(e.message, "error"); }
      pinta();
    }));
  };
  await pinta();
  temporizadores.push(setInterval(() => {
    $$("[data-fin]").forEach((el) => {
      const s = Math.max(0, Math.round((Number(el.dataset.fin) - Date.now()) / 1000));
      $("span", el).textContent = fmt.mmss(s);
      el.classList.toggle("urgente", s < 300);
    });
  }, 1000));
  temporizadores.push(setInterval(() => { if (!document.querySelector(".modal-fondo")) pinta().catch(() => {}); }, 20000));
}

async function vDisponibles(v) {
  titulo("Elegir excedentes");
  const lista = await api("/donaciones/disponibles/");
  let filtro = "PARA_MI";
  const org = YO.organizacion;
  v.innerHTML = `<p class="ayuda" style="margin-bottom:12px">Excedentes publicados en ${esc(YO.region?.nombre || "tu región")}.
      Elige lo que tu organización necesita: queda asignado a ustedes al instante y se avisa a los voluntarios.</p>
    ${lista.length ? `<div id="mapa" class="mapa" style="height:280px;margin-bottom:12px"></div>
      <div class="leyenda" style="margin:0 0 16px"><span><i style="background:#1F7A4D"></i>Puedes solicitarlo</span><span><i style="background:#9AA59F"></i>No compatible</span><span><i style="background:#E8833A"></i>Tu organización</span></div>
      <div class="pestanas" id="filtros"></div><div class="lista" id="lista"></div>`
      : vacio("cesta", "No hay excedentes publicados ahora", "Cuando un donante publique algo en tu región aparecerá aquí.")}`;
  if (!lista.length) return;

  const pinta = () => {
    const visibles = filtro === "PARA_MI" ? lista.filter((d) => d.compatible) : lista;
    $("#filtros").innerHTML = [["PARA_MI", `Para mí (${lista.filter((d) => d.compatible).length})`], ["TODOS", `Todos (${lista.length})`]]
      .map(([k, t]) => `<button class="pestana ${k === filtro ? "sel" : ""}" data-f="${k}">${t}</button>`).join("");
    $$("[data-f]").forEach((b) => b.addEventListener("click", () => { filtro = b.dataset.f; pinta(); }));
    $("#lista").innerHTML = visibles.length ? visibles.map((d) => {
      const frio = d.condicion !== "AMBIENTE";
      return `<article class="tarjeta tarjeta-donacion ${d.compatible ? "" : "no-compatible"}">
        ${miniatura(d)}
        <div class="td-cuerpo"><strong>${esc(d.descripcion)}</strong>
          <div class="td-meta">${fmt.kg(d.peso_estimado_kg)} · ${esc(d.categoria)} · ${esc(d.condicion_display)}</div>
          <div class="td-meta">${esc(d.donante.razon_social)} · a ${d.distancia_km.toLocaleString("es-CO")} km de ustedes</div>
          <div class="td-meta">Apto hasta ${fmt.fecha(d.fecha_limite_consumo)} · recoger antes de ${fmt.fecha(d.recogida_hasta)}</div>
          ${d.sugerida_a_mi ? `<div><span class="chip chip-acento">El sistema ya te la sugirió</span></div>` : ""}
          ${d.compatible ? `<button class="btn btn-primario" data-solicitar="${d.id}" type="button" style="align-self:flex-start;margin-top:6px">${icono("cesta")} Solicitar</button>`
            : `<p class="aviso-no">${icono("candado")} ${esc(d.motivo_no_compatible)}</p>`}
        </div></article>`;
    }).join("") : vacio("cesta", "Nada compatible por ahora", "Revisa la pestaña Todos para ver por qué no puedes recibir los demás.");
    $$("[data-solicitar]").forEach((b) => b.addEventListener("click", async () => {
      const d = lista.find((x) => String(x.id) === b.dataset.solicitar);
      const ok = await modal({ titulo: "¿Solicitar este excedente?", confirmar: "Sí, lo necesitamos",
        cuerpo: `<p><b>${esc(d.descripcion)}</b> · ${fmt.kg(d.peso_estimado_kg)}<br><span class="ayuda">De ${esc(d.donante.razon_social)}, a ${d.distancia_km} km.
          Un voluntario lo recogerá y te lo llevará; tendrás un código para confirmar la entrega.</span></p>` });
      if (!ok) return;
      try {
        await api(`/donaciones/${d.id}/solicitar/`, { metodo: "POST" });
        aviso("¡Listo! Es para ustedes. Ya avisamos a los voluntarios.");
        location.hash = `#/donacion/${d.id}`;
      } catch (e) { aviso(e.message, "error"); navegar(); }
    }));
  };
  pinta();

  const m = crearMapa($("#mapa"), [Number(org.latitud), Number(org.longitud)]);
  if (!m) return;
  L.circleMarker([org.latitud, org.longitud], { radius: 11, color: "#fff", weight: 3, fillColor: "#E8833A", fillOpacity: 1 })
    .addTo(m).bindTooltip("Tu organización", { direction: "top" });
  lista.forEach((d) => {
    L.circleMarker([d.latitud, d.longitud], { radius: 9, color: "#fff", weight: 2, fillColor: d.compatible ? "#1F7A4D" : "#9AA59F", fillOpacity: 1 })
      .addTo(m).bindPopup(`<b>${esc(d.descripcion)}</b><br>${fmt.kg(d.peso_estimado_kg)} · ${esc(d.donante.razon_social)}<br>${d.compatible ? "Puedes solicitarlo" : esc(d.motivo_no_compatible)}`);
  });
  m.fitBounds([[org.latitud, org.longitud], ...lista.map((d) => [d.latitud, d.longitud])].map((p) => p.map(Number)), { padding: [30, 30], maxZoom: 15 });
}

const vRecibidas = (v) => listaDonaciones(v, { tituloVista: "Recibidas",
  pestanas: [["ACTIVAS", "En camino"], ["ENTREGADA", "Entregadas"], ["", "Todas"]],
  vacioTxt: "Aquí verás las donaciones que aceptes." });

async function vOrganizacion(v, _p, editando = false) {
  const o = await api("/organizaciones/mia/");
  titulo("Mi organización");
  const c = o.capacidad || {};
  const si = (b) =>(b ? "Sí": "— No");
  const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
  const horario = (dia) => o.horarios.find((h) => h.dia_semana === dia);
  const cab = `<section class="tarjeta cab-detalle">
      <span class="td-meta">${esc(o.categoria_display)} · ${esc(o.region.nombre)}</span><h2>${esc(o.razon_social)}</h2>
      <div class="datos" style="margin-top:8px">
        <div><span>NIT</span><strong>${esc(o.nit)}</strong></div><div><span>Estado</span><strong>${o.estado_verificacion === "VERIFICADA"? "Verificada": esc(o.estado_verificacion)}</strong></div>
        <div><span>Dirección</span><strong>${esc(o.direccion)}</strong></div><div><span>Teléfono</span><strong>${esc(o.telefono)}</strong></div>
      </div></section>`;
  if (!editando) {
    v.innerHTML = `<div class="detalle">${cab}
    <section class="tarjeta"><div class="td-fila"style="justify-content:space-between;margin-bottom:12px"><h3>Capacidad</h3>
      <button class="btn btn-secundario btn-pequeno" id="editar" type="button">${icono("lapiz")} Editar</button></div><div class="datos">
      <div><span>Recibe por día</span><strong>${fmt.kg(c.capacidad_kg_dia)}</strong></div>
      <div><span>Personas por semana</span><strong>${fmt.num(c.personas_atendidas)}</strong></div>
      <div><span>Refrigeración</span><strong>${si(c.tiene_refrigeracion)}</strong></div>
      <div><span>Congelación</span><strong>${si(c.tiene_congelacion)}</strong></div>
      <div><span>Recibe perecederos</span><strong>${si(c.acepta_perecederos)}</strong></div>
      <div><span>Radio de recepción</span><strong>${fmt.num(c.radio_max_km)} km</strong></div>
      <div><span>Nivel de necesidad</span><strong class="niveles" aria-label="${c.nivel_necesidad} de 5">${[1, 2, 3, 4, 5].map((n) => `<i class="${n <= c.nivel_necesidad ? "on" : ""}"></i>`).join("")}</strong></div>
    </div>
    <h3 style="margin:20px 0 8px">Horario de recepción</h3>
    ${o.horarios.length ? `<table class="tabla">${o.horarios.map((h) => `<tr><td>${esc(h.dia)}</td><td>${h.hora_inicio.slice(0, 5)} – ${h.hora_fin.slice(0, 5)}</td></tr>`).join("")}</table>` : `<p class="ayuda">Sin horario registrado.</p>`}
    <p class="nota">El nivel de necesidad lo asigna el administrador según la población que atienden.</p></section></div>`;
    $("#editar").addEventListener("click", () => vOrganizacion(v, null, true));
    return;
  }
  v.innerHTML = `<div class="detalle">${cab}
    <form class="tarjeta"id="f-cap"novalidate><h3 style="margin-bottom:14px">Editar capacidad y horario</h3>
      <div class="fila-2">${campo("capacidad_kg_dia", "Kg que reciben por día", "number", Number(c.capacidad_kg_dia || 0), "", 'min="0.1" step="0.1"')}
      ${campo("personas_atendidas", "Personas por semana", "number", c.personas_atendidas ?? 0, "", 'min="0"')}</div>
      ${campo("radio_max_km", "Radio de recepción (km)", "number", Number(c.radio_max_km || 10), "", 'min="0.5" step="0.5"')}
      <label class="interruptor"><input type="checkbox"name="acepta_perecederos"${c.acepta_perecederos ? "checked": ""}>Recibimos perecederos</label>
      <label class="interruptor"><input type="checkbox"name="tiene_refrigeracion"${c.tiene_refrigeracion ? "checked": ""}>Tenemos nevera o cuarto frío</label>
      <label class="interruptor"><input type="checkbox"name="tiene_congelacion"${c.tiene_congelacion ? "checked": ""}>Tenemos congelador</label>
      <h3 style="margin:18px 0 8px">Horario de recepción</h3>
      <div style="display:grid;gap:8px">${DIAS.map((nombre, i) => { const h = horario(i); return `<div class="td-fila" style="gap:10px">
        <label class="interruptor" style="width:130px"><input type="checkbox" data-dia="${i}" ${h ? "checked" : ""}> ${nombre}</label>
        <input type="time" data-ini="${i}" value="${h ? h.hora_inicio.slice(0, 5) : "08:00"}" style="min-height:42px;border:2px solid var(--borde);border-radius:12px;padding:0 8px;font:inherit">
        <span>a</span><input type="time" data-fin="${i}" value="${h ? h.hora_fin.slice(0, 5) : "17:00"}" style="min-height:42px;border:2px solid var(--borde);border-radius:12px;padding:0 8px;font:inherit"></div>`; }).join("")}</div>
      <div class="acciones"><button class="btn btn-secundario" type="button" id="cancelar">Cancelar</button><button class="btn btn-primario" type="submit">Guardar</button></div>
    </form></div>`;
  $("#cancelar").addEventListener("click", () => vOrganizacion(v));
  $("#f-cap").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target;
    const horarios = DIAS.map((_, i) => i).filter((i) => $(`[data-dia="${i}"]`).checked)
      .map((i) => ({ dia_semana: i, hora_inicio: $(`[data-ini="${i}"]`).value, hora_fin: $(`[data-fin="${i}"]`).value }));
    const datos = { capacidad_kg_dia: f.capacidad_kg_dia.value, personas_atendidas: f.personas_atendidas.value, radio_max_km: f.radio_max_km.value,
      acepta_perecederos: f.acepta_perecederos.checked, tiene_refrigeracion: f.tiene_refrigeracion.checked, tiene_congelacion: f.tiene_congelacion.checked, horarios };
    await conCarga($("button[type=submit]", f), async () => {
      try { await api("/organizaciones/mia/capacidad/", { metodo: "PUT", datos }); aviso("Datos actualizados"); vOrganizacion(v); }
      catch (err) { errorEnCampos(f, err); }
    });
  });
}

/* ================= MAPA ================= */
function crearMapa(el, centro) {
  if (!window.L) { el.outerHTML = `<div class="tarjeta">${vacio("mapa", "Mapa no disponible", "Se necesita conexión a internet para cargar los mapas.")}</div>`; return null; }
  mapaActual = L.map(el).setView(centro, 13);
  // Teselas oficiales de OpenStreetMap. Política de uso: https://operations.osmfoundation.org/policies/tiles/
  // (HTTPS, sin subdominios, el navegador debe enviar Referer y el mapa debe mostrar la atribución).
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19, referrerPolicy: "strict-origin-when-cross-origin",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> · <a href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noopener">Reportar un error del mapa</a>',
  }).addTo(mapaActual);
  return mapaActual;
}
const punto = (m, lat, lon, color, html) => L.circleMarker([lat, lon], { radius: 9, color: "#fff", weight: 2, fillColor: color, fillOpacity: 1 }).addTo(m).bindPopup(html);

function miUbicacion() {
  return new Promise((res) => {
    if (!navigator.geolocation) { res(null); return; }
    navigator.geolocation.getCurrentPosition((p) => res({ lat: p.coords.latitude, lon: p.coords.longitude }),
      () => res(null), { enableHighAccuracy: true, timeout: 7000, maximumAge: 60000 });
  });
}
function distanciaKm(a, b) {
  const rad = (x) => (Number(x) * Math.PI) / 180;
  const dlat = rad(b.lat - a.lat), dlon = rad(b.lon - a.lon);
  const h = Math.sin(dlat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dlon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}
const COLOR_PUNTO = { voluntario: "#2563EB", recoger: "#1F7A4D", entregar: "#E8833A" };
const ETIQUETA_PUNTO = { voluntario: "Tú", recoger: "Recoger", entregar: "Entregar" };

/** Pide la ruta al backend (OSRM) y la dibuja. Devuelve los datos de la ruta. */
async function dibujarRuta(m, recogidaId, ubic, capaAnterior) {
  const q = ubic ? `?lat=${ubic.lat}&lon=${ubic.lon}` : "";
  const r = await api(`/recogidas/${recogidaId}/ruta/${q}`);
  if (capaAnterior) capaAnterior.remove();
  const capa = L.layerGroup().addTo(m);
  L.polyline(r.geometria, { color: "#13261C", weight: 8, opacity: 0.25 }).addTo(capa);
  L.polyline(r.geometria, { color: "#1F7A4D", weight: 5, opacity: 0.95, dashArray: r.fuente === "osrm" ? null : "10 8" }).addTo(capa);
  r.puntos.forEach((p) => {
    L.circleMarker([p.lat, p.lon], { radius: 11, color: "#fff", weight: 3, fillColor: COLOR_PUNTO[p.tipo], fillOpacity: 1 })
      .addTo(capa).bindTooltip(`${ETIQUETA_PUNTO[p.tipo]}: ${esc(p.nombre)}`, { permanent: p.tipo !== "voluntario", direction: "top", offset: [0, -10] });
  });
  m.fitBounds(r.geometria, { padding: [50, 50], maxZoom: 16 });
  r.capa = capa;
  return r;
}
function resumenRuta(r) {
  const fuente = r.fuente === "osrm" ? "por calles (OSRM)" : "en línea recta, aproximado (sin conexión al servicio de rutas)";
  return `<div class="resumen-ruta"><div class="td-fila"><strong style="font-size:20px">${r.distancia_km.toLocaleString("es-CO")} km</strong>
    <span class="td-meta">≈ ${r.duracion_min} min ${fuente}</span></div>
    <ol class="tramos">${r.tramos.map((t) => `<li>Hasta <b>${esc(t.hasta)}</b>: ${t.distancia_km.toLocaleString("es-CO")} km · ${t.duracion_min} min</li>`).join("")}</ol></div>`;
}
function enlacesNavegacion(r) {
  const ll = (p) => `${p.lat},${p.lon}`;
  const pts = r.puntos;
  const inicio = pts[0].tipo === "voluntario" ? pts[0] : null;
  const resto = inicio ? pts.slice(1) : pts;
  const destino = resto[resto.length - 1];
  const paradas = resto.slice(0, -1);
  const g = new URLSearchParams({ api: "1", destination: ll(destino), travelmode: "driving" });
  if (inicio) g.set("origin", ll(inicio));
  if (paradas.length) g.set("waypoints", paradas.map(ll).join("|"));
  const osm = `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${pts.map(ll).join("%3B")}`;
  return `<div class="td-fila" style="gap:8px"><a class="btn btn-primario" style="flex:1" href="https://www.google.com/maps/dir/?${g}" target="_blank" rel="noopener">${icono("ruta")} Navegar con Google Maps</a>
    <a class="btn btn-secundario" style="flex:1" href="${osm}" target="_blank" rel="noopener">${icono("mapa")} OpenStreetMap</a></div>`;
}
/** Usa la ubicación del navegador solo si está cerca de la zona de la recogida (en la simulación los datos son de Riohacha/Valledupar). */
async function ubicacionUtil(referencia) {
  const u = await miUbicacion();
  if (!u) return { ubic: null, nota: "No compartiste tu ubicación: la ruta empieza en el donante." };
  if (distanciaKm(u, referencia) > 40) return { ubic: null, nota: "Estás lejos de la zona de esta recogida (datos de simulación): la ruta empieza en el donante." };
  return { ubic: u, nota: "" };
}

async function vMapa(v) {
  titulo("Mapa");
  const [dons, recs] = await Promise.all([api("/donaciones/mapa/"), api(`/organizaciones/receptores/${YO.region ? `?region=${YO.region.id}` : ""}`)]);
  v.innerHTML = `<div id="mapa" class="mapa"></div>
    <div class="leyenda"><span><i style="background:#1F7A4D"></i>Donación activa</span><span><i style="background:#E8833A"></i>Organización receptora</span></div>
    <div class="seccion-cab"><h2>Donaciones activas (${dons.length})</h2></div>
    ${dons.length ? `<div class="lista">${dons.map(tarjetaDonacion).join("")}</div>` : vacio("caja", "No hay donaciones activas", "Cuando se publique una aparecerá aquí.")}`;
  const todos = [...dons, ...recs];
  const centro = todos.length ? [Number(todos[0].latitud), Number(todos[0].longitud)] : [11.5444, -72.9072];
  const m = crearMapa($("#mapa"), centro);
  if (!m) return;
  recs.forEach((r) => punto(m, r.latitud, r.longitud, "#E8833A", `<b>${esc(r.razon_social)}</b><br>${esc(r.categoria_display)}`));
  dons.forEach((d) => punto(m, d.latitud, d.longitud, "#1F7A4D", `<b>${esc(d.descripcion)}</b><br>${fmt.kg(d.peso_estimado_kg)} · ${esc(ESTADOS[d.estado][0])}<br><a href="#/donacion/${d.id}">Ver detalle</a>`));
  if (todos.length > 1) m.fitBounds(todos.map((x) => [Number(x.latitud), Number(x.longitud)]), { padding: [30, 30] });
}

/* ================= VOLUNTARIO ================= */
function tarjetaRecogida(r, conBoton = true) {
  return `<article class="tarjeta" style="display:flex;flex-direction:column;gap:10px">
    <div class="td-fila" style="flex-wrap:nowrap;gap:12px">${miniatura({ categoria: r.categoria, foto: r.foto, descripcion: r.descripcion })}
      <div style="flex:1"><strong style="font-size:17px">${esc(r.descripcion)}</strong><div>${chip(r.estado)}</div></div></div>
    <div class="td-fila"><span class="td-meta">${fmt.kg(r.peso_kg)} · ${esc(r.categoria)} · ${r.distancia_km} km</span>
      ${r.requiere_frio ? `<span class="etiqueta-frio">${icono("copo")} Requiere frío</span>` : ""}</div>
    <div class="ruta"><span class="punto"></span><span><b>Recoger:</b> ${esc(r.origen.razon_social)}</span>
      <span class="tramo"></span><span class="td-meta">${esc(r.origen.direccion)}</span>
      <span class="punto destino"></span><span><b>Entregar:</b> ${esc(r.destino.razon_social)}</span></div>
    ${r.estado === "ENTREGADA" ? `<span class="td-meta">Entregada ${fmt.fecha(r.entregada_en)}</span>`
      : `<span class="td-meta">Recoger antes de ${fmt.fecha(r.recogida_hasta)}</span>`}
    ${conBoton ? `<div class="td-fila" style="gap:8px"><button class="btn btn-secundario" data-ver-ruta="${r.id}" type="button" style="flex:1">${icono("ruta")} Ver ruta</button>
      <button class="btn btn-primario" data-tomar="${r.id}" type="button" style="flex:1">Tomar recogida</button></div>` : ""}
  </article>`;
}

async function vCerca(v) {
  titulo("Cerca de mí");
  const [disp, activa] = await Promise.all([api("/recogidas/disponibles/"), api("/recogidas/activa/")]);
  const p = YO.perfil_voluntario;
  v.innerHTML = `${activa ? `<div class="aviso-activa"><span>Tienes una recogida en curso</span><a class="btn btn-primario" href="#/activa">Continuar</a></div>` : ""}
    <p class="ayuda" style="margin-bottom:12px">${esc(p.tipo_vehiculo_display)} · hasta ${fmt.kg(p.capacidad_kg)}${p.tiene_cava_frio ? " · con cava de frío" : ""} · ${esc(p.region)}</p>
    ${disp.length ? `<div id="mapa" class="mapa" style="height:300px;margin-bottom:8px"></div><div id="info-ruta" class="ayuda" style="margin-bottom:16px">Toca “Ver ruta” en una recogida para ver el recorrido.</div><div class="lista">${disp.map((r) => tarjetaRecogida(r, !activa)).join("")}</div>`
      : vacio("camion", "No hay recogidas disponibles", "Cuando un receptor acepte una donación compatible con tu vehículo, aparecerá aquí.")}`;
  $$("[data-tomar]", v).forEach((b) => b.addEventListener("click", () => conCarga(b, async () => {
    try { await api(`/recogidas/${b.dataset.tomar}/tomar/`, { metodo: "POST" }); aviso("¡Recogida tomada! Ve por la donación."); location.hash = "#/activa"; }
    catch (e) { aviso(e.message, "error"); navegar(); }
  })));
  if (disp.length) {
    const m = crearMapa($("#mapa"), [Number(disp[0].origen.latitud), Number(disp[0].origen.longitud)]);
    if (m) {
      disp.forEach((r) => {
        punto(m, r.origen.latitud, r.origen.longitud, "#1F7A4D", `<b>Recoger:</b> ${esc(r.origen.razon_social)}<br>${fmt.kg(r.peso_kg)}`);
        punto(m, r.destino.latitud, r.destino.longitud, "#E8833A", `<b>Entregar:</b> ${esc(r.destino.razon_social)}`);
      });
      disp.forEach((r) => L.polyline([[r.origen.latitud, r.origen.longitud], [r.destino.latitud, r.destino.longitud]].map((p) => p.map(Number)),
        { color: "#5B6660", weight: 2, dashArray: "4 6" }).addTo(m));
      const pts = disp.flatMap((r) => [[Number(r.origen.latitud), Number(r.origen.longitud)], [Number(r.destino.latitud), Number(r.destino.longitud)]]);
      m.fitBounds(pts, { padding: [30, 30], maxZoom: 15 });
      let capa = null, ubicacion;
      $$("[data-ver-ruta]", v).forEach((b) => b.addEventListener("click", () => conCarga(b, async () => {
        const rec = disp.find((x) => String(x.id) === b.dataset.verRuta);
        if (ubicacion === undefined) ubicacion = await ubicacionUtil({ lat: rec.origen.latitud, lon: rec.origen.longitud });
        try {
          const ruta = await dibujarRuta(m, rec.id, ubicacion.ubic, capa);
          capa = ruta.capa;
          $("#info-ruta").innerHTML = `${resumenRuta(ruta)}${ubicacion.nota ? `<p class="nota">${esc(ubicacion.nota)}</p>` : ""}`;
          $("#mapa").scrollIntoView({ behavior: "smooth", block: "start" });
        } catch (e) { aviso(e.message, "error"); }
      })));
    }
  }
}

async function vActiva(v, _p, entregada = null) {
  titulo("Mi recogida");
  if (entregada) {
    v.innerHTML = `<div class="exito"><div class="circulo">${icono("check")}</div><h2>¡Donación entregada!</h2>
      <p class="ayuda">${fmt.kg(entregada.peso_kg)} llegaron a ${esc(entregada.destino.razon_social)}. ¡Gracias por ayudar! </p>
      <a class="btn btn-primario" href="#/cerca">Buscar otra recogida</a></div>`;
    return;
  }
  const r = await api("/recogidas/activa/");
  if (!r) { v.innerHTML = vacio("camion", "No tienes una recogida en curso", "Elige una de las disponibles cerca de ti.", `<a class="btn btn-primario" href="#/cerca">Ver disponibles</a>`); return; }
  const recogido = r.estado === "RECOGIDA";
  const lugar = recogido ? r.destino : r.origen;
  const pasos = [["Tomar la recogida", true], ["Recoger en el donante", recogido], ["Llevar al receptor", false], ["Confirmar con el código", false]];
  const actual = recogido ? 2 : 1;
  v.innerHTML = `<div class="formulario">
    <section class="tarjeta" style="margin-bottom:16px"><div class="td-fila" style="justify-content:space-between;margin-bottom:12px"><h2>${esc(r.codigo_donacion)}</h2>${chip(r.estado)}</div>
      <ol class="pasos-recogida">${pasos.map(([t, hecho], i) => `<li class="${hecho ? "hecho" : i === actual ? "actual" : ""}"><span class="marca-paso">${hecho ? icono("check") : i + 1}</span>${t}</li>`).join("")}</ol>
      <p class="td-meta">${esc(r.descripcion)} · ${fmt.kg(r.peso_kg)}${r.requiere_frio ? " · requiere frío" : ""}</p></section>
    <section class="tarjeta" style="display:flex;flex-direction:column;gap:12px;margin-bottom:16px">
      <h3>${icono("ruta")} Tu ruta</h3>
      <div id="mapa" class="mapa" style="height:320px"></div>
      <div id="info-ruta" class="ayuda">Calculando la ruta…</div>
      <div id="navegar"></div>
      <p class="estado-ubicacion" id="estado-ubic"></p>
    </section>
    <section class="tarjeta" style="display:flex;flex-direction:column;gap:10px">
      <span class="td-meta">${recogido ? "Entregar en" : "Recoger en"}</span><h3 style="font-size:20px">${esc(lugar.razon_social)}</h3>
      <p class="td-meta">${esc(lugar.direccion)}</p>
      <a class="btn btn-secundario" href="${enlaceMapa(lugar.latitud, lugar.longitud)}" target="_blank" rel="noopener">${icono("mapa")} Abrir en el mapa</a>
      <form id="f" novalidate style="margin-top:8px">
        ${r.requiere_frio ? campo("temperatura", "Temperatura del producto (°C, opcional)", "number", "", "4", 'step="0.1" inputmode="decimal"') : ""}
        <div class="campo"><label for="c-foto-paso">Foto de la ${recogido ? "entrega": "recogida"} (opcional)</label><input id="c-foto-paso"type="file"accept="image/*"capture="environment"></div>
        ${recogido ? `${campo("codigo", "Código que te da el receptor", "text", "", "000000", 'inputmode="numeric" maxlength="6" autocomplete="one-time-code" class="entrada-codigo"')}
          <button class="btn btn-primario btn-bloque" type="submit">${icono("check")} Confirmar entrega</button>`
        : `<button class="btn btn-primario btn-bloque" type="submit">Ya recogí la donación</button>`}
      </form>
      ${!recogido ? `<button class="btn-fantasma" id="liberar" type="button">No puedo hacerla, liberar recogida</button>` : ""}
    </section></div>`;
  $("#c-codigo")?.classList.add("entrada-codigo");
  const m = crearMapa($("#mapa"), [Number(lugar.latitud), Number(lugar.longitud)]);
  if (m) {
    (async () => {
      const { ubic, nota } = await ubicacionUtil({ lat: r.origen.latitud, lon: r.origen.longitud });
      try {
        const ruta = await dibujarRuta(m, r.id, ubic);
        if (!$("#info-ruta")) return;
        $("#info-ruta").innerHTML = `${resumenRuta(ruta)}${nota ? `<p class="nota">${esc(nota)}</p>` : ""}`;
        $("#navegar").innerHTML = enlacesNavegacion(ruta);
        compartirUbicacion(r, ruta, ubic);
      } catch (e) { if ($("#info-ruta")) $("#info-ruta").textContent = e.message; }
    })();
  } else { $("#info-ruta").textContent = ""; }
  $("#f").addEventListener("submit", async (e) => {
    e.preventDefault();
    const temperatura = e.target.temperatura?.value || null;
    const foto = $("#c-foto-paso")?.files[0];
    await conCarga($("#f button[type=submit]"), async () => {
      try {
        if (recogido && !/^\d{6}$/.test(e.target.codigo.value.trim())) { $("#e-codigo").textContent = "El código tiene 6 dígitos."; return; }
        if (foto) { try { await subirFoto(r.donacion_id, foto, recogido ? "ENTREGA" : "RECOGIDA"); } catch (err) { aviso(`La foto no se pudo subir: ${err.message}`, "error"); } }
        if (!recogido) {
          await api(`/recogidas/${r.id}/recoger/`, { metodo: "POST", datos: { temperatura } });
          aviso("Recogida registrada. Ahora llévala al receptor."); navegar();
        } else {
          const codigo = e.target.codigo.value.trim();
          if (!/^\d{6}$/.test(codigo)) { $("#e-codigo").textContent = "El código tiene 6 dígitos."; return; }
          const fin = await api(`/recogidas/${r.id}/entregar/`, { metodo: "POST", datos: { codigo, temperatura } });
          vActiva(v, null, fin);
        }
      } catch (err) { if (recogido) { $("#e-codigo").textContent = err.message; } else aviso(err.message, "error"); }
    });
  });
  $("#liberar")?.addEventListener("click", async () => {
    const x = await modal({ titulo: "¿Liberar la recogida?", confirmar: "Liberar", peligro: true,
      cuerpo: `<p class="ayuda">Volverá a estar disponible para otros voluntarios.</p><div class="campo"><label for="m-motivo">Motivo</label><input id="m-motivo" name="motivo"></div>` });
    if (!x) return;
    try { await api(`/recogidas/${r.id}/liberar/`, { metodo: "POST", datos: { motivo: x.motivo } }); aviso("Recogida liberada"); location.hash = "#/cerca"; }
    catch (e) { aviso(e.message, "error"); }
  });
}

/** Comparte la posición del voluntario cada ~15 s. Si está lejos de la zona de prueba, la simula sobre la ruta. */
function densificar(g, pasos = 12) {
  const out = [];
  for (let i = 0; i < g.length - 1; i++) for (let k = 0; k < pasos; k++) {
    const t = k / pasos; out.push([g[i][0] + (g[i + 1][0] - g[i][0]) * t, g[i][1] + (g[i + 1][1] - g[i][1]) * t]);
  }
  out.push(g[g.length - 1]);
  return out;
}
function compartirUbicacion(r, ruta, ubicReal) {
  let ultimo = 0;
  const enviar = async (lat, lon, simulada) => {
    if (Date.now() - ultimo < 12000) return;
    ultimo = Date.now();
    try {
      await api(`/recogidas/${r.id}/ubicacion/`, { metodo: "POST", datos: { lat, lon } });
      const est = $("#estado-ubic");
      if (est) est.innerHTML = `<span class="vivo">${simulada ? "Ubicación simulada (estás lejos de la zona de prueba)" : "Compartiendo tu ubicación en vivo"}</span><br>El donante y el receptor te ven en su mapa.`;
    } catch { /* se reintenta en el siguiente ciclo */ }
  };
  if (ubicReal && navigator.geolocation) {
    observadores.push(navigator.geolocation.watchPosition((p) => enviar(p.coords.latitude, p.coords.longitude, false), () => {}, { enableHighAccuracy: true, maximumAge: 10000 }));
    return;
  }
  const puntos = densificar(ruta.geometria.length > 30 ? ruta.geometria.filter((_, i) => i % Math.ceil(ruta.geometria.length / 30) === 0).concat([ruta.geometria.at(-1)]) : ruta.geometria);
  let i = 0;
  const mover = () => { const [lat, lon] = puntos[Math.min(i, puntos.length - 1)]; ultimo = 0; enviar(lat, lon, true); i += 1; };
  mover();
  temporizadores.push(setInterval(mover, 15000));
}

async function vHistorial(v) {
  titulo("Historial");
  const h = await api("/recogidas/historial/");
  const kg = h.reduce((s, r) => s + Number(r.peso_kg), 0);
  v.innerHTML = h.length ? `<section class="tarjeta-impacto" style="margin-bottom:16px"><div><span class="etq">Has llevado</span><strong class="cifra">${fmt.kg(kg)}</strong>
    <span class="etq">en ${h.length} recogidas</span></div></section><div class="lista">${h.map((r) => tarjetaRecogida(r, false)).join("")}</div>`
    : vacio("lista", "Aún no tienes entregas", "Cuando completes tu primera recogida aparecerá aquí.");
}

/* ================= ADMINISTRADOR ================= */
async function vPanel(v) {
  titulo("Panel general");
  const regiones = resultados(await api("/regiones/"));
  const pendientes = await api("/organizaciones/pendientes/");
  let region = "";
  const pinta = async () => {
    const imp = await api(`/impacto/${region ? `?region=${region}` : ""}`);
    v.innerHTML = `<p class="saludo">Panel general </p><p class="subsaludo">Así va el rescate de alimentos.</p>
      ${pendientes.length ? `<a class="aviso-activa"href="#/verificaciones"style="color:inherit"><span>${pendientes.length} ${pendientes.length === 1 ? "organización espera": "organizaciones esperan"} verificación</span><span class="btn btn-primario btn-pequeno">Revisar</span></a>`: ""}
      <div class="pestanas"><button class="pestana ${!region ? "sel" : ""}" data-r="">Todas</button>${regiones.map((r) =>
        `<button class="pestana ${String(r.id) === region ? "sel" : ""}" data-r="${r.id}">${esc(r.nombre)}</button>`).join("")}</div>
      ${panelImpacto(imp)}
      <section class="tarjeta" style="margin-top:16px;display:flex;flex-direction:column;gap:12px">
        <h3>Reportes</h3>
        <div class="fila-2">${campo("desde", "Desde", "date", "")}${campo("hasta", "Hasta", "date", "")}</div>
        <div class="td-fila"><button class="btn btn-primario" id="excel" type="button">${icono("descargar")} Descargar Excel</button>
          <button class="btn btn-acento" id="pdf-rep" type="button">${icono("documento")} Descargar PDF</button></div>
        <p class="ayuda">El Excel trae el detalle de cada donación y hojas por mes, por donante y por receptor. Se filtra por la región elegida arriba.</p>
      </section>
      <section class="tarjeta" style="margin-top:16px;display:flex;flex-direction:column;gap:10px">
        <h3>Simulación</h3>
        <p class="ayuda">Ejecuta a mano lo que en producción haría Celery Beat cada minuto: expira sugerencias sin respuesta y reasigna, marca donaciones vencidas y publica las automáticas que tocan.</p>
        <button class="btn btn-secundario" id="procesar" type="button" style="align-self:flex-start">${icono("reloj")} Procesar ahora</button>
      </section>`;
    $$("[data-r]", v).forEach((b) => b.addEventListener("click", () => { region = b.dataset.r; pinta(); }));
    const filtros = () => { const q = new URLSearchParams(); if (region) q.set("region", region); if ($("#c-desde").value) q.set("desde", $("#c-desde").value); if ($("#c-hasta").value) q.set("hasta", $("#c-hasta").value); return q.toString(); };
    $("#excel").addEventListener("click", (e) => conCarga(e.currentTarget, async () => {
      try { await descargar(`/reportes/donaciones.xlsx?${filtros()}`, `reparte_reporte.xlsx`); } catch (err) { aviso(err.message, "error"); }
    }));
    $("#pdf-rep").addEventListener("click", (e) => conCarga(e.currentTarget, async () => {
      try { await descargar(`/reportes/impacto.pdf?${filtros()}`, `reparte_impacto.pdf`); } catch (err) { aviso(err.message, "error"); }
    }));
    $("#procesar").addEventListener("click", (e) => conCarga(e.currentTarget, async () => {
      const x = await api("/simulacion/procesar/", { metodo: "POST" });
      aviso(`${x.asignaciones_expiradas} sugerencias expiradas · ${x.donaciones_vencidas} vencidas · ${x.recurrentes_publicadas} automáticas publicadas`);
    }));
  };
  await pinta();
}

async function vVerificaciones(v) {
  titulo("Verificaciones");
  const lista = await api("/organizaciones/pendientes/");
  v.innerHTML = lista.length ? `<p class="ayuda" style="margin-bottom:14px">Revisa los datos y el documento antes de aprobar. Al aprobar, la organización puede empezar a usar ReParte.</p>
    <div class="lista">${lista.map((o) => `<article class="tarjeta tarjeta-pendiente">
      <div class="td-fila"style="justify-content:space-between"><strong style="font-size:18px">${o.tipo === "DONANTE"? "": ""} ${esc(o.razon_social)}</strong><span class="chip chip-sol">${o.tipo === "DONANTE"? "Donante": "Receptor"}</span></div>
      <div class="datos">
        <div><span>Tipo</span><strong>${esc(o.categoria_display)}</strong></div><div><span>NIT</span><strong>${esc(o.nit)}</strong></div>
        <div><span>Ciudad</span><strong>${esc(o.region.nombre)}</strong></div><div><span>Dirección</span><strong>${esc(o.direccion)}</strong></div>
        <div><span>Contacto</span><strong>${esc(o.contacto?.nombre || "—")}</strong></div><div><span>Correo</span><strong style="word-break:break-all">${esc(o.contacto?.email || o.correo)}</strong></div>
        ${o.capacidad ? `<div><span>Capacidad</span><strong>${fmt.kg(o.capacidad.capacidad_kg_dia)}/día</strong></div><div><span>Personas/semana</span><strong>${fmt.num(o.capacidad.personas_atendidas)}</strong></div>` : ""}
      </div>
      <p class="td-meta">Registrada ${fmt.relativo(o.creado_en)} · ${o.documento ? `<a href="${esc(o.documento)}" target="_blank" rel="noopener">Ver documento</a>` : "sin documento adjunto"}</p>
      <div class="td-fila"><button class="btn btn-primario" data-aprobar="${o.id}" type="button">Aprobar</button>
        <button class="btn btn-peligro" data-rechazar="${o.id}" type="button">Rechazar</button></div></article>`).join("")}</div>`
    : vacio("edificio", "No hay organizaciones por verificar", "Cuando alguien se registre como donante o receptor aparecerá aquí.");
  $$("[data-aprobar]", v).forEach((b) => b.addEventListener("click", () => conCarga(b, async () => {
    await api(`/organizaciones/${b.dataset.aprobar}/verificar/`, { metodo: "POST", datos: { aprobada: true } }); aviso("Organización aprobada"); navegar();
  })));
  $$("[data-rechazar]", v).forEach((b) => b.addEventListener("click", async () => {
    const r = await modal({ titulo: "¿Rechazar el registro?", confirmar: "Rechazar", peligro: true,
      cuerpo: `<div class="campo"><label for="m-motivo">Motivo (se le enviará a la organización)</label><input id="m-motivo" name="motivo" placeholder="Ej.: el NIT no coincide"></div>` });
    if (!r) return;
    await api(`/organizaciones/${b.dataset.rechazar}/verificar/`, { metodo: "POST", datos: { aprobada: false, motivo: r.motivo } }); aviso("Registro rechazado"); navegar();
  }));
}
const vTodas = (v) => listaDonaciones(v, { tituloVista: "Todas las donaciones",
  pestanas: [["ACTIVAS", "Activas"], ["ENTREGADA", "Entregadas"], ["CANCELADA,VENCIDA", "Canceladas y vencidas"], ["", "Todas"]],
  vacioTxt: "No hay donaciones en este estado." });

/* ================= NOTIFICACIONES ================= */
async function vNotificaciones(v) {
  titulo("Notificaciones");
  const lista = resultados(await api("/notificaciones/"));
  v.innerHTML = lista.length ? `<section class="tarjeta" style="padding:0;overflow:hidden">${lista.map((n) => `
    <${n.donacion_id ? `a href="#/donacion/${n.donacion_id}"` : "div"} class="notif ${n.leida ? "" : "nueva"}" style="color:inherit;font-weight:inherit">${icono({ NUEVA_ASIGNACION: "campana", DONACION_ACEPTADA: "check", DONACION_SOLICITADA: "cesta", RECOGIDA_DISPONIBLE: "pin", VOLUNTARIO_ASIGNADO: "camion", EN_TRANSITO: "camion", ENTREGA_CONFIRMADA: "check", CALIFICACION: "estrella", VERIFICACION: "check", NUEVA_ORGANIZACION: "edificio", DONACION_VENCIDA: "reloj", DONACION_CANCELADA: "alerta" }[n.tipo] || "campana")}
      <div><strong>${esc(n.titulo)}</strong><span>${esc(n.mensaje)}</span><small>${fmt.relativo(n.enviada_en)}</small></div></${n.donacion_id ? "a" : "div"}>`).join("")}</section>`
    : vacio("campana", "Sin notificaciones", "Aquí verás los avisos de tus donaciones y recogidas.");
  if (lista.some((n) => !n.leida)) await api("/notificaciones/leer-todas/", { metodo: "POST" });
}

/* ================= arranque ================= */
const RUTAS = {
  inicio: vInicioDonante, publicar: vPublicar, donaciones: vDonaciones, donacion: vDonacion, impacto: vImpacto,
  certificados: vCertificados, pendientes: vPendientes, disponibles: vDisponibles, recibidas: vRecibidas, organizacion: vOrganizacion, mapa: vMapa,
  cerca: vCerca, activa: vActiva, historial: vHistorial, panel: vPanel, todas: vTodas, notificaciones: vNotificaciones,
  recurrentes: vRecurrentes, ranking: vRanking, verificaciones: vVerificaciones,
};

async function iniciar() {
  if (!sesion.access) { if (location.hash === "#/registro") vRegistro(); else vLogin(); return; }
  try { YO = await api("/auth/yo/"); if (organizacionPendiente()) { vEspera(); return; } marco(); await navegar(); }
  catch { sesion.cerrar(); vLogin(); }
}
window.addEventListener("hashchange", () => { if (!YO) { if (location.hash === "#/registro") vRegistro(); return; } navegar(); });
setInterval(() => { if (YO) actualizarBadge(); }, 30000);
iniciar();
