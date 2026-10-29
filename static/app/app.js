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
  cesta: '<path d="M4 10h16l-1.6 9.2a2 2 0 0 1-2 1.8H7.6a2 2 0 0 1-2-1.8z"/><path d="m9 10 3-6 3 6"/>',
  ruta: '<circle cx="6" cy="19" r="2"/><circle cx="18" cy="5" r="2"/><path d="M8 19h8.5a3.5 3.5 0 0 0 0-7h-9a3.5 3.5 0 0 1 0-7H16"/>',
  candado: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
};
const icono = (n, cls = "") => `<svg class="icono ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONOS[n] || ""}</svg>`;
const logo = (t = 32) => `<svg width="${t}" height="${t}" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="9" fill="#1F7A4D"/><path d="M9 21c0-7 5-11.5 14-12-1 9.5-5.5 14-11.5 14" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/><path d="M9 24c3-4.5 6-7 10-9" fill="none" stroke="#E8833A" stroke-width="2.4" stroke-linecap="round"/></svg>`;

const ESTADOS = {
  PUBLICADA: ["Publicada", "info"], ASIGNADA: ["Asignada", "acento"], EN_RECOGIDA: ["En recogida", "violeta"],
  EN_TRANSITO: ["En tránsito", "violeta"], ENTREGADA: ["Entregada", "exito"], CANCELADA: ["Cancelada", "gris"],
  VENCIDA: ["Vencida", "gris"], SUGERIDA: ["Por aceptar", "acento"], ACEPTADA: ["Aceptada", "exito"],
  RECHAZADA: ["Rechazada", "gris"], EXPIRADA: ["Sin respuesta", "gris"], DISPONIBLE: ["Disponible", "info"],
  TOMADA: ["Tomada", "violeta"], RECOGIDA: ["Recogida", "violeta"],
};
const chip = (e) => { const [t, c] = ESTADOS[e] || [e, "gris"]; return `<span class="chip chip-${c}">${esc(t)}</span>`; };
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
  if (datos !== undefined) headers["Content-Type"] = "application/json";
  if (sesion.access) headers.Authorization = `Bearer ${sesion.access}`;
  let r;
  try {
    r = await fetch(API + ruta, { method: metodo, headers, body: datos !== undefined ? JSON.stringify(datos) : undefined });
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
const vacio = (ic, t, txt, accion = "") => `<div class="vacio">${icono(ic)}<h3>${esc(t)}</h3><p>${esc(txt)}</p>${accion}</div>`;
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
    <div class="miniatura ${frio ? "frio" : ""}">${icono(frio ? "copo" : "caja")}</div>
    <div class="td-cuerpo">
      <strong>${esc(d.descripcion)}</strong>
      <div class="td-meta">${esc(d.codigo)} · ${fmt.kg(d.peso_estimado_kg)} · ${esc(d.categoria)}</div>
      ${otro ? `<div class="td-meta">${esc(otro)}</div>` : ""}
      <div class="td-fila">${chip(d.estado)}${ACTIVOS.includes(d.estado) ? `<span class="td-vence">Apto hasta ${fmt.fecha(d.fecha_limite_consumo)}</span>` : ""}</div>
      ${d.codigo_entrega && ACTIVOS.includes(d.estado) ? `<div class="codigo-entrega">Código de entrega <b>${esc(d.codigo_entrega)}</b></div>` : ""}
    </div></a>`;
}

/* ---------------- marco y navegación ---------------- */
const MENUS = {
  // [ruta, texto del menú lateral, ícono, texto corto para la barra inferior del celular]
  DONANTE: [["inicio", "Inicio", "inicio", "Inicio"], ["publicar", "Publicar", "mas", "Publicar"], ["donaciones", "Donaciones", "lista", "Donaciones"], ["impacto", "Impacto", "grafico", "Impacto"], ["certificados", "Certificados", "medalla", "Certificados"]],
  RECEPTOR: [["pendientes", "Por aceptar", "reloj", "Aceptar"], ["disponibles", "Elegir excedentes", "cesta", "Elegir"], ["recibidas", "Recibidas", "caja", "Recibidas"], ["organizacion", "Mi organización", "edificio", "Perfil"], ["impacto", "Impacto", "grafico", "Impacto"]],
  VOLUNTARIO: [["cerca", "Cerca de mí", "pin", "Cerca"], ["activa", "Mi recogida", "camion", "Recogida"], ["historial", "Historial", "lista", "Historial"], ["impacto", "Impacto", "grafico", "Impacto"]],
  ADMIN: [["panel", "Panel", "grafico", "Panel"], ["todas", "Donaciones", "lista", "Donaciones"], ["mapa", "Mapa", "mapa", "Mapa"]],
};
const ROL_TEXTO = { DONANTE: "Donante", RECEPTOR: "Receptor", VOLUNTARIO: "Voluntario", ADMIN: "Administrador" };
const menu = () => MENUS[YO.rol] || MENUS.ADMIN;
const nombreVisible = () => YO.organizacion?.razon_social || YO.nombre || YO.email;

function marco() {
  const items = menu();
  $("#app").innerHTML = `<div class="marco">
    <aside class="lateral">
      <div class="marca">${logo()}<span>ReParte</span></div>
      <nav class="nav-lateral" aria-label="Menú">${items.map(([r, t, i]) => `<a href="#/${r}" data-ruta="${r}">${icono(i)}<span>${t}</span></a>`).join("")}</nav>
      <div class="lateral-pie"><div class="usuario-mini"><strong>${esc(nombreVisible())}</strong><span>${ROL_TEXTO[YO.rol] || ""}${YO.region ? ` · ${esc(YO.region.nombre)}` : ""}</span></div>
      <button class="btn-fantasma" data-salir type="button">${icono("salir")} Salir</button></div>
    </aside>
    <header class="barra"><div class="marca marca-movil">${logo(28)}</div><h1 id="titulo" class="barra-titulo"></h1>
      <a href="#/notificaciones" class="campana" aria-label="Notificaciones">${icono("campana")}<span id="badge" class="badge" hidden></span></a>
      <button class="btn-icono solo-movil" data-salir type="button" aria-label="Salir">${icono("salir")}</button></header>
    <main id="vista" class="vista"></main>
    <nav class="nav-inferior" aria-label="Menú">${items.map(([r, , i, corto]) => `<a href="#/${r}" data-ruta="${r}">${icono(i)}<span>${corto}</span></a>`).join("")}</nav>
  </div>`;
  $$("[data-salir]").forEach((b) => b.addEventListener("click", salir));
}
function titulo(t) { const h = $("#titulo"); if (h) h.textContent = t; document.title = `${t} · ReParte`; }

let temporizadores = [];
let mapaActual = null;
function limpiar() {
  temporizadores.forEach(clearInterval); temporizadores = [];
  if (mapaActual) { mapaActual.remove(); mapaActual = null; }
}
const RUTAS_COMUNES = ["donacion", "notificaciones"];

async function navegar() {
  if (!YO) return;
  const [ruta, param] = location.hash.replace(/^#\/?/, "").split("/");
  const permitidas = menu().map((m) => m[0]).concat(RUTAS_COMUNES);
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

/* ================= LOGIN ================= */
function vLogin() {
  document.title = "Ingresar · ReParte";
  const grupos = [...new Set(DEMO.map((d) => d.grupo))];
  $("#app").innerHTML = `<div class="login">
    <div class="login-marca">${logo(56)}<h1>ReParte</h1><p>Excedentes de alimentos que llegan a quien los necesita.</p></div>
    <form class="tarjeta login-form" id="f-login" novalidate>
      <h2>Ingresar</h2>
      ${campo("email", "Correo", "email", "", "tu@correo.com", 'autocomplete="username" required')}
      ${campo("password", "Contraseña", "password", "", "", 'autocomplete="current-password" required')}
      <p class="error-campo" id="e-general" role="alert"></p>
      <button class="btn btn-primario btn-bloque" type="submit">Ingresar</button>
    </form>
    <section class="demo"><h3>Usuarios de prueba</h3>
      <p class="ayuda">Toca uno para entrar. Clave de todos: <code>${CLAVE_DEMO}</code>. El administrador es tu superusuario.</p>
      ${grupos.map((g) => `<div class="demo-lista"><p class="ayuda"><b>${g}</b></p>${DEMO.filter((d) => d.grupo === g).map((d) =>
        `<button class="demo-btn" type="button" data-email="${d.email}"><strong>${esc(d.nombre)}</strong><span>${esc(d.email.split("@")[0])}</span></button>`).join("")}</div>`).join("")}
    </section></div>`;
  const f = $("#f-login");
  f.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = f.email.value.trim(), password = f.password.value;
    if (!email || !password) { $("#e-general").textContent = "Escribe tu correo y contraseña."; return; }
    await conCarga($("button[type=submit]", f), async () => {
      sesion.cerrar();
      try {
        const t = await api("/auth/token/", { metodo: "POST", datos: { email, password }, reintento: false });
        sesion.guardar(t.access, t.refresh);
        YO = await api("/auth/yo/");
        marco();
        if (!location.hash || location.hash === "#/") location.hash = `#/${menu()[0][0]}`; else navegar();
      } catch (err) {
        $("#e-general").textContent = err.status === 401 ? "Correo o contraseña incorrectos." : err.message;
      }
    });
  });
  $$(".demo-btn").forEach((b) => b.addEventListener("click", () => {
    f.email.value = b.dataset.email; f.password.value = CLAVE_DEMO; f.requestSubmit();
  }));
}

/* ================= DONANTE ================= */
async function vInicioDonante(v) {
  titulo("Inicio");
  const [imp, act] = await Promise.all([api("/impacto/"), api("/donaciones/?estado=ACTIVAS")]);
  const lista = resultados(act);
  v.innerHTML = `<p class="saludo">Hola, ${esc(YO.organizacion?.razon_social)}</p>
    <section class="tarjeta-impacto">
      <div><span class="etq">Has rescatado</span><strong class="cifra">${fmt.kg(imp.kg_rescatados)}</strong>
      <span class="etq">${imp.donaciones_entregadas} ${imp.donaciones_entregadas === 1 ? "donación entregada" : "donaciones entregadas"} · ≈ ${fmt.num(imp.raciones_equivalentes)} raciones</span></div>
      <a class="btn btn-claro" href="#/impacto">Ver impacto</a>
    </section>
    <div class="seccion-cab"><h2>Donaciones activas</h2><a href="#/donaciones">Ver todas</a></div>
    ${lista.length ? `<div class="lista">${lista.map(tarjetaDonacion).join("")}</div>`
      : vacio("caja", "No tienes donaciones activas", "Publica un excedente y te avisaremos cuando un receptor lo acepte.")}
    <a class="fab" href="#/publicar">${icono("mas")}<span>Publicar excedente</span></a>`;
}

async function vPublicar(v) {
  titulo("Publicar excedente");
  const cats = await api("/categorias/");
  const ahora = new Date();
  const st = { paso: 1, categoria: null, descripcion: "", cantidad: "", unidad: "KG", peso: "", condicion: "AMBIENTE",
    limite: local(sumarMin(ahora, 24 * 60)), desde: local(sumarMin(ahora, 30)), hasta: local(sumarMin(ahora, 180)) };
  const UNIDADES = { KG: "kg", UNIDAD: "unidades", LITRO: "litros", CAJA: "cajas" };
  const CONDICIONES = { AMBIENTE: "Ambiente", REFRIGERADO: "Refrigerado", CONGELADO: "Congelado" };

  const pasoHtml = () => {
    if (st.paso === 1) return `
      <fieldset><legend>¿Qué vas a donar?</legend><div class="opciones-cat">${cats.map((c) =>
        `<button type="button" class="opcion ${st.categoria === c.id ? "sel" : ""}" data-cat="${c.id}" aria-pressed="${st.categoria === c.id}">${icono(c.requiere_frio ? "copo" : "caja")}<span>${esc(c.nombre)}</span></button>`).join("")}</div>
      <p class="error-campo" id="e-categoria"></p></fieldset>
      ${campo("descripcion", "Descripción", "text", st.descripcion, "Ej.: tomate, cebolla y papa en buen estado", 'maxlength="300"')}`;
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
      <div class="tarjeta"><h3 style="margin-bottom:12px">Resumen</h3><dl class="resumen">
        <dt>Qué</dt><dd>${esc(st.descripcion)} · ${esc(cat?.nombre)}</dd>
        <dt>Cantidad</dt><dd>${esc(st.cantidad)} ${UNIDADES[st.unidad]}${st.unidad !== "KG" ? ` (≈ ${esc(st.peso)} kg)` : ""}</dd>
        <dt>Conservación</dt><dd>${CONDICIONES[st.condicion]}</dd>
        <dt>Apto hasta</dt><dd>${fmt.fecha(st.limite)}</dd></dl></div>
      <p class="error-campo" id="e-fecha_limite_consumo"></p>`;
  };
  const pinta = () => {
    v.innerHTML = `<div class="formulario">${stepper(st.paso, ["Qué donas", "Cantidad", "Recogida"])}
      <form id="f" novalidate>${pasoHtml()}
      <div class="acciones">${st.paso > 1 ? `<button class="btn btn-secundario" type="button" id="atras">Atrás</button>` : "<span></span>"}
      <button class="btn btn-primario" type="submit">${st.paso < 3 ? "Siguiente" : "Publicar"}</button></div></form></div>`;
    const f = $("#f");
    $$("[data-cat]", f).forEach((b) => b.addEventListener("click", () => { st.categoria = Number(b.dataset.cat); guardar(); pinta(); }));
    $$("[data-cond]", f).forEach((b) => b.addEventListener("click", () => { st.condicion = b.dataset.cond; guardar(); pinta(); }));
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
        const sug = d.asignaciones.find((a) => a.estado === "SUGERIDA");
        aviso(sug ? `Publicada y sugerida a ${sug.receptor}` : "Publicada. Por ahora no hay receptor disponible.");
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
  v.innerHTML = `<button class="volver" type="button" id="volver">${icono("atras")} Volver</button>
  <div class="detalle"><div style="display:grid;gap:16px">
    <section class="tarjeta cab-detalle"><div class="td-fila">${chip(d.estado)}<span class="td-meta">${esc(d.codigo)}</span></div>
      <h2>${esc(d.descripcion)}</h2>
      ${d.codigo_entrega && ACTIVOS.includes(d.estado) ? `<div class="codigo-grande"><span>Dale este código al voluntario cuando llegue</span><strong>${esc(d.codigo_entrega)}</strong></div>` : ""}
      <div class="datos" style="margin-top:8px">
        <div><span>Categoría</span><strong>${esc(d.categoria)}</strong></div>
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
    ${d.certificado ? `<section class="tarjeta"><div class="td-fila" style="margin-bottom:8px">${icono("medalla")}<h3>Certificado ${esc(d.certificado.consecutivo)}</h3></div>
      <p>${fmt.kg(d.certificado.kg)} entregados el ${fmt.dia(d.certificado.emitido_en)}.</p><p class="hash" title="Huella SHA-256">${esc(d.certificado.hash)}</p></section>` : ""}
    ${(esDonante || esAdmin) && d.asignaciones.length ? `<section class="tarjeta"><h3 style="margin-bottom:8px">Intentos de asignación</h3><div class="tabla-scroll"><table class="tabla">
      <tr><th>#</th><th>Receptor</th><th>Puntaje</th><th>Distancia</th><th>Estado</th></tr>
      ${d.asignaciones.map((a) => `<tr><td>${a.intento}</td><td>${esc(a.receptor)}</td><td>${Number(a.puntaje).toFixed(3)}</td><td>${a.distancia_km} km</td><td>${chip(a.estado)}</td></tr>`).join("")}
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
  $("#explicar")?.addEventListener("click", async () => {
    const x = await api(`/simulacion/puntaje/${id}/`);
    $("#explicacion").innerHTML = x.candidatos.length ? `<p class="nota">Receptores que aún no han recibido esta sugerencia, con pesos w1–w4 = ${Object.values(x.pesos).join(" · ")}</p>
      <div class="tabla-scroll"><table class="tabla"><tr><th>Receptor</th><th>km</th><th>Prox.</th><th>Urg.</th><th>Nec.</th><th>Eq.</th><th>Puntaje</th></tr>
      ${x.candidatos.map((c) => `<tr><td>${esc(c.receptor)}</td><td>${c.distancia_km}</td><td>${c.factores.proximidad}</td><td>${c.factores.urgencia}</td><td>${c.factores.necesidad}</td><td>${c.factores.equidad}</td><td><b>${c.puntaje}</b></td></tr>`).join("")}</table></div>`
      : `<p class="nota">No quedan otros receptores compatibles para esta donación.</p>`;
  });
}

async function vImpacto(v) {
  const imp = await api("/impacto/");
  titulo("Impacto");
  v.innerHTML = panelImpacto(imp);
}
function panelImpacto(imp) {
  const max = Math.max(1, ...imp.por_mes.map((m) => Number(m.kg)));
  const co2 = Number(imp.kg_co2_evitados);
  return `<p class="ayuda" style="margin-bottom:12px">Alcance: <b>${esc(imp.alcance)}</b></p>
    <div class="estadisticas">
      <div class="estadistica"><strong>${fmt.kg(imp.kg_rescatados)}</strong><span>rescatados</span></div>
      <div class="estadistica"><strong>${fmt.num(imp.donaciones_entregadas)}</strong><span>donaciones entregadas</span></div>
      <div class="estadistica"><strong>${fmt.num(imp.raciones_equivalentes)}</strong><span>raciones equivalentes</span></div>
      <div class="estadistica"><strong>${fmt.num(imp.receptores_atendidos)}</strong><span>receptores atendidos</span></div>
      <div class="estadistica"><strong>${fmt.num(imp.voluntarios_activos)}</strong><span>voluntarios activos</span></div>
      <div class="estadistica"><strong>${co2 ? fmt.kg(co2) : "Por definir"}</strong><span>CO₂ evitado</span></div>
    </div>
    <section class="tarjeta" style="margin-top:16px"><h3>Kilos rescatados por mes</h3>
      ${imp.por_mes.length ? `<div class="grafico" role="img" aria-label="Gráfico de kilos por mes">${imp.por_mes.map((m) =>
        `<div class="barra-col"><span class="v">${fmt.num(m.kg)}</span><div class="b" style="height:${(Number(m.kg) / max) * 85}%"></div><small>${fmt.mes(m.mes)}</small></div>`).join("")}</div>`
      : vacio("grafico", "Aún no hay entregas", "Cuando se entregue la primera donación verás aquí el avance.")}
      <p class="nota">Supuesto: 1 ración ≈ ${esc(imp.supuestos.kg_por_racion)} kg. El factor de CO₂ por categoría está por definir con fuentes.</p>
    </section>`;
}

async function vCertificados(v) {
  titulo("Certificados");
  const certs = await api("/certificados/");
  v.innerHTML = certs.length ? `<div class="lista">${certs.map((c) => `<div class="tarjeta"><div class="td-fila" style="justify-content:space-between">
      <h3>${esc(c.consecutivo)}</h3><span class="td-meta">${fmt.dia(c.emitido_en)}</span></div>
      <p style="margin:6px 0">${esc(c.descripcion)} · <b>${fmt.kg(c.kg_certificados)}</b></p>
      <p class="td-meta">Entregado a ${esc(c.receptor || "—")} · ${esc(c.codigo_donacion)}</p>
      <p class="hash" style="margin-top:8px">${esc(c.hash_sha256)}</p></div>`).join("")}</div>`
    : vacio("medalla", "Aún no tienes certificados", "Se emiten automáticamente cuando una donación se entrega.");
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
          <div class="portada ${frio ? "frio" : ""}">${icono(frio ? "copo" : "caja")}</div>
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
        <div class="miniatura ${frio ? "frio" : ""}">${icono(frio ? "copo" : "caja")}</div>
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

async function vOrganizacion(v) {
  const o = await api("/organizaciones/mia/");
  titulo("Mi organización");
  const c = o.capacidad || {};
  const si = (b) => (b ? "Sí" : "No");
  v.innerHTML = `<div class="detalle"><section class="tarjeta cab-detalle">
      <span class="td-meta">${esc(o.categoria_display)} · ${esc(o.region.nombre)}</span><h2>${esc(o.razon_social)}</h2>
      <div class="datos" style="margin-top:8px">
        <div><span>NIT</span><strong>${esc(o.nit)}</strong></div><div><span>Estado</span><strong>${o.estado_verificacion === "VERIFICADA" ? "Verificada" : esc(o.estado_verificacion)}</strong></div>
        <div><span>Dirección</span><strong>${esc(o.direccion)}</strong></div><div><span>Teléfono</span><strong>${esc(o.telefono)}</strong></div>
      </div></section>
    <section class="tarjeta"><h3 style="margin-bottom:12px">Capacidad</h3><div class="datos">
      <div><span>Recibe por día</span><strong>${fmt.kg(c.capacidad_kg_dia)}</strong></div>
      <div><span>Personas por semana</span><strong>${fmt.num(c.personas_atendidas)}</strong></div>
      <div><span>Refrigeración</span><strong>${si(c.tiene_refrigeracion)}</strong></div>
      <div><span>Congelación</span><strong>${si(c.tiene_congelacion)}</strong></div>
      <div><span>Radio de recepción</span><strong>${fmt.num(c.radio_max_km)} km</strong></div>
      <div><span>Nivel de necesidad</span><strong class="niveles" aria-label="${c.nivel_necesidad} de 5">${[1, 2, 3, 4, 5].map((n) => `<i class="${n <= c.nivel_necesidad ? "on" : ""}"></i>`).join("")}</strong></div>
    </div>
    <h3 style="margin:20px 0 8px">Horario de recepción</h3>
    ${o.horarios.length ? `<table class="tabla">${o.horarios.map((h) => `<tr><td>${esc(h.dia)}</td><td>${h.hora_inicio.slice(0, 5)} – ${h.hora_fin.slice(0, 5)}</td></tr>`).join("")}</table>` : `<p class="ayuda">Sin horario registrado.</p>`}
    <p class="nota">En la versión final la organización podrá editar estos datos; el nivel de necesidad lo asigna el administrador.</p></section></div>`;
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
    <div class="td-fila" style="justify-content:space-between"><strong>${esc(r.descripcion)}</strong>${chip(r.estado)}</div>
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
      <p class="ayuda">${fmt.kg(entregada.peso_kg)} llegaron a ${esc(entregada.destino.razon_social)}. Gracias por ayudar.</p>
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
    </section>
    <section class="tarjeta" style="display:flex;flex-direction:column;gap:10px">
      <span class="td-meta">${recogido ? "Entregar en" : "Recoger en"}</span><h3 style="font-size:20px">${esc(lugar.razon_social)}</h3>
      <p class="td-meta">${esc(lugar.direccion)}</p>
      <a class="btn btn-secundario" href="${enlaceMapa(lugar.latitud, lugar.longitud)}" target="_blank" rel="noopener">${icono("mapa")} Abrir en el mapa</a>
      <form id="f" novalidate style="margin-top:8px">
        ${r.requiere_frio ? campo("temperatura", "Temperatura del producto (°C, opcional)", "number", "", "4", 'step="0.1" inputmode="decimal"') : ""}
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
      } catch (e) { if ($("#info-ruta")) $("#info-ruta").textContent = e.message; }
    })();
  } else { $("#info-ruta").textContent = ""; }
  $("#f").addEventListener("submit", async (e) => {
    e.preventDefault();
    const temperatura = e.target.temperatura?.value || null;
    await conCarga($("#f button[type=submit]"), async () => {
      try {
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
  let region = "";
  const pinta = async () => {
    const imp = await api(`/impacto/${region ? `?region=${region}` : ""}`);
    v.innerHTML = `<div class="td-fila" style="justify-content:space-between;margin-bottom:16px">
        <div class="pestanas" style="margin:0"><button class="pestana ${!region ? "sel" : ""}" data-r="">Todas</button>${regiones.map((r) =>
          `<button class="pestana ${String(r.id) === region ? "sel" : ""}" data-r="${r.id}">${esc(r.nombre)}</button>`).join("")}</div>
        <button class="btn btn-secundario" id="procesar" type="button">${icono("reloj")} Procesar vencimientos</button></div>
      ${panelImpacto(imp)}
      <p class="nota">“Procesar vencimientos” ejecuta a mano lo que en producción haría Celery Beat cada minuto: expira sugerencias sin respuesta y reasigna, y marca donaciones vencidas.</p>`;
    $$("[data-r]", v).forEach((b) => b.addEventListener("click", () => { region = b.dataset.r; pinta(); }));
    $("#procesar").addEventListener("click", (e) => conCarga(e.currentTarget, async () => {
      const x = await api("/simulacion/procesar/", { metodo: "POST" });
      aviso(`${x.asignaciones_expiradas} sugerencias expiradas · ${x.donaciones_vencidas} donaciones vencidas`);
    }));
  };
  await pinta();
}
const vTodas = (v) => listaDonaciones(v, { tituloVista: "Todas las donaciones",
  pestanas: [["ACTIVAS", "Activas"], ["ENTREGADA", "Entregadas"], ["CANCELADA,VENCIDA", "Canceladas y vencidas"], ["", "Todas"]],
  vacioTxt: "No hay donaciones en este estado." });

/* ================= NOTIFICACIONES ================= */
async function vNotificaciones(v) {
  titulo("Notificaciones");
  const lista = resultados(await api("/notificaciones/"));
  v.innerHTML = lista.length ? `<section class="tarjeta" style="padding:0;overflow:hidden">${lista.map((n) => `
    <${n.donacion_id ? `a href="#/donacion/${n.donacion_id}"` : "div"} class="notif ${n.leida ? "" : "nueva"}" style="color:inherit">${icono("campana")}
      <div><strong>${esc(n.titulo)}</strong><span>${esc(n.mensaje)}</span><small>${fmt.relativo(n.enviada_en)}</small></div></${n.donacion_id ? "a" : "div"}>`).join("")}</section>`
    : vacio("campana", "Sin notificaciones", "Aquí verás los avisos de tus donaciones y recogidas.");
  if (lista.some((n) => !n.leida)) await api("/notificaciones/leer-todas/", { metodo: "POST" });
}

/* ================= arranque ================= */
const RUTAS = {
  inicio: vInicioDonante, publicar: vPublicar, donaciones: vDonaciones, donacion: vDonacion, impacto: vImpacto,
  certificados: vCertificados, pendientes: vPendientes, disponibles: vDisponibles, recibidas: vRecibidas, organizacion: vOrganizacion, mapa: vMapa,
  cerca: vCerca, activa: vActiva, historial: vHistorial, panel: vPanel, todas: vTodas, notificaciones: vNotificaciones,
};

async function iniciar() {
  if (!sesion.access) { vLogin(); return; }
  try { YO = await api("/auth/yo/"); marco(); await navegar(); }
  catch { sesion.cerrar(); vLogin(); }
}
window.addEventListener("hashchange", navegar);
setInterval(() => { if (YO) actualizarBadge(); }, 30000);
iniciar();
