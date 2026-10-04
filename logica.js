// === VARIABLES GLOBALES ===
let todasLasAlertas = [];
let mapa;
let capaMarcadores;
let ubicacionUsuario = [-16.5000, -68.1193]; // Default: La Paz, Bolivia

// === INICIALIZACIÓN ===
document.addEventListener('DOMContentLoaded', () => {
  inicializarMapa();
  
  // Eventos de los selectores de alcance
  document.getElementById('filtroAlcance').addEventListener('change', (e) => cambiarAlcance(e.target.value));
  const filtroMovil = document.getElementById('filtroAlcanceMovil');
  if(filtroMovil) filtroMovil.addEventListener('change', (e) => {
    document.getElementById('filtroAlcance').value = e.target.value;
    cambiarAlcance(e.target.value);
  });
  
  document.getElementById('btnLocalizar').addEventListener('click', solicitarUbicacion);
  document.getElementById('btnEnviarDenuncia').addEventListener('click', enviarNuevaDenuncia);

  // Cargar datos de la Base de Datos Real
  cargarDatosDelBackend();
});

// === CONEXIÓN AL BACKEND ===
async function cargarDatosDelBackend() {
  try {
    const respuesta = await fetch('/api/alertas');
    if (!respuesta.ok) throw new Error('Error al conectar con la base de datos');
    
    // Convertir de formato SQLite a la estructura del frontend
    const filas = await respuesta.json();
    todasLasAlertas = filas.map(row => ({
      id: row.id,
      lat: row.lat, lng: row.lng,
      titulo: row.titulo, descripcion: row.descripcion,
      plataforma: row.plataforma, nivel: row.nivel,
      confirmaciones: row.confirmaciones, alcance: row.alcance,
      detalles: {
        mensaje_repetido: row.mensaje_repetido,
        victima_url: row.victima_url,
        cuentas_falsas: ["(Datos extraídos por la comunidad)"]
      }
    }));

    // Cargar la vista mundial por defecto
    cambiarAlcance(document.getElementById('filtroAlcance').value);
  } catch (error) {
    console.error(error);
    document.getElementById('feedAlertas').innerHTML = `<p class="text-red-500 text-sm p-4">Error conectando al servidor backend. Asegúrate de ejecutar 'node server.js'.</p>`;
  }
}

async function enviarNuevaDenuncia() {
  if (!usuarioAutenticado) {
    alert("🛡️ SEGURIDAD: Debes Iniciar Sesión primero usando el botón en la barra superior para evitar el spam de bots.");
    return;
  }
  
  const checkboxCaptcha = document.getElementById('checkCaptcha');
  if (checkboxCaptcha && !checkboxCaptcha.checked) {
    alert("🤖 SEGURIDAD: Por favor, marca la casilla de 'No soy un bot' (reCAPTCHA) para continuar.");
    return;
  }

  const btn = document.getElementById('btnEnviarDenuncia');
  const urlInfraccion = document.getElementById('inputUrl').value;
  const tipoInfraccion = document.getElementById('inputTipo').value;

  if (!urlInfraccion) {
    alert("Por favor ingresa un enlace o URL.");
    return;
  }

  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i> Enviando...';
  btn.disabled = true;

  const nuevaAlerta = {
    lat: ubicacionUsuario[0] + (Math.random() * 0.1 - 0.05), // Añade pequeña aleatoriedad local
    lng: ubicacionUsuario[1] + (Math.random() * 0.1 - 0.05),
    titulo: tipoInfraccion.split(' ')[1] || "Alerta Detectada",
    descripcion: `Posible campaña maliciosa detectada en ${urlInfraccion}`,
    plataforma: urlInfraccion.includes('facebook') ? 'Facebook' : urlInfraccion.includes('x.com') || urlInfraccion.includes('twitter') ? 'X (Twitter)' : 'Web',
    nivel: 'advertencia',
    alcance: document.getElementById('filtroAlcance').value,
    mensaje_repetido: "(Mensaje en evaluación por la comunidad)",
    victima_url: urlInfraccion
  };

  try {
    await fetch('/api/alertas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(nuevaAlerta)
    });
    
    // Recargar los datos desde el backend
    await cargarDatosDelBackend();
    
    document.getElementById('inputUrl').value = '';
    btn.innerHTML = '<i class="fa-solid fa-check mr-2"></i> Denuncia Registrada';
    btn.classList.replace('bg-gray-700', 'bg-green-600');
    
    setTimeout(() => {
      btn.innerHTML = '<i class="fa-solid fa-paper-plane mr-2"></i> Enviar Alerta al Sistema Comunitario';
      btn.classList.replace('bg-green-600', 'bg-gray-700');
      btn.disabled = false;
    }, 3000);
  } catch (error) {
    alert("Error al enviar. Verifica tu conexión al servidor.");
    btn.innerHTML = '<i class="fa-solid fa-paper-plane mr-2"></i> Enviar Alerta';
    btn.disabled = false;
  }
}

// === FUNCIONES DEL MAPA (Leaflet) ===
function inicializarMapa() {
  mapa = L.map('map').setView([0, 0], 2);
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri',
    maxZoom: 16
  }).addTo(mapa);
  capaMarcadores = L.layerGroup().addTo(mapa);
}

function actualizarMarcadores(alertasFiltradas) {
  capaMarcadores.clearLayers();
  const iconPeligro = L.divIcon({ html: '<i class="fa-solid fa-burst text-red-500 text-2xl drop-shadow-[0_0_8px_rgba(239,68,68,1)]"></i>', className: 'bg-transparent', iconSize: [24, 24], iconAnchor: [12, 12] });
  const iconAdvertencia = L.divIcon({ html: '<i class="fa-solid fa-radar text-yellow-500 text-2xl drop-shadow-[0_0_8px_rgba(234,179,8,1)]"></i>', className: 'bg-transparent', iconSize: [24, 24], iconAnchor: [12, 12] });

  alertasFiltradas.forEach(alerta => {
    const icon = alerta.nivel === 'peligro' ? iconPeligro : iconAdvertencia;
    L.marker([alerta.lat, alerta.lng], { icon: icon })
     .bindPopup(`<div class="text-gray-900 font-sans p-1"><strong class="text-sm block mb-1">${alerta.titulo}</strong><span class="text-xs text-gray-600 block">${alerta.plataforma}</span></div>`)
     .addTo(capaMarcadores);
  });
}

function cambiarAlcance(alcance) {
  let alertasParaMostrar = [];
  let zoom, lat, lng;
  let titulo = "Radar Global";

  if (alcance === 'zona') {
    alertasParaMostrar = todasLasAlertas.filter(a => a.alcance === 'zona');
    zoom = 12; lat = ubicacionUsuario[0]; lng = ubicacionUsuario[1];
    titulo = "Radar: Tu Zona Local";
  } else if (alcance === 'departamento') {
    alertasParaMostrar = todasLasAlertas.filter(a => ['zona', 'departamento'].includes(a.alcance));
    zoom = 7; lat = ubicacionUsuario[0]; lng = ubicacionUsuario[1];
    titulo = "Radar: Tu Departamento";
  } else if (alcance === 'pais') {
    alertasParaMostrar = todasLasAlertas.filter(a => ['zona', 'departamento', 'pais'].includes(a.alcance));
    zoom = 5; lat = ubicacionUsuario[0]; lng = ubicacionUsuario[1];
    titulo = "Radar: Tu País";
  } else if (alcance === 'continente') {
    alertasParaMostrar = todasLasAlertas.filter(a => ['zona', 'departamento', 'pais', 'continente'].includes(a.alcance));
    zoom = 3; lat = -15; lng = -60; 
    titulo = "Radar: Continente";
  } else {
    alertasParaMostrar = todasLasAlertas;
    zoom = 2; lat = 20; lng = 0;
    titulo = "Radar Global (Todo el mundo)";
  }

  document.getElementById('tituloMapa').innerHTML = `<i class="fa-solid fa-satellite-dish text-cyan-400 mr-2"></i>${titulo}`;
  mapa.flyTo([lat, lng], zoom, { duration: 1.5 });
  actualizarMarcadores(alertasParaMostrar);
  renderizarFeed(alertasParaMostrar);
}

function solicitarUbicacion() {
  const btn = document.getElementById('btnLocalizar');
  const txt = btn.innerHTML;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i>...';

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        ubicacionUsuario = [position.coords.latitude, position.coords.longitude];
        cambiarAlcance(document.getElementById('filtroAlcance').value);
        L.marker(ubicacionUsuario, {
          icon: L.divIcon({ html: '<i class="fa-solid fa-street-view text-cyan-400 text-3xl drop-shadow-[0_0_10px_rgba(34,211,238,1)]"></i>', className: 'bg-transparent', iconSize: [30, 30], iconAnchor: [15, 30] })
        }).addTo(mapa).bindPopup("Estás aquí").openPopup();
        btn.innerHTML = '<i class="fa-solid fa-check text-green-400 mr-1"></i> OK';
        setTimeout(() => btn.innerHTML = txt, 3000);
      },
      () => { btn.innerHTML = '<i class="fa-solid fa-triangle-exclamation text-red-400 mr-1"></i> Error'; setTimeout(() => btn.innerHTML = txt, 3000); }
    );
  }
}

// === FUNCIONES DEL FEED Y MODAL ===
function renderizarFeed(alertas) {
  const contenedor = document.getElementById('feedAlertas');
  document.getElementById('contadorAlertas').innerText = `${alertas.length} incidentes`;
  contenedor.innerHTML = '';

  if(alertas.length === 0) {
    contenedor.innerHTML = '<p class="text-gray-500 text-sm italic p-4 text-center">No hay alertas reportadas en esta área.</p>';
    return;
  }

  alertas.sort((a,b) => b.confirmaciones - a.confirmaciones).forEach(alerta => {
    const colorBorde = alerta.nivel === 'peligro' ? 'border-red-500/50' : 'border-yellow-500/50';
    const colorFondo = alerta.nivel === 'peligro' ? 'bg-red-900/20' : 'bg-yellow-900/20';
    let iconoPlat = 'fa-globe';
    if(alerta.plataforma.includes('Facebook')) iconoPlat = 'fa-facebook';
    if(alerta.plataforma.includes('X')) iconoPlat = 'fa-x-twitter';
    if(alerta.plataforma.includes('WhatsApp')) iconoPlat = 'fa-whatsapp';

    // Iconos de confiabilidad (Trust Score simulado basado en confirmaciones)
    let trustScore = Math.min(99, 50 + (alerta.confirmaciones * 2));
    let colorTrust = trustScore > 80 ? 'text-green-400' : 'text-yellow-400';

    contenedor.insertAdjacentHTML('beforeend', `
      <div onclick="abrirModal(${alerta.id})" class="alerta-card bg-gray-800 rounded-lg p-4 border-l-4 ${colorBorde} ${colorFondo} shadow-md relative overflow-hidden group">
        <div class="flex justify-between items-start mb-2">
          <h3 class="font-semibold text-sm text-white pr-6 leading-tight">${alerta.titulo}</h3>
          <i class="fa-brands ${iconoPlat} text-gray-500 text-lg absolute right-4 top-4 opacity-40 group-hover:opacity-100 transition"></i>
        </div>
        
        <p class="text-[10px] text-gray-500 mb-2 italic">Reportado por: Detective Anónimo <span class="${colorTrust} ml-1"><i class="fa-solid fa-shield-check"></i> Trust: ${trustScore}%</span></p>

        <p class="text-xs text-gray-300 mb-3 line-clamp-2">${alerta.descripcion}</p>
        <div class="flex items-center justify-between mt-auto">
          <span class="text-xs font-medium text-gray-500 flex items-center">
            <i class="fa-solid fa-users mr-1"></i> <span id="count-${alerta.id}">${alerta.confirmaciones.toLocaleString()}</span> verificaciones
          </span>
          <button onclick="confirmarAtaque(event, ${alerta.id}, this)" class="bg-gray-700 hover:bg-gray-600 border border-gray-600 text-xs px-3 py-1.5 rounded transition flex items-center text-white z-10 relative">
            <i class="fa-solid fa-triangle-exclamation text-yellow-400 mr-1.5"></i> Alertar
          </button>
        </div>
      </div>
    `);
  });
}

// === SIMULACIÓN DE LOGIN / SEGURIDAD ===
let usuarioAutenticado = false;

window.simularLogin = function() {
  usuarioAutenticado = true;
  
  // Actualizar Botón de Login en el Navbar
  const btnLogin = document.getElementById('btnLogin');
  btnLogin.innerHTML = '<img src="https://ui-avatars.com/api/?name=Admin&background=0D8ABC&color=fff" class="w-5 h-5 rounded-full mr-2"> Mi Cuenta';
  btnLogin.classList.replace('bg-gray-700', 'bg-cyan-900/50');
  
  // Habilitar el botón de Denunciar
  const btnDenunciar = document.getElementById('btnEnviarDenuncia');
  btnDenunciar.innerHTML = '<i class="fa-solid fa-paper-plane mr-2"></i> Enviar Alerta al Sistema Comunitario';
  btnDenunciar.classList.remove('opacity-50', 'cursor-not-allowed');
  
  alert("¡Sesión iniciada con éxito! Has pasado el control de seguridad. Ahora puedes enviar reportes al mapa.");
};

window.abrirModal = function(id) {
  const alerta = todasLasAlertas.find(a => a.id === id);
  if(!alerta) return;
  document.getElementById('modalTitulo').innerHTML = `<i class="fa-solid fa-magnifying-glass text-cyan-400 mr-2"></i>Evidencia: ${alerta.titulo}`;
  document.getElementById('modalDesc').innerText = alerta.descripcion;
  document.getElementById('modalMensaje').innerText = `"${alerta.detalles.mensaje_repetido}"`;
  document.getElementById('modalPerfil').href = alerta.detalles.victima_url;
  document.getElementById('modalPerfil').innerHTML = `<i class="fa-solid fa-link mr-1"></i>${alerta.detalles.victima_url}`;
  document.getElementById('modalCuentas').innerHTML = alerta.detalles.cuentas_falsas.map(c => `<li><i class="fa-solid fa-robot mr-2"></i>${c}</li>`).join('');
  document.getElementById('modalEvidencia').classList.remove('hidden');
};

window.cerrarModal = function() {
  document.getElementById('modalEvidencia').classList.add('hidden');
};
document.getElementById('modalEvidencia').addEventListener('click', (e) => {
  if (e.target.id === 'modalEvidencia') cerrarModal();
});

// Guardar validación en el Backend real
window.confirmarAtaque = async function(event, id, btnElement) {
  event.stopPropagation(); 
  
  btnElement.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1.5"></i>...';
  btnElement.disabled = true;

  try {
    await fetch(`/api/alertas/${id}/confirmar`, { method: 'POST' });
    const alerta = todasLasAlertas.find(a => a.id === id);
    alerta.confirmaciones++;
    
    btnElement.innerHTML = '<i class="fa-solid fa-check text-green-400 mr-1.5"></i> Validado';
    btnElement.classList.replace('bg-gray-700', 'bg-green-900/40');
    btnElement.classList.replace('border-gray-600', 'border-green-500/50');
    
    const contador = document.getElementById(`count-${id}`);
    contador.innerText = alerta.confirmaciones.toLocaleString();
    contador.classList.add('text-green-400', 'font-bold');
    setTimeout(() => { contador.classList.remove('text-green-400', 'font-bold'); }, 1000);
  } catch (error) {
    alert("Error de red conectando al backend.");
    btnElement.innerHTML = '<i class="fa-solid fa-triangle-exclamation text-yellow-400 mr-1.5"></i> Alertar';
    btnElement.disabled = false;
  }
};

// === GUÍA EDUCATIVA (MODAL) ===
window.abrirGuia = function() {
  document.getElementById('modalGuia').classList.remove('hidden');
};
window.cerrarGuia = function() {
  document.getElementById('modalGuia').classList.add('hidden');
};
document.getElementById('modalGuia').addEventListener('click', (e) => {
  if (e.target.id === 'modalGuia') cerrarGuia();
});
