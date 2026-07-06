const { createClient } = supabase;

// ==========================================
// 1. CREDENCIALES
// ==========================================
const supabaseUrl = 'https://dnuqekwfbzyqwlcslmyi.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRudXFla3dmYnp5cXdsY3NsbXlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwNDE5MDcsImV4cCI6MjA5ODYxNzkwN30.MVcWZ9pBH93igxUkaUj5uT-mGKD63dPRBEhvOqwo7wg'; 
const clienteSupabase = createClient(supabaseUrl, supabaseAnonKey);

// ==========================================
// 2. FILTRO ANTI-TROLLS
// ==========================================
const PALABRAS_BANEADAS = ['estafa']; 

function filtrarTexto(texto) {
  if (!texto) return texto;
  let textoLimpio = texto;
  PALABRAS_BANEADAS.forEach(palabra => {
    const regex = new RegExp(palabra, 'gi');
    textoLimpio = textoLimpio.replace(regex, '*****');
  });
  return textoLimpio;
}

// ==========================================
// 3. ELEMENTOS DEL DOM
// ==========================================
const btnIngresar = document.getElementById('btn-ingresar');
const usernameInput = document.getElementById('username-input');
const btnEnviar = document.getElementById('btn-enviar');
const btnAdjuntar = document.getElementById('btn-adjuntar');
const mensajeInput = document.getElementById('mensaje-input');
const listaMensajes = document.getElementById('lista-mensajes');
const reproductorUsuario = document.getElementById('reproductor-usuario');
const reproductorContenido = document.getElementById('reproductor-contenido');
const barraProgreso = document.getElementById('barra-progreso');
const btnOmitir = document.getElementById('btn-omitir');

// ==========================================
// 4. ESTADO GLOBAL Y BROADCAST
// ==========================================
const canalBroadcast = clienteSupabase.channel('canal-proyeccion');
canalBroadcast.subscribe();

let archivoSeleccionado = null;
let colaReproduccion = [];
let estaReproduciendo = false;
const TIEMPO_REPRODUCCION_MS = 20000; 
let timeoutReproduccion = null;

const selectorArchivos = document.createElement('input');
selectorArchivos.type = 'file';
selectorArchivos.accept = 'image/*,video/*';
selectorArchivos.style.display = 'none';
document.body.appendChild(selectorArchivos);

// ==========================================
// 5. EVENTOS: REGISTRO
// ==========================================
if (btnIngresar) {
    btnIngresar.addEventListener('click', async () => {
        const usernameInput = document.getElementById('username-input');
        const nombre = (usernameInput && usernameInput.value) ? usernameInput.value.trim() : 'Anonimo';
        
        console.log("Intentando ingresar:", nombre);
        btnIngresar.textContent = 'Entrando...';

        try {
            const { data, error } = await clienteSupabase
                .from('users')
                .insert([{ username: nombre }])
                .select();

            if (error) {
                console.error("Error:", error);
                alert("Error de conexión");
            } else {
                localStorage.setItem('userId', data[0].id);
                document.getElementById('registro-pantalla').style.display = 'none';
                document.getElementById('pantalla-principal').style.display = 'flex';
            }
        } catch (e) {
            console.error("Error fatal:", e);
        }
    });
}
// ==========================================
// 6. EVENTOS: ADJUNTAR
// ==========================================
window.addEventListener('DOMContentLoaded', (event) => {
    const btnAdjuntar = document.getElementById('btn-adjuntar');
    const selectorArchivos = document.querySelector('input[type="file"]');

    if (btnAdjuntar) {
        btnAdjuntar.addEventListener('click', () => {
            if (selectorArchivos) selectorArchivos.click();
        });
    }

    if (selectorArchivos) {
        selectorArchivos.addEventListener('change', () => {
            if (selectorArchivos.files.length > 0 && btnAdjuntar) {
                btnAdjuntar.classList.add('btn-cargado');
                btnAdjuntar.textContent = '✅ CARGADO';
            }
        });
    }
});
// ==========================================
// 7. EVENTOS: ENVIAR
// ==========================================
if (btnEnviar) {
  btnEnviar.addEventListener('click', async () => {
    let textoMensaje = mensajeInput ? mensajeInput.value.trim() : '';
    // CAMBIO 1: Usar localStorage en lugar de sessionStorage
    const usuarioId = localStorage.getItem('userId'); 

    // CAMBIO 2: Avisar si el usuario no está logueado
    if (!usuarioId) {
      alert("Error: Sesión no encontrada. Por favor recarga la página.");
      return;
    }

    if (!textoMensaje && !archivoSeleccionado) {
      return; // No hacer nada si no hay nada que enviar
    }

    btnEnviar.textContent = 'Subiendo...';
    btnEnviar.disabled = true;

    let urlDelArchivo = null;
    let tipoDeArchivo = 'text';

    try {
      if (archivoSeleccionado) {
        tipoDeArchivo = archivoSeleccionado.type.startsWith('video/') ? 'video' : 'image';
        const nombreUnico = `${Date.now()}_${archivoSeleccionado.name}`;

        const { error: uploadError } = await clienteSupabase.storage
          .from('multimedia-tonazo')
          .upload(nombreUnico, archivoSeleccionado);

        if (uploadError) throw uploadError;

        const { data: urlData } = clienteSupabase.storage.from('multimedia-tonazo').getPublicUrl(nombreUnico);
        urlDelArchivo = urlData.publicUrl;
      }

      // CAMBIO 3: Añadimos un console.log para depurar en el móvil
      console.log("Intentando insertar en Supabase...");

      const { error: insertError } = await clienteSupabase.from('messages').insert([{ 
        content: textoMensaje || null, 
        user_id: usuarioId, 
        file_url: urlDelArchivo, 
        file_type: tipoDeArchivo, 
        status: 'pendiente' 
      }]);

      if (insertError) throw insertError;

      // Limpieza de interfaz
      if (mensajeInput) mensajeInput.value = '';
      archivoSeleccionado = null;
      
      alert("¡Enviado con éxito!"); // Feedback para el móvil

    } catch (err) {
      console.error("Error completo:", err);
      alert("Fallo al enviar: " + err.message);
    } finally {
      btnEnviar.textContent = 'Enviar a la cola';
      btnEnviar.disabled = false;
    }
    
    if (btnAdjuntar) {
      btnAdjuntar.textContent = '📎 Adjuntar';
      btnAdjuntar.style.borderColor = '#ff1493';
      btnAdjuntar.style.color = '#ff1493';
    }
    
    btnEnviar.textContent = 'Enviar a la cola';
    btnEnviar.disabled = false;
  });
}

// ==========================================
// 8. ESCUCHADOR EN TIEMPO REAL
// ==========================================
clienteSupabase
  .channel('cambios-en-tablas')
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async (payload) => {
    console.log("¡ALERTA MÁXIMA: Realtime detectó un mensaje nuevo!", payload);
    
    try {
      const nuevoMsg = payload.new;
      let nombreDelEmisor = '@anonimo';

      // Buscamos el usuario con un escudo protector para que si falla, no congele la pantalla
      try {
        const { data: userData } = await clienteSupabase
          .from('users')
          .select('username')
          .eq('id', nuevoMsg.user_id);
        
        if (userData && userData.length > 0) {
          nombreDelEmisor = userData[0].username;
        }
      } catch (userErr) {
        console.error("No se pudo obtener el nombre del usuario, usando @anonimo:", userErr);
      }

      console.log("Procesando contenido para reproducir. Emisor:", nombreDelEmisor);

      // Asegurar valores por si vienen nulos de la DB
      const textoFinal = nuevoMsg.content || '';
      const tipoFinal = nuevoMsg.file_type || 'text';
      const urlFinal = nuevoMsg.file_url || null;

      // 1. Añadir a la lista visual izquierda si existe
      let nuevaFila = null;
      if (listaMensajes) {
        nuevaFila = document.createElement('li');
        nuevaFila.className = 'item-playlist';
        nuevaFila.innerHTML = `<span class="item-username">${nombreDelEmisor}</span><span class="badge-tipo">${tipoFinal.toUpperCase()}</span>`;
        listaMensajes.appendChild(nuevaFila);
      }

      // 2. Insertar a la cola de reproducción interna
      colaReproduccion.push({
        usuario: nombreDelEmisor,
        texto: textoFinal,
        tipo: tipoFinal,
        url: urlFinal,
        elementoLista: nuevaFila
      });

      console.log("Cola de reproducción actual:", colaReproduccion);

      // 3. Si el motor está apagado, lo encendemos de inmediato
      if (!estaReproduciendo) {
        console.log("El reproductor estaba libre. ¡Arrancando motor!");
        reproducirSiguiente();
      }

    } catch (criticalErr) {
      console.error("Error crítico dentro del escuchador de Realtime:", criticalErr);
    }
  })
  .subscribe((status) => {
    console.log("ESTADO DE LA CONEXIÓN EN TIEMPO REAL:", status);
  });
// ==========================================
// 9. MOTOR REPRODUCTOR
// ==========================================
function reproducirSiguiente() {
  clearTimeout(timeoutReproduccion);

  if (colaReproduccion.length === 0) {
    estaReproduciendo = false;
    if (reproductorUsuario) reproductorUsuario.textContent = '@nadie';
    if (reproductorContenido) {
      reproductorContenido.innerHTML = '<h2 class="mensaje-vacio">Esperando el próximo mensaje...</h2>';
    }
    if (barraProgreso) {
      barraProgreso.style.transition = 'none';
      barraProgreso.style.width = '0%';
    }
    if (btnOmitir) btnOmitir.style.display = 'none';
    return;
  }

  estaReproduciendo = true;
  if (btnOmitir) btnOmitir.style.display = 'block';
  
  const itemActual = colaReproduccion.shift();
  
  if (listaMensajes && itemActual.elementoLista && listaMensajes.contains(itemActual.elementoLista)) {
    listaMensajes.removeChild(itemActual.elementoLista);
  }

  if (reproductorUsuario) reproductorUsuario.textContent = itemActual.usuario;

  let htmlContenido = '';
  if (itemActual.texto) htmlContenido += `<div class="texto-reproduccion">${itemActual.texto}</div>`;
  if (itemActual.tipo === 'image') htmlContenido += `<img src="${itemActual.url}" class="media-reproduccion">`;
  if (itemActual.tipo === 'video') htmlContenido += `<video src="${itemActual.url}" class="media-reproduccion" autoplay muted loop></video>`;

  if (reproductorContenido) {
    reproductorContenido.innerHTML = `<div class="animar-entrada">${htmlContenido}</div>`;
  }

  try {
    canalBroadcast.send({
      type: 'broadcast',
      event: 'renderizar-media',
      payload: {
        usuario: itemActual.usuario,
        texto: itemActual.texto,
        tipo: itemActual.tipo,
        url: itemActual.url
      }
    });
  } catch (err) {
    console.error(err);
  }

  if (barraProgreso) {
    barraProgreso.style.transition = 'none';
    barraProgreso.style.width = '0%';
    setTimeout(() => {
      barraProgreso.style.transition = `width ${TIEMPO_REPRODUCCION_MS}ms linear`;
      barraProgreso.style.width = '100%';
    }, 50);
  }

  timeoutReproduccion = setTimeout(() => {
    reproducirSiguiente();
  }, TIEMPO_REPRODUCCION_MS);
}

// ==========================================
// 10. EVENTO BOTÓN CORTAR
// ==========================================
if (btnOmitir) {
  btnOmitir.addEventListener('click', () => {
    if (estaReproduciendo) {
      try {
        canalBroadcast.send({
          type: 'broadcast',
          event: 'admin-cortar',
          payload: {}
        });
      } catch (err) {
        console.error(err);
      }
      reproducirSiguiente();
    }
  });
}
