let sidgadCurrentSeasonId = "";

const SIDGAD_DEFAULT_LOGO = "https://www.sidgad.com/shared/images/no_logo.png";

/* ===== Idioma ===== */

// Los textos de la web están en assets/i18n/<idioma>.js, también los del español (es.js):
// index.php carga el de la web y el oficial del acta, que los añaden a SIDGAD_TEXTOS_IDIOMAS.
// La clave es el texto en español del código; lo que no esté en el diccionario se ve tal cual. {nombre} en el texto se cambia por vars.nombre. Si un mismo texto español
// necesita traducciones distintas, la clave lleva el contexto tras '|' ('PE|empatados'), que en
// español no se ve.
const SIDGAD_LENGUA = typeof SIDGAD_IDIOMA === 'string' ? SIDGAD_IDIOMA : 'es';
const SIDGAD_LENGUA_ACTA = typeof SIDGAD_IDIOMA_ACTA === 'string' ? SIDGAD_IDIOMA_ACTA : 'es'; // hoja oficial
const SIDGAD_LOCALE = { es: 'es-ES', gl: 'gl-ES', ca: 'ca-ES', en: 'en-GB', fr: 'fr-FR', it: 'it-IT' }[SIDGAD_LENGUA] || 'es-ES';

function sidgadTEn(idioma, texto, vars = null) {
  const textos = typeof SIDGAD_TEXTOS_IDIOMAS === 'object' ? SIDGAD_TEXTOS_IDIOMAS[idioma] : null;
  const traducido = textos?.[texto] || texto.split('|')[0];
  return vars ? traducido.replace(/\{(\w+)\}/g, (m, clave) => (clave in vars ? vars[clave] : m)) : traducido;
}

function sidgadT(texto, vars = null) {
  return sidgadTEn(SIDGAD_LENGUA, texto, vars);
}

// Textos fijos que manda la API en español: estados del partido ("DESCANSO", "PERIODO 1"...) y
// "JORNADA 3". Lo que no esté en el diccionario se ve tal cual.
function sidgadTApi(texto, idioma = SIDGAD_LENGUA) {
  const limpio = String(texto ?? '').trim();
  if (!limpio || limpio.includes('|')) return limpio;
  const jornada = limpio.match(/^JORNADA\s+(\d+)$/i);
  if (jornada) return sidgadTEn(idioma, limpio === limpio.toUpperCase() ? 'JORNADA {n}' : 'Jornada {n}', { n: jornada[1] });
  return sidgadTEn(idioma, limpio);
}

// Con número: sidgadTn('{n} jugador', '{n} jugadores', n).
function sidgadTn(singular, plural, n) {
  return sidgadT(n === 1 ? singular : plural, { n });
}

// Selector de idioma: se guarda la elección y se recarga la página en ese idioma.
document.addEventListener('change', (event) => {
  if (!event.target.classList.contains('sidgad-selector-idioma')) return;
  document.cookie = `sidgad_idioma=${encodeURIComponent(event.target.value)}; path=/; max-age=31536000; SameSite=Lax`;
  const url = new URL(location.href);
  url.searchParams.delete('lang');
  location.replace(url);
});

/* ===== API ===== */

/* Permiso de sesion para pedir datos a la API */
const SIDGAD_PERMISO_URL = 'https://www.server2.sidgad.es/sg_token.php';
let sidgadPermiso = null;
let sidgadPermisoEnCurso = null;
try { sidgadPermiso = JSON.parse(sessionStorage.getItem('sg_tok') || 'null'); } catch (e) {}
function sidgadPedirPermiso() {
  if (!sidgadPermisoEnCurso) {
    sidgadPermisoEnCurso = (async () => {
      try {
        const r = await fetch(SIDGAD_PERMISO_URL, { cache: 'no-store' });
        if (r.ok) {
          const o = await r.json();
          if (o.t && o.e) {
            sidgadPermiso = { t: o.t, e: o.e, l: Date.now() + 1700000 };
            try { sessionStorage.setItem('sg_tok', JSON.stringify(sidgadPermiso)); } catch (e) {}
          }
        }
      } catch (e) {}
      finally { sidgadPermisoEnCurso = null; }
    })();
  }
  return sidgadPermisoEnCurso;
}
async function sidgadConPermiso(url) {
  if (!sidgadPermiso || sidgadPermiso.l < Date.now() + 120000) await sidgadPedirPermiso();
  return sidgadPermiso ? `${url}&st=${sidgadPermiso.t}&se=${sidgadPermiso.e}` : url;
}

const sidgadApiCache = new Map();

// Last-Modified de cada respuesta (cuándo generó la API ese JSON), para depurar: sidgadFechaApi(data).
const sidgadApiFechas = new WeakMap();
function sidgadFechaApi(data) {
  return data && typeof data === 'object' ? sidgadApiFechas.get(data) || null : null;
}

// Para datos que se transforman antes de pintarse (p. ej. las clasificaciones agrupadas).
function sidgadCopiarFechaApi(origen, destino) {
  const fecha = sidgadFechaApi(origen);
  if (fecha && destino && typeof destino === 'object') sidgadApiFechas.set(destino, fecha);
  return destino;
}

// "Informe generado el ..." con el Last-Modified de los datos que usa una vista: { calendar, stats }.
// Con varios recursos, cada fecha lleva el suyo entre paréntesis. "" si ninguno trae fecha.
function sidgadTextoGenerado(datos = {}) {
  const fechas = Object.entries(datos)
    .map(([recurso, data]) => [recurso, sidgadFechaGmt(sidgadFechaApi(data))])
    .filter(([, fecha]) => fecha);
  const fecha = fechas.length === 1 ? fechas[0][1] : fechas.map(([recurso, f]) => `${f} (${recurso})`).join(' · ');
  return fecha ? sidgadT('Informe generado el {fecha}', { fecha }) : '';
}

// El mismo texto como pie, para las fichas que se pintan con innerHTML.
function sidgadPieDatosHtml(datos) {
  const texto = sidgadTextoGenerado(datos);
  return texto ? `<p class="sidgad-liga-generado">${escaparHtml(texto)}</p>` : '';
}

// Pie de las vistas de liga, bajo #sidgad-liga-main-content. Sin argumentos, lo vacía.
function sidgadPieDatosLiga(datos = {}) {
  const mainContent = document.getElementById('sidgad-liga-main-content');
  if (!mainContent) return;
  let pie = document.getElementById('sidgad-liga-generado');
  if (!pie) {
    pie = crearNodo('p', { id: 'sidgad-liga-generado', class: 'sidgad-liga-generado' });
    mainContent.after(pie);
  }
  pie.textContent = sidgadTextoGenerado(datos);
  pie.hidden = !pie.textContent;
}

// "12-11-2026 21:39:01 GMT", como en los portales anteriores.
function sidgadFechaGmt(fecha) {
  if (!(fecha instanceof Date) || isNaN(fecha)) return '';
  const d = n => String(n).padStart(2, '0');
  return `${d(fecha.getUTCDate())}-${d(fecha.getUTCMonth() + 1)}-${fecha.getUTCFullYear()} ${d(fecha.getUTCHours())}:${d(fecha.getUTCMinutes())}:${d(fecha.getUTCSeconds())} GMT`;
}

class SidgadApiError extends Error {
  constructor(status) {
    super(`SIDGAD API: ${status}`);
    this.name = 'SidgadApiError';
    this.status = status;
  }
}

function sidgadApiUrl(recurso, params = {}) {
  const { url, cliente, version, idm, token } = SIDGAD_API_CONFIG;
  const query = new URLSearchParams({ ...params, jwt: token });
  return `${url}/${cliente}/${version}/${idm}/${recurso}/?${query}`;
}

// La API responde 200 con {"status": "INVALID TOKEN" | "NO FILE"} en los errores de negocio.
async function sidgadFetch(recurso, params = {}, { cache = false } = {}) {
  const url = sidgadApiUrl(recurso, params);
  if (cache && sidgadApiCache.has(url)) return sidgadApiCache.get(url);

  const peticion = (async () => {
    const res = await fetch(await sidgadConPermiso(url));
    if (!res.ok) throw new SidgadApiError(`HTTP ${res.status}`);
    const data = await res.json();
    if (data && !Array.isArray(data) && typeof data.status === 'string') throw new SidgadApiError(data.status);
    const modificado = res.headers.get('Last-Modified');
    if (modificado && data && typeof data === 'object') sidgadApiFechas.set(data, new Date(modificado));
    return data;
  })();

  if (cache) {
    sidgadApiCache.set(url, peticion);
    peticion.catch(() => sidgadApiCache.delete(url));
  }
  return peticion;
}

// Partidos con bonus de una liga: idp -> { home, away }. Sale del calendario porque ni /report/ ni
// /profile/ traen home_bonus/away_bonus.
async function sidgadBonusLiga(ligaId) {
  if (!ligaId) return new Map();
  try {
    const cal = await sidgadFetch('calendar', { id: ligaId }, { cache: true });
    return new Map((cal?.games || [])
      .filter(g => g.home_bonus === 'true' || g.away_bonus === 'true')
      .map(g => [String(g.idp), { home: g.home_bonus === 'true', away: g.away_bonus === 'true' }]));
  } catch {
    return new Map();
  }
}

/* ===== Vídeos ===== */

// url_video es el id del vídeo en YouTube, Vimeo y Dailymotion (tipo_video) y la URL completa en
// el resto. embed = reproductor para el iframe; si no, la página del vídeo.
const SIDGAD_VIDEO_WEBS = {
  youtube: { embed: id => `https://www.youtube.com/embed/${id}?autoplay=1`, pagina: id => `https://www.youtube.com/watch?v=${id}` },
  vimeo: { embed: id => `https://player.vimeo.com/video/${id}?autoplay=1`, pagina: id => `https://vimeo.com/${id}` },
  dailymotion: { embed: id => `https://www.dailymotion.com/embed/video/${id}?autoplay=1`, pagina: id => `https://www.dailymotion.com/video/${id}` },
};

function sidgadVideoUrl(url, tipo, { embed = false } = {}) {
  const texto = String(url || '').trim();
  const web = SIDGAD_VIDEO_WEBS[String(tipo || '').toLowerCase()];
  if (!texto || !web || /^https?:\/\//i.test(texto)) return texto;
  const id = encodeURIComponent(texto);
  return embed ? web.embed(id) : web.pagina(id);
}

// En la capa del portal (has_video_overlay) si la web se puede incrustar; si no, en otra pestaña.
function sidgadAbrirVideo(url, tipo) {
  const incrustable = !!SIDGAD_VIDEO_WEBS[String(tipo || '').toLowerCase()];
  if (incrustable && typeof window.videoOpener === 'function') window.videoOpener(sidgadVideoUrl(url, tipo, { embed: true }));
  else if (url) window.open(sidgadVideoUrl(url, tipo), '_blank', 'noopener');
}

// Nombre de persona de la API: "" si sólo trae la coma de "APELLIDOS, NOMBRE" vacíos (", ").
function sidgadNombrePersona(nombre) {
  const texto = String(nombre ?? '').trim();
  return /[^\s,]/.test(texto) ? texto : '';
}

// La API serializa los números como cadenas y usa "", "-" o "–" para "sin dato".
function sidgadNum(valor) {
  if (valor === null || valor === undefined) return null;
  const texto = String(valor).trim();
  if (texto === '' || texto === '-' || texto === '–' || texto === '--') return null;
  const numero = Number(texto);
  return Number.isFinite(numero) ? numero : null;
}

// Tiempo de sanción. Actas nuevas: texto ya formateado ("1’30\"", "3’");
// actas antiguas: número en minutos ("2", "16"). Se devuelve en segundos.
function sidgadPimSegundos(valor) {
  if (valor === null || valor === undefined) return null;
  const texto = String(valor).trim();
  if (!texto || texto === '-') return null;
  if (/^TP$/i.test(texto)) return 0;
  const partes = texto.match(/^(\d+)\s*[’'′]\s*(?:(\d+)\s*["”″])?$/);
  if (partes) return Number(partes[1]) * 60 + Number(partes[2] || 0);
  const minutos = sidgadNum(texto);
  return minutos === null ? null : minutos * 60;
}

// Mismo formato que la API (formatSancionTime): 3’ o 1’30"
function sidgadPimTexto(segundos) {
  if (segundos === null || segundos === undefined) return '';
  const minutos = Math.floor(segundos / 60);
  const resto = Math.round(segundos % 60);
  return resto ? `${minutos}’${resto}"` : `${minutos}’`;
}

/* ===== DOM ===== */

function escaparHtml(valor) {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function crearNodo(tag, atributos = {}, ...hijos) {
  const el = document.createElement(tag);
  for (const [clave, valor] of Object.entries(atributos)) {
    if (clave === 'class') el.className = valor;
    else if (clave === 'text') el.textContent = valor;
    else if (clave === 'html') el.innerHTML = valor;
    else el.setAttribute(clave, valor);
  }
  hijos.forEach(hijo => {
    if (hijo) el.appendChild(typeof hijo === 'string' ? document.createTextNode(hijo) : hijo);
  });
  return el;
}

/* ===== Arranque ===== */

document.addEventListener("DOMContentLoaded", async () => {
  initBannersRotar();
  initMainTabs();
  if (SIDGAD_SETTINGS.has_acta_digital) {
    if (typeof initModalTabs === "function") initModalTabs();
    const overlay = document.getElementById('sidgad-match-overlay');
    if (overlay) overlay.addEventListener('click', () => sidgadCerrarPartido());
  }

  showSidgadLoading();

  const promesaPartidos = SIDGAD_SETTINGS.has_scorer ? initScorer() : Promise.resolve();
  const [temporadas, todasLasLigas] = await Promise.all([cargarTemporadas(), cargarLigas()]);
  // Modo 'limit': sólo las competiciones de la zona, y sólo las temporadas que tienen alguna.
  const ligas = todasLasLigas && SIDGAD_ZONAS.modo === 'limit' ? todasLasLigas.filter(sidgadZonaVisible) : todasLasLigas;
  const temporadasZona = SIDGAD_ZONAS.modo === 'limit' && temporadas.length
    ? temporadas.filter(t => (ligas || []).some(l => String(l.id_temp) === String(t.id_temp)))
    : temporadas;

  renderTemporadas(temporadasZona.length ? temporadasZona : temporadasDesdeLigas(ligas || []));
  renderSelectorZonas(ligas);
  renderSelectorSexo(ligas);
  renderSelectorCategorias(ligas);
  renderLigas(ligas);
  sidgadIniciarNavegacion(ligas);

  await promesaPartidos;
  hideSidgadLoading();
});

// Banners en modo 'rotar' (banners_modo en config.php): uno cada vez; con el ratón o el foco encima
// se detiene.
function initBannersRotar() {
  document.querySelectorAll('.sidgad-banners-rotar').forEach(zona => {
    const banners = [...zona.querySelectorAll('.sidgad-banner')];
    let actual = 0;
    let parado = false;
    setInterval(() => {
      if (parado) return;
      banners[actual].classList.remove('sidgad-banner-activo');
      actual = (actual + 1) % banners.length;
      banners[actual].classList.add('sidgad-banner-activo');
    }, Number(zona.dataset.segundos) * 1000);
    ['mouseenter', 'focusin'].forEach(ev => zona.addEventListener(ev, () => { parado = true; }));
    ['mouseleave', 'focusout'].forEach(ev => zona.addEventListener(ev, () => { parado = false; }));
  });
}

// Marca una botonera como pestañas (role="tab", aria-selected, aria-controls) para lectores de pantalla.
function sidgadMarcarPestanas(contenedor, botones) {
  contenedor?.setAttribute('role', 'tablist');
  botones.forEach(btn => {
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-selected', btn.classList.contains('sidgad-activo') ? 'true' : 'false');
    if (btn.dataset.target) {
      btn.setAttribute('aria-controls', btn.dataset.target);
      document.getElementById(btn.dataset.target)?.setAttribute('role', 'tabpanel');
    }
  });
}

function initMainTabs() {
  const tabButtons = document.querySelectorAll('.sidgad-main-tabs .sidgad-tab-btn');
  const sections = document.querySelectorAll('main#sidgad-vista-principal .sidgad-seccion-contenido');
  sidgadMarcarPestanas(document.querySelector('.sidgad-main-tabs'), tabButtons);
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      tabButtons.forEach(b => { b.classList.remove('sidgad-activo'); b.setAttribute('aria-selected', 'false'); });
      sections.forEach(s => s.classList.remove('sidgad-activo'));
      btn.classList.add('sidgad-activo');
      btn.setAttribute('aria-selected', 'true');
      document.getElementById(btn.dataset.target).classList.add('sidgad-activo');
    });
  });
}

/* ===== Zonas ===== */

// Zona de cada competición (id_zone / zone_name en leagues y scorer). Cada portal elige en
// config.php: show_zone (mostrar el nombre), show_zone_filter ('limit': sólo la zona de
// zone_limiter; 'filter': todo con un selector de zona; 'none': sin zonas), zone_filter_style
// ('select' o 'tabs'), zone_show_all (opción "Todas las zonas"; sin ella se entra en la primera) y
// zone_limiter (id o nombre de la zona). La API no filtra: lo hace el portal.
const SIDGAD_ZONAS = {
  mostrar: false, modo: 'none', estilo: 'select', todas: true, limitador: '',
  ...(typeof SIDGAD_ZONA_CONFIG === 'object' && SIDGAD_ZONA_CONFIG ? SIDGAD_ZONA_CONFIG : {}),
};
let sidgadZonaElegida = ''; // modo 'filter': '' = todas
try { sidgadZonaElegida = localStorage.getItem('sidgad_zona') || ''; } catch (err) { /* sin almacenamiento */ }

function sidgadZonaId(x) {
  const id = String(x?.id_zone ?? '').trim();
  return id && id !== '0' ? id : '';
}

function sidgadZonaNombre(x) {
  return sidgadZonaId(x) ? String(x?.zone_name || '').trim() : '';
}

function sidgadZonaCoincide(x, zona) {
  const buscada = String(zona || '').trim().toLowerCase();
  return !!buscada && (sidgadZonaId(x) === buscada || sidgadZonaNombre(x).toLowerCase() === buscada);
}

// ¿Se muestra esta competición o partido con la zona configurada (y la elegida en el selector)?
function sidgadZonaVisible(x) {
  if (SIDGAD_ZONAS.modo === 'limit') return !SIDGAD_ZONAS.limitador || sidgadZonaCoincide(x, SIDGAD_ZONAS.limitador);
  if (SIDGAD_ZONAS.modo === 'filter') return !sidgadZonaElegida || sidgadZonaId(x) === sidgadZonaElegida;
  return true;
}

// Etiqueta con el nombre de la zona (show_zone).
function sidgadZonaEtiqueta(x, clase = 'sidgad-zona') {
  const nombre = SIDGAD_ZONAS.mostrar ? sidgadZonaNombre(x) : '';
  return nombre ? `<span class="${clase}">${escaparHtml(nombre)}</span>` : '';
}

// Modo 'filter': selector de zona (desplegable junto al de temporada o pestañas encima de los
// listados), con las zonas que tienen competiciones en la temporada elegida (se rehace al cambiarla).
// Con menos de dos zonas no se muestra.
let sidgadLigasZonas = [];

function sidgadRepintarMarcador() {
  if (SIDGAD_SETTINGS.has_scorer && typeof fetchAndRenderMatches === 'function') fetchAndRenderMatches();
}

function renderSelectorZonas(ligas = sidgadLigasZonas) {
  if (SIDGAD_ZONAS.modo !== 'filter' || !ligas) return;
  sidgadLigasZonas = ligas;
  const antes = sidgadZonaElegida;
  const zonas = new Map();
  ligas.filter(l => String(l.id_temp) === sidgadCurrentSeasonId)
    .forEach(l => { if (sidgadZonaId(l)) zonas.set(sidgadZonaId(l), sidgadZonaNombre(l) || sidgadZonaId(l)); });

  if (zonas.size < 2) {
    document.getElementById(SIDGAD_ZONAS.estilo === 'tabs' ? 'sidgad-zona-tabs' : 'sidgad-zona-selector')?.remove();
    sidgadZonaElegida = '';
    if (antes) sidgadRepintarMarcador();
    return;
  }
  const ordenadas = [...zonas].sort((a, b) => Number(a[0]) - Number(b[0]));
  const valida = sidgadZonaElegida ? zonas.has(sidgadZonaElegida) : SIDGAD_ZONAS.todas;
  if (!valida) {
    sidgadZonaElegida = SIDGAD_ZONAS.todas ? '' : ordenadas[0][0];
    sidgadRepintarMarcador();
  }
  const opciones = SIDGAD_ZONAS.todas ? [['', sidgadT('Todas las zonas')], ...ordenadas] : ordenadas;
  if (SIDGAD_ZONAS.estilo === 'tabs') {
    let tabs = document.getElementById('sidgad-zona-tabs');
    if (!tabs) {
      tabs = crearNodo('nav', { class: 'sidgad-zona-tabs', id: 'sidgad-zona-tabs', 'aria-label': sidgadT('Zona') });
      document.querySelector('.sidgad-page-header')?.insertAdjacentElement('afterend', tabs);
    }
    sidgadPintarBotonesFiltro(tabs, opciones, sidgadZonaElegida, sidgadElegirZona);
    return;
  }
  let select = document.getElementById('sidgad-zona-selector');
  if (!select) {
    select = crearNodo('select', { class: 'sidgad-season-selector sidgad-zona-selector', id: 'sidgad-zona-selector', 'aria-label': sidgadT('Zona') });
    select.onchange = () => sidgadElegirZona(select.value);
    document.getElementById('sidgad-season-selector')?.insertAdjacentElement('beforebegin', select);
  }
  select.replaceChildren(...opciones.map(([id, nombre]) => crearNodo('option', { value: id, text: nombre })));
  select.value = sidgadZonaElegida;
}

function sidgadElegirZona(id) {
  sidgadZonaElegida = id;
  try { localStorage.setItem('sidgad_zona', id); } catch (err) { /* sin almacenamiento */ }
  renderSelectorZonas();
  renderSelectorSexo();
  renderSelectorCategorias();
  toggleSeasonVisibilty();
  sidgadRepintarMarcador();
}

// Botones de un filtro (pestañas de zona, categorías): opciones = [[valor, texto], ...]
function sidgadPintarBotonesFiltro(contenedor, opciones, elegido, alElegir) {
  contenedor.replaceChildren(...opciones.map(([valor, texto]) => {
    const boton = crearNodo('button', { type: 'button', text: texto, 'aria-pressed': String(valor === elegido) });
    boton.classList.toggle('sidgad-activo', valor === elegido);
    boton.addEventListener('click', () => alElegir(valor));
    return boton;
  }));
}

/* ===== Sexo ===== */

// Sexo de cada competición (id_sexo de leagues: 0 mixto, 2 masculino, 1 femenino; null = sin sexo).
// Con show_sexo_filter en config.php, botones debajo de la cabecera que filtran las competiciones y
// el marcador (sus partidos, por league_id = idc). Salen los sexos de la temporada y la zona elegidas;
// con menos de dos no se muestra. Las competiciones sin sexo sólo salen en "Todos".
const SIDGAD_SEXOS = [['0', 'Mixto'], ['2', 'Masculino'], ['1', 'Femenino']];
let sidgadLigasSexo = [];
// Para los partidos del marcador: idc -> id_sexo y, si su league_id no está en leagues (p. ej. fases
// de una liga), nombre de la competición -> id_sexo.
let sidgadSexoPorLiga = new Map();
let sidgadSexoPorNombre = new Map();

function sidgadNombreLiga(nombre) {
  return String(nombre ?? '').trim().toUpperCase();
}

function sidgadFiltraSexo() {
  return typeof SIDGAD_FILTRO_SEXO !== 'undefined' && SIDGAD_FILTRO_SEXO === true;
}

let sidgadSexoElegido = ''; // '' = todos
if (sidgadFiltraSexo()) {
  try { sidgadSexoElegido = localStorage.getItem('sidgad_sexo') || ''; } catch (err) { /* sin almacenamiento */ }
}

// El 0 es "mixto", no "sin sexo".
function sidgadSexoId(x) {
  const id = String(x?.id_sexo ?? '').trim();
  return SIDGAD_SEXOS.some(([s]) => s === id) ? id : '';
}

// ¿Se muestra esta competición (id_sexo) o partido del marcador (league_id) con el sexo elegido?
function sidgadSexoVisible(x) {
  if (!sidgadSexoElegido) return true;
  if (x && 'id_sexo' in x) return sidgadSexoId(x) === sidgadSexoElegido;
  const porId = sidgadSexoPorLiga.get(String(x?.league_id ?? ''));
  return (porId ?? sidgadSexoPorNombre.get(sidgadNombreLiga(x?.league_name)) ?? '') === sidgadSexoElegido;
}

function renderSelectorSexo(ligas = sidgadLigasSexo) {
  if (!sidgadFiltraSexo() || !ligas) return;
  // El marcador puede haberse pintado antes de tener las ligas: con un sexo elegido, se repinta.
  const ligasNuevas = ligas !== sidgadLigasSexo;
  if (ligasNuevas) {
    sidgadLigasSexo = ligas;
    sidgadSexoPorLiga = new Map(ligas.map(l => [String(l.idc), sidgadSexoId(l)]));
    sidgadSexoPorNombre = new Map(ligas.map(l => [sidgadNombreLiga(l.nombre_idc), sidgadSexoId(l)]));
  }
  const antes = sidgadSexoElegido;
  const presentes = new Set(ligas.filter(l => String(l.id_temp) === sidgadCurrentSeasonId && sidgadZonaVisible(l)).map(sidgadSexoId));
  const sexos = SIDGAD_SEXOS.filter(([id]) => presentes.has(id));
  if (!sexos.some(([id]) => id === sidgadSexoElegido)) sidgadSexoElegido = '';
  if (antes !== sidgadSexoElegido || (ligasNuevas && sidgadSexoElegido)) sidgadRepintarMarcador();

  let cont = document.getElementById('sidgad-sexo-filtro');
  if (sexos.length < 2) {
    cont?.remove();
    return;
  }
  if (!cont) {
    cont = crearNodo('div', { class: 'sidgad-categorias sidgad-sexo-filtro', id: 'sidgad-sexo-filtro', role: 'group', 'aria-label': sidgadT('Sexo') });
    (document.getElementById('sidgad-zona-tabs') || document.querySelector('.sidgad-page-header'))?.insertAdjacentElement('afterend', cont);
  }
  const opciones = [['', sidgadT('Todos')], ...sexos.map(([id, texto]) => [id, sidgadT(texto)])];
  sidgadPintarBotonesFiltro(cont, opciones, sidgadSexoElegido, (id) => {
    sidgadSexoElegido = id;
    try { localStorage.setItem('sidgad_sexo', id); } catch (err) { /* sin almacenamiento */ }
    renderSelectorSexo();
    renderSelectorCategorias();
    toggleSeasonVisibilty();
    sidgadRepintarMarcador();
  });
}

/* ===== Categorías ===== */

// Categoría de cada competición (id_categoria / nombre_categoria de leagues; el catálogo es propio de
// cada cliente). Con show_category_filter en config.php, botones encima de las ligas con las
// categorías de la temporada y la zona elegidas, en el orden en que llegan. Las competiciones sin
// categoría sólo salen en "Todas". Con menos de dos categorías no se muestra.
let sidgadCategoriaElegida = '';
try { sidgadCategoriaElegida = localStorage.getItem('sidgad_categoria') || ''; } catch (err) { /* sin almacenamiento */ }
let sidgadLigasCategorias = [];

function sidgadFiltraCategorias() {
  return typeof SIDGAD_FILTRO_CATEGORIAS !== 'undefined' && SIDGAD_FILTRO_CATEGORIAS === true;
}

function sidgadCategoriaId(x) {
  const id = String(x?.id_categoria ?? '').trim();
  return id && id !== '0' ? id : '';
}

function renderSelectorCategorias(ligas = sidgadLigasCategorias) {
  if (!sidgadFiltraCategorias() || !ligas) return;
  sidgadLigasCategorias = ligas;
  const categorias = new Map();
  ligas.filter(l => String(l.id_temp) === sidgadCurrentSeasonId && sidgadZonaVisible(l) && sidgadSexoVisible(l)).forEach(l => {
    const id = sidgadCategoriaId(l);
    if (id && !categorias.has(id)) categorias.set(id, String(l.nombre_categoria || '').trim() || id);
  });
  if (!categorias.has(sidgadCategoriaElegida)) sidgadCategoriaElegida = '';

  let cont = document.getElementById('sidgad-categorias');
  if (categorias.size < 2) {
    cont?.remove();
    return;
  }
  if (!cont) {
    cont = crearNodo('div', { class: 'sidgad-categorias', id: 'sidgad-categorias', role: 'group', 'aria-label': sidgadT('Categoría') });
    document.getElementById('sidgad-contenedor-ligas')?.insertAdjacentElement('beforebegin', cont);
  }
  sidgadPintarBotonesFiltro(cont, [['', sidgadT('Todas las categorías')], ...categorias], sidgadCategoriaElegida, (id) => {
    sidgadCategoriaElegida = id;
    try { localStorage.setItem('sidgad_categoria', id); } catch (err) { /* sin almacenamiento */ }
    renderSelectorCategorias();
    toggleSeasonVisibilty();
  });
}

/* ===== Temporadas ===== */

async function cargarTemporadas() {
  try {
    const data = await sidgadFetch('seasons', {}, { cache: true });
    return data?.temps || [];
  } catch (err) {
    console.error("Error temporadas:", err);
    return [];
  }
}

// Si /seasons/ falla, las temporadas se deducen de /leagues/ (id_temp, nombre_temp).
function temporadasDesdeLigas(ligas) {
  const vistas = new Map();
  ligas.forEach(l => {
    if (l.id_temp && !vistas.has(l.id_temp)) vistas.set(l.id_temp, { id_temp: l.id_temp, nombre_temp: l.nombre_temp || l.id_temp });
  });
  return [...vistas.values()];
}

function renderTemporadas(temporadas) {
  const contSeasons = document.getElementById('sidgad-season-selector');
  contSeasons.replaceChildren();
  temporadas.forEach(s => {
    contSeasons.appendChild(crearNodo('option', { value: s.id_temp, text: s.nombre_temp, title: sidgadT('Temporada {t}', { t: s.nombre_temp }) }));
  });
  sidgadCurrentSeasonId = contSeasons.value;
  contSeasons.onchange = (e) => {
    sidgadCurrentSeasonId = e.target.value;
    renderSelectorZonas();
    renderSelectorSexo();
    renderSelectorCategorias();
    toggleSeasonVisibilty();
  };
}

/* ===== Ligas ===== */

// Logo de una competición: si llega vacío o sólo con la carpeta (".../logos_competiciones/"), o si no
// carga, la imagen de img_default en config.php.
function sidgadImgDefault() {
  return (typeof SIDGAD_IMG_DEFAULT === 'string' && SIDGAD_IMG_DEFAULT) || SIDGAD_DEFAULT_LOGO;
}

function sidgadLogoCompeticion(liga) {
  const logo = String(liga?.logo_idc ?? '').trim();
  return logo && !logo.endsWith('/') ? logo : sidgadImgDefault();
}

function sidgadLogoCompeticionFallo(img) {
  img.onerror = null;
  img.src = sidgadImgDefault();
}

async function cargarLigas() {
  try {
    const data = await sidgadFetch('leagues', {}, { cache: true });
    return data?.idcs || [];
  } catch (err) {
    console.error("Error ligas:", err);
    document.getElementById('sidgad-contenedor-ligas')
      .replaceChildren(crearNodo('p', { class: 'sidgad-empty-state', text: sidgadT('No se han podido cargar las competiciones.') }));
    return null;
  }
}

function renderLigas(ligas) {
  if (!ligas) return;
  const contLigas = document.getElementById('sidgad-contenedor-ligas');
  const fragmentoLigas = document.createDocumentFragment();
  const enlaces = typeof SIDGAD_COMPETICIONES_ENLACE !== 'undefined' ? SIDGAD_COMPETICIONES_ENLACE : [];
  enlaces.filter(e => !e.fin).forEach(e => fragmentoLigas.appendChild(sidgadTarjetaEnlace(e)));

  ligas.forEach(l => {
    const tarjetaLiga = document.createElement('div');
    tarjetaLiga.innerHTML = `
      <button class="sidgad-liga-card" data-season-id="${escaparHtml(l.id_temp)}" data-zona="${escaparHtml(sidgadZonaId(l))}" data-categoria="${escaparHtml(sidgadCategoriaId(l))}" data-sexo="${escaparHtml(sidgadSexoId(l))}">
        <img src="${escaparHtml(sidgadLogoCompeticion(l))}" class="sidgad-liga-logo" alt="" onerror="sidgadLogoCompeticionFallo(this)">
        <div class="sidgad-liga-info">
          ${sidgadZonaEtiqueta(l)}
          <div class="sidgad-liga-titulo">${escaparHtml(l.nombre_idc)}</div>
          <div class="sidgad-liga-equipos"></div>
        </div>
      </button>
    `;
    sidgadMontarEquiposLiga(tarjetaLiga.querySelector('.sidgad-liga-equipos'), l.teams || []);
    if (SIDGAD_SETTINGS.has_league_page) tarjetaLiga.firstElementChild.addEventListener('click', () => {
      sidgadAbrirLiga(l.idc);
    });
    fragmentoLigas.appendChild(tarjetaLiga.firstElementChild);
  });

  enlaces.filter(e => e.fin).forEach(e => fragmentoLigas.appendChild(sidgadTarjetaEnlace(e)));
  contLigas.replaceChildren(fragmentoLigas);
  toggleSeasonVisibilty();
}

/*
 * Escudos de la tarjeta de una competición: como mucho dos filas a tamaño normal. Si no caben
 * todos, las dos filas pasan en bucle (carrusel) para que se vean todos. Lo que cabe depende del
 * ancho de la tarjeta, así que se recalcula al cambiar su tamaño (también cuando una tarjeta
 * oculta por temporada o zona se muestra: pasa de ancho 0 a su ancho).
 */
const SIDGAD_ESCUDO_LIGA = 24;
const SIDGAD_ESCUDO_LIGA_GAP = 6;
const sidgadEquiposLiga = new WeakMap(); // contenedor -> [html de cada escudo]
const sidgadEquiposLigaObserver = typeof ResizeObserver !== 'undefined'
  ? new ResizeObserver(entradas => entradas.forEach(e => sidgadAjustarEquiposLiga(e.target)))
  : null;

function sidgadMontarEquiposLiga(cont, teams) {
  if (!cont) return;
  sidgadEquiposLiga.set(cont, teams.map(team => `<img src="${escaparHtml(team.team_logo)}" alt="${escaparHtml(team.name)}" title="${escaparHtml(team.name)}" loading="lazy">`));
  cont.dataset.modo = 'fijo';
  cont.innerHTML = sidgadEquiposLiga.get(cont).join('');
  sidgadEquiposLigaObserver?.observe(cont);
}

function sidgadAjustarEquiposLiga(cont) {
  const escudos = sidgadEquiposLiga.get(cont);
  const ancho = cont.clientWidth;
  if (!escudos || !ancho) return;
  const porFila = Math.max(1, Math.floor((ancho + SIDGAD_ESCUDO_LIGA_GAP) / (SIDGAD_ESCUDO_LIGA + SIDGAD_ESCUDO_LIGA_GAP)));
  const modo = escudos.length > porFila * 2 ? 'carrusel' : 'fijo';
  if (cont.dataset.modo === modo) return;
  cont.dataset.modo = modo;

  if (modo === 'fijo') {
    cont.innerHTML = escudos.join('');
    return;
  }
  // Cada fila lleva sus escudos dos veces y se desplaza media pista: el bucle no tiene saltos.
  // La copia no se lee con lector de pantalla. Unos 30px por segundo.
  const mitad = Math.ceil(escudos.length / 2);
  cont.innerHTML = [escudos.slice(0, mitad), escudos.slice(mitad)].map((fila, i) => `
    <div class="sidgad-equipos-fila">
      <div class="sidgad-equipos-pista${i ? ' sidgad-equipos-pista-inversa' : ''}" style="--sidgad-equipos-duracion: ${fila.length}s">
        <div class="sidgad-equipos-grupo">${fila.join('')}</div>
        <div class="sidgad-equipos-grupo" aria-hidden="true">${fila.join('').replace(/ alt="[^"]*"/g, ' alt=""')}</div>
      </div>
    </div>`).join('');
}

// Tarjeta hecha a mano en config.php (competiciones_enlace): un enlace, no una competición.
function sidgadTarjetaEnlace(e) {
  const tarjeta = crearNodo('a', { class: 'sidgad-liga-enlace', href: e.enlace, 'data-zona': e.zona, 'data-temporada': e.temporada });
  if (e.nueva_pestana) {
    tarjeta.target = '_blank';
    tarjeta.rel = 'noopener';
  }
  tarjeta.innerHTML = `
    <img src="${escaparHtml(sidgadLogoCompeticion({ logo_idc: e.logo }))}" class="sidgad-liga-logo" alt="" onerror="sidgadLogoCompeticionFallo(this)">
    <span class="sidgad-liga-titulo">${escaparHtml(e.titulo)}</span>
    <i class="fa-solid ${e.nueva_pestana ? 'fa-arrow-up-right-from-square' : 'fa-arrow-right'} sidgad-liga-enlace-icono" aria-hidden="true"></i>`;
  return tarjeta;
}

function toggleSeasonVisibilty() {
  let visibles = 0;
  document.querySelectorAll('.sidgad-liga-card').forEach(card => {
    const visible = card.getAttribute('data-season-id') === sidgadCurrentSeasonId
      && sidgadZonaVisible({ id_zone: card.dataset.zona })
      && sidgadSexoVisible({ id_sexo: card.dataset.sexo })
      && (!sidgadCategoriaElegida || card.dataset.categoria === sidgadCategoriaElegida);
    card.classList.toggle('sidgad-oculto', !visible);
    if (visible) visibles++;
  });
  document.querySelectorAll('.sidgad-liga-enlace').forEach(tarjeta => {
    const { zona, temporada } = tarjeta.dataset;
    tarjeta.classList.toggle('sidgad-oculto', !!sidgadCategoriaElegida || !!sidgadSexoElegido
      || (!!temporada && temporada !== sidgadCurrentSeasonId)
      || (!!zona && !sidgadZonaVisible({ id_zone: zona })));
  });
  // Aviso si con la temporada y la zona elegidas no queda ninguna competición.
  const cont = document.getElementById('sidgad-contenedor-ligas');
  let aviso = document.getElementById('sidgad-ligas-vacio');
  if (!visibles && cont?.querySelector('.sidgad-liga-card')) {
    if (!aviso) {
      aviso = crearNodo('p', { class: 'sidgad-empty-state', id: 'sidgad-ligas-vacio', text: sidgadT('No hay competiciones en esta zona.') });
      cont.appendChild(aviso);
    }
  } else {
    aviso?.remove();
  }
}

/* ===== Capas ===== */

// La página de fondo no se desplaza mientras haya alguna capa abierta (equipo, acta, jugador).
function sidgadActualizarScroll() {
  const abierta = ['sidgad-equipo-overlay', 'sidgad-previa-overlay', 'sidgad-match-overlay', 'sidgad-pista-overlay', 'sidgad-player-overlay']
    .some(id => document.getElementById(id)?.classList.contains('sidgad-activo'));
  document.body.style.overflow = abierta ? 'hidden' : '';
}

/* ===== Loader ===== */

function showSidgadLoading() {
  document.getElementById('sidgad-loading-overlay').classList.add('sidgad-activo');
}

function hideSidgadLoading() {
  document.getElementById('sidgad-loading-overlay').classList.remove('sidgad-activo');
}
