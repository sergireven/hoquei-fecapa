
document.addEventListener('DOMContentLoaded', function () {
  let isDragging = false;
  let offsetX = 0;
  let offsetY = 0;

  // Función para abrir el overlay de vídeo draggable
  function openVideoOverlay(videoUrl) {
    let overlay = document.getElementById('sidgad-video-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'sidgad-video-overlay';
      overlay.innerHTML = `
        <div class="sidgad-video-overlay-header" id="sidgad-video-overlay-header">
          <span class="sidgad-video-overlay-title">${sidgadT('Reproductor de vídeo')}</span>
          <button id="sidgad-video-overlay-close" aria-label="${sidgadT('Cerrar vídeo')}"><i class="fas fa-times"></i></button>
        </div>
        <div class="sidgad-video-container">
          <iframe id="sidgad-video-iframe" src="" frameborder="0" allowfullscreen allow="autoplay"></iframe>
        </div>
      `;
      document.body.appendChild(overlay);

      // Evento para cerrar el overlay
      document.getElementById('sidgad-video-overlay-close').addEventListener('click', function () {
        closeVideoOverlay();
      });

      // Eventos para drag
      const header = document.getElementById('sidgad-video-overlay-header');
      header.addEventListener('mousedown', startDrag);
      document.addEventListener('mousemove', drag);
      document.addEventListener('mouseup', stopDrag);
    }

    // Configurar el iframe con la URL del vídeo
    const iframe = document.getElementById('sidgad-video-iframe');
    iframe.src = videoUrl;

    // Mostrar el overlay
    overlay.classList.remove('closing');
    overlay.classList.add('visible');
  }

  // Funciones para drag
  function startDrag(e) {
    isDragging = true;
    const overlay = document.getElementById('sidgad-video-overlay');
    const rect = overlay.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
  }

  function drag(e) {
    if (!isDragging) return;
    const overlay = document.getElementById('sidgad-video-overlay');
    if (overlay) {
      overlay.style.left = (e.clientX - offsetX) + 'px';
      overlay.style.top = (e.clientY - offsetY) + 'px';
      overlay.style.right = 'auto';
      overlay.style.bottom = 'auto';
    }
  }

  function stopDrag() {
    isDragging = false;
  }

  // Función para cerrar el overlay de vídeo con animación
  function closeVideoOverlay() {
    const overlay = document.getElementById('sidgad-video-overlay');
    if (overlay) {
      const iframe = document.getElementById('sidgad-video-iframe');
      iframe.src = ''; // Detener el vídeo

      // Agregar clase de cierre para animación
      overlay.classList.add('closing');

      // Remover después de la animación
      setTimeout(() => {
        overlay.classList.remove('visible');
        overlay.classList.remove('closing');
      }, 300);
    }
  }

  // Exponer la función para abrir el overlay a nivel global
  window.videoOpener = openVideoOverlay;
});