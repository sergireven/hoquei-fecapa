/*
 * Ficha de pista (capa ?pista=NOMBRE), con el mismo marco que la ficha de jugador. Se abre al
 * pulsar el nombre de la pista (calendario, previa, acta). Los datos del pabellón (dirección,
 * instalación, servicios y contacto) salen de /pistas/, que se cruza por el nombre
 * (denominacion = pista del calendario = venue_info del acta). Sólo información del pabellón.
 */

const sidgadPista = { nombre: null, peticion: 0 };

// Nombre para cruzar calendario y /pistas/: sin tildes, mayúsculas ni espacios de más.
function sidgadPistasClave(nombre) {
  return String(nombre || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
}

function sidgadPistasDireccion(datos) {
  return [datos?.direccion_pista, datos?.codigo_postal].map(t => String(t || '').trim()).filter(Boolean).join(', ');
}

// Google Maps con el nombre y, si la hay, la dirección completa.
function sidgadPistasMapa(nombre, datos) {
  const direccion = sidgadPistasDireccion(datos);
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(direccion ? `${nombre}, ${direccion}` : nombre)}`;
}

const sidgadPistasSi = v => v === true || v === 1 || ['1', 'true', 'si', 'sí', 's'].includes(String(v ?? '').trim().toLowerCase());

// Pavimento tal y como se guarda en SIDGAD → texto para la ficha.
const SIDGAD_PISTAS_PAVIMENTOS = {
  'CEMENTO PULIDO': sidgadT('Cemento pulido'),
  'SINTETICO-PLASTICO': sidgadT('Sintético'),
  'PARQUET': sidgadT('Parquet'),
  'TERRAZO': sidgadT('Terrazo'),
  'ASFALTICO': sidgadT('Asfáltico'),
};

// Teléfono, email y web sólo si parecen reales: hay valores de relleno como "xxxxxx".
const sidgadPistasTelefono = t => (String(t || '').replace(/[^\d+]/g, '').length >= 9 ? String(t).trim() : '');
const sidgadPistasEmail = t => (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(t || '').trim()) ? String(t).trim() : '');

// Directorio de pistas de la API (todas las modalidades). Si dos se llaman igual, se queda la de
// la modalidad del portal.
let sidgadPistasDatosPromesa = null;
function sidgadPistasCargarDatos() {
  if (!sidgadPistasDatosPromesa) {
    const deEstaModalidad = v => String(v.modals || '').split(',').map(m => m.trim()).includes(SIDGAD_API_CONFIG.idm);
    sidgadPistasDatosPromesa = sidgadFetch('pistas', {}, { cache: true })
      .then(d => (Array.isArray(d?.pistas) ? d.pistas : []))
      .catch(() => [])
      .then(lista => {
        const mapa = new Map();
        lista.forEach(v => {
          const clave = sidgadPistasClave(v.denominacion);
          if (!mapa.has(clave) || deEstaModalidad(v)) mapa.set(clave, v);
        });
        return mapa;
      });
  }
  return sidgadPistasDatosPromesa;
}

function sidgadPistaBloque(icono, titulo, contenido) {
  return `<h3 class="sidgad-ficha-subtitulo"><i class="fa-solid ${icono}" aria-hidden="true"></i> ${titulo}</h3>${contenido}`;
}

// Instalación (pavimento, medidas, aforo, vestuarios), servicios y contacto.
function sidgadPistaDatosHtml(datos) {
  if (!datos) return '';
  const largo = sidgadNum(datos.largo);
  const ancho = sidgadNum(datos.ancho);
  const aforo = sidgadNum(datos.aforo);
  const vestuarios = sidgadNum(datos.vestuarios);
  const capVestuario = sidgadNum(datos.cap_vestuarios);
  const pavimento = String(datos.pavimento || '').trim();
  const instalacion = [
    pavimento && pavimento !== 'NO ESPECIFICADO' && ['fa-border-all', sidgadT('Pavimento'), escaparHtml(SIDGAD_PISTAS_PAVIMENTOS[pavimento] || pavimento)],
    largo && ancho && ['fa-ruler-combined', sidgadT('Medidas'), `${largo.toLocaleString(SIDGAD_LOCALE)} × ${ancho.toLocaleString(SIDGAD_LOCALE)} m`],
    aforo && ['fa-users', sidgadT('Aforo'), `${aforo.toLocaleString(SIDGAD_LOCALE)}`],
    vestuarios && ['fa-door-closed', sidgadT('Vestuarios'), `${vestuarios}${capVestuario ? ` · ${sidgadT('{n} pers.', { n: capVestuario })}` : ''}`],
  ].filter(Boolean);
  const servicios = [
    sidgadPistasSi(datos.marcador) && ['fa-tv', sidgadT('Marcador electrónico')],
    sidgadPistasSi(datos.megafonia) && ['fa-bullhorn', sidgadT('Megafonía')],
    sidgadPistasSi(datos.wifi) && ['fa-wifi', sidgadT('Wifi')],
  ].filter(Boolean);
  const telefono = sidgadPistasTelefono(datos.tfno_pista);
  const email = sidgadPistasEmail(datos.email_pista);
  const web = String(datos.web_pista || '').trim();
  const contacto = [
    telefono && `<a href="tel:${escaparHtml(telefono.replace(/[^\d+]/g, ''))}"><i class="fa-solid fa-phone" aria-hidden="true"></i> ${escaparHtml(telefono)}</a>`,
    email && `<a href="mailto:${escaparHtml(email)}"><i class="fa-solid fa-envelope" aria-hidden="true"></i> ${escaparHtml(email)}</a>`,
    /^https?:\/\//i.test(web) && `<a href="${escaparHtml(web)}" target="_blank" rel="noopener"><i class="fa-solid fa-globe" aria-hidden="true"></i> ${sidgadT('Página web')}</a>`,
  ].filter(Boolean);
  return [
    instalacion.length ? sidgadPistaBloque('fa-building', sidgadT('Instalación'), `
      <div class="sidgad-ficha-cards sidgad-pista-cards">${instalacion.map(([icono, titulo, valor]) => `
        <article class="sidgad-ficha-card"><span><i class="fa-solid ${icono}" aria-hidden="true"></i> ${titulo}</span><strong>${valor}</strong></article>`).join('')}
      </div>`) : '',
    servicios.length ? sidgadPistaBloque('fa-circle-check', sidgadT('Servicios'), `
      <ul class="sidgad-pista-servicios">${servicios.map(([icono, texto]) => `<li><i class="fa-solid ${icono}" aria-hidden="true"></i> ${texto}</li>`).join('')}</ul>`) : '',
    contacto.length ? sidgadPistaBloque('fa-address-book', sidgadT('Contacto'), `<div class="sidgad-pista-contacto">${contacto.join('')}</div>`) : '',
  ].join('');
}

function sidgadPistaOverlay() {
  let overlay = document.getElementById('sidgad-pista-overlay');
  if (overlay) return overlay;
  overlay = document.createElement('div');
  overlay.id = 'sidgad-pista-overlay';
  overlay.innerHTML = `
    <div class="sidgad-player-overlay-shell" role="dialog" aria-modal="true" aria-label="${sidgadT('Ficha de pista')}" onclick="event.stopPropagation()">
      <div class="sidgad-player-overlay-top">
        <div class="sidgad-player-overlay-titleblock">
          <div class="sidgad-player-overlay-kicker">${sidgadT('Ficha de pista')}</div>
          <h2 id="sidgad-pista-titulo">${sidgadT('Pista')}</h2>
        </div>
        <button type="button" class="sidgad-pista-cerrar" aria-label="${sidgadT('Cerrar')}"><i class="fas fa-times" aria-hidden="true"></i></button>
      </div>
      <div class="sidgad-player-overlay-body">
        <section class="sidgad-player-hero-card sidgad-pista-hero" id="sidgad-pista-hero"></section>
        <section class="sidgad-ficha" id="sidgad-pista-ficha"></section>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('.sidgad-pista-cerrar').addEventListener('click', () => sidgadCerrarPista());
  overlay.addEventListener('click', e => { if (e.target === overlay) sidgadCerrarPista(); });
  return overlay;
}

async function abrirPista(nombre) {
  const overlay = sidgadPistaOverlay();
  const peticion = ++sidgadPista.peticion;
  sidgadPista.nombre = nombre;
  const hero = document.getElementById('sidgad-pista-hero');
  const ficha = document.getElementById('sidgad-pista-ficha');
  document.getElementById('sidgad-pista-titulo').textContent = nombre;
  hero.innerHTML = '';
  ficha.innerHTML = `<p class="sidgad-ficha-vacio">${sidgadT('Cargando...')}</p>`;
  overlay.classList.add('sidgad-activo');
  document.body.style.overflow = 'hidden';

  const datosPistas = await sidgadPistasCargarDatos();
  if (peticion !== sidgadPista.peticion) return;

  const datos = datosPistas.get(sidgadPistasClave(nombre)) || null;
  const direccion = sidgadPistasDireccion(datos);

  hero.innerHTML = `
    <div class="sidgad-pista-icono" aria-hidden="true"><i class="fa-solid fa-location-dot"></i></div>
    <div class="sidgad-player-hero-copy">
      <div class="sidgad-player-name-compact sidgad-pista-nombre">${escaparHtml(nombre)}</div>
      ${direccion ? `<p class="sidgad-pista-direccion">${escaparHtml(direccion)}</p>` : ''}
      <a class="sidgad-pista-mapa" href="${escaparHtml(sidgadPistasMapa(nombre, datos))}" target="_blank" rel="noopener">
        <i class="fa-solid fa-map-location-dot" aria-hidden="true"></i> ${sidgadT('Cómo llegar')}
      </a>
    </div>`;

  ficha.innerHTML = sidgadPistaDatosHtml(datos) || `<p class="sidgad-ficha-vacio">${sidgadT('Todavía no hay datos de esta pista.')}</p>`;
}

function cerrarPista() {
  sidgadPista.peticion++;
  document.getElementById('sidgad-pista-overlay')?.classList.remove('sidgad-activo');
  sidgadActualizarScroll();
}

window.sidgadPista = { abrir: abrirPista, cerrar: cerrarPista };
