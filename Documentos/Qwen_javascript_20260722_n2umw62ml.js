document.addEventListener('DOMContentLoaded', () => {
  // 1. Inicializar Activos Visuales desde CONFIG
  document.getElementById('header-logo').src = CONFIG.assets.logo;
  document.getElementById('hero-image').src = CONFIG.assets.hero;
  document.getElementById('player-art').src = CONFIG.assets.logo;
  document.getElementById('banner-logo-android').src = CONFIG.assets.logo;
  document.getElementById('dev-logo').src = CONFIG.assets.developerLogo;
  
  const audio = document.getElementById('radio-audio');
  audio.src = CONFIG.stream.url;
  
  const playBtn = document.getElementById('play-btn');
  const statusBadge = document.getElementById('player-status');
  const waBtn = document.getElementById('whatsapp-btn');
  
  waBtn.href = `https://wa.me/${CONFIG.contact.whatsapp}?text=${encodeURIComponent(CONFIG.contact.whatsappMsg)}`;

  // 2. Lógica del Reproductor y Media Session API (Segundo Plano)
  let isPlaying = false;

  playBtn.addEventListener('click', toggleRadio);

  function toggleRadio() {
    if (isPlaying) {
      audio.pause();
      playBtn.textContent = '▶';
      statusBadge.textContent = '⏸ PAUSADO';
      isPlaying = false;
    } else {
      pauseYouTube(); // Muteo cruzado
      
      audio.play().then(() => {
        playBtn.textContent = '⏸';
        statusBadge.textContent = '🔴 EN VIVO';
        isPlaying = true;
        setupMediaSession();
      }).catch(err => {
        console.error("Error al reproducir:", err);
        statusBadge.textContent = '❌ ERROR';
      });
    }
  }

  function setupMediaSession() {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: CONFIG.stream.title,
        artist: CONFIG.stream.artist,
        artwork: [
          { src: CONFIG.assets.logo, sizes: '192x192', type: 'image/jpeg' },
          { src: CONFIG.assets.logo, sizes: '512x512', type: 'image/jpeg' }
        ]
      });
      navigator.mediaSession.setActionHandler('play', () => { audio.play(); playBtn.textContent = '⏸'; statusBadge.textContent = '🔴 EN VIVO'; isPlaying = true; });
      navigator.mediaSession.setActionHandler('pause', () => { audio.pause(); playBtn.textContent = '▶'; statusBadge.textContent = '⏸ PAUSADO'; isPlaying = false; });
    }
  }

  // 3. Muteo Cruzado con YouTube
  window.addEventListener('message', (event) => {
    if (event.origin !== 'https://www.youtube.com') return;
    try {
      const data = JSON.parse(event.data);
      if (data.event === 'onStateChange' && data.info === 1) { // 1 = Playing
        if (isPlaying) {
          audio.pause();
          playBtn.textContent = '▶';
          statusBadge.textContent = '📺 YOUTUBE';
          isPlaying = false;
        }
      }
    } catch (e) { /* Ignorar mensajes no JSON de YouTube */ }
  });

  function pauseYouTube() {
    const ytFrame = document.getElementById('yt-player');
    if (ytFrame && ytFrame.contentWindow) {
      ytFrame.contentWindow.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*');
    }
  }

  // 4. Carga de Datos desde Apps Script
  async function loadData(sheetName, containerId) {
    const container = document.getElementById(containerId);
    try {
      const response = await fetch(`${CONFIG.api.sheetEndpoint}?hoja=${sheetName}`);
      const data = await response.json();
      
      if (data.error) {
        container.innerHTML = `<p style="color:var(--primary); font-weight:bold;">Error: ${data.error}</p>`;
        return;
      }

      if (!data || data.length === 0) {
        container.innerHTML = '<p>No hay datos disponibles en este momento.</p>';
        return;
      }

      container.innerHTML = data.map(item => `
        <div class="list-item">
          <h4>${item.programa || item.titulo || 'Sin título'}</h4>
          <p>${item.locutor || item.descripcion || item.resumen || ''}</p>
          <p style="font-size:0.8rem; color:var(--primary); font-weight:600; margin-top:6px;">
            ${item.dia ? `${item.dia} ${item.hora_inicio} - ${item.hora_fin}` : ''}
            ${item.fecha ? item.fecha : ''}
          </p>
        </div>
      `).join('');
      
    } catch (error) {
      console.error("Error cargando datos:", error);
      container.innerHTML = '<p>Error de conexión. Verifique su red e intente nuevamente.</p>';
    }
  }

  loadData('programacion', 'prog-list');
  
  // 5. Registro del Service Worker (PWA)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').then(reg => {
      console.log('SW registrado con éxito:', reg.scope);
    }).catch(err => {
      console.log('Fallo en registro de SW:', err);
    });
  }

  // 6. Lógica de Instalación PWA (Android / iOS)
  let deferredPrompt;
  const pwaBannerAndroid = document.getElementById('pwa-banner-android');
  const pwaBannerIOS = document.getElementById('pwa-banner-ios');
  const installBtn = document.getElementById('pwa-install-btn');
  const closeAndroidBtn = document.getElementById('pwa-close-android');
  const closeIOSBtn = document.getElementById('pwa-close-ios');

  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

  if (isIOS && !isStandalone) {
    const iosDismissed = localStorage.getItem('pwa_ios_dismissed');
    const dismissTime = iosDismissed ? parseInt(iosDismissed, 10) : 0;
    if (!iosDismissed || (Date.now() - dismissTime > 7 * 24 * 60 * 60 * 1000)) {
      pwaBannerIOS.style.display = 'block';
    }
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const androidDismissed = localStorage.getItem('pwa_android_dismissed');
    const dismissTime = androidDismissed ? parseInt(androidDismissed, 10) : 0;
    if (!androidDismissed || (Date.now() - dismissTime > 7 * 24 * 60 * 60 * 1000)) {
      pwaBannerAndroid.style.display = 'block';
    }
  });

  if (installBtn) {
    installBtn.addEventListener('click', async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        pwaBannerAndroid.style.display = 'none';
      }
      deferredPrompt = null;
    });
  }

  function dismissBanner(platform) {
    if (platform === 'android') {
      pwaBannerAndroid.style.display = 'none';
      localStorage.setItem('pwa_android_dismissed', Date.now().toString());
    } else if (platform === 'ios') {
      pwaBannerIOS.style.display = 'none';
      localStorage.setItem('pwa_ios_dismissed', Date.now().toString());
    }
  }

  if (closeAndroidBtn) closeAndroidBtn.addEventListener('click', () => dismissBanner('android'));
  if (closeIOSBtn) closeIOSBtn.addEventListener('click', () => dismissBanner('ios'));
});