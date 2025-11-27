// public/app.js

// ============================================================
// SESIÓN
// ============================================================
const adminUser = JSON.parse(localStorage.getItem('adminUser') || 'null');
if (!adminUser) {
  window.location.href = 'login.html';
}

document.getElementById('lblUsuario').textContent =
  'Administrador: ' + (adminUser.username || '').replace('Administrador', '').trim();

function cerrarSesion() {
  localStorage.removeItem('adminUser');
  window.location.href = 'login.html';
}
window.cerrarSesion = cerrarSesion;

// ============================================================
// ELEMENTOS DEL DOM
// ============================================================
const inputFinca = document.getElementById('inputFinca');
const inputIdent = document.getElementById('inputIdentificacion');
const btnBuscarFinca = document.getElementById('btnBuscarFinca');
const btnBuscarIdent = document.getElementById('btnBuscarIdentificacion');
const contPropiedadesCedula = document.getElementById('contenedorPropiedadesCedula');

const detallePropiedadDiv = document.getElementById('detallePropiedad');
const tbodyFacturasPendientes = document.getElementById('tbodyFacturasPendientes');
const tbodyFacturasPagadas = document.getElementById('tbodyFacturasPagadas');
const mensajeBusqueda = document.getElementById('mensajeBusqueda');
const resumenPendientesDiv = document.getElementById('resumenPendientes');

// Modal pago
const modalPago = document.getElementById('modalPago');
const selectMedioPago = document.getElementById('selectMedioPago');
const inputReferencia = document.getElementById('inputReferencia');
const btnConfirmarPago = document.getElementById('btnConfirmarPago');
const btnCancelarPago = document.getElementById('btnCancelarPago');
const mensajePago = document.getElementById('mensajePago');

// Elementos del resumen de pago
const resumenFinca = document.getElementById('resumenFinca');
const resumenFechaFactura = document.getElementById('resumenFechaFactura');
const resumenFechaVencimiento = document.getElementById('resumenFechaVencimiento');
const resumenFechaPago = document.getElementById('resumenFechaPago');
const resumenTotalOriginal = document.getElementById('resumenTotalOriginal');
const resumenDiasMora = document.getElementById('resumenDiasMora');
const resumenIntereses = document.getElementById('resumenIntereses');
const resumenTotalFinal = document.getElementById('resumenTotalFinal');

// Estado actual en frontend
let propiedadActual = null;
let facturasPendientesActual = [];
let facturasPagadasActual = [];
let resumenPagoActual = null;

// ============================================================
// FUNCIONES AUXILIARES
// ============================================================
function formatoFecha(fechaISO) {
  if (!fechaISO) return 'N/A';
  const f = new Date(fechaISO);
  if (Number.isNaN(f.getTime())) return 'Fecha inválida';
  const yyyy = f.getFullYear();
  const mm = String(f.getMonth() + 1).padStart(2, '0');
  const dd = String(f.getDate()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy}`;
}

function formatoDinero(monto) {
  if (monto == null || monto === undefined) return '₡0.00';
  const numero = Number(monto);
  if (Number.isNaN(numero)) return '₡0.00';
  return numero.toLocaleString('es-CR', {
    style: 'currency',
    currency: 'CRC',
    minimumFractionDigits: 2,
  });
}

function limpiarDato(dato, valorPorDefecto = 'N/A') {
  if (dato === null || dato === undefined || dato === '') {
    return valorPorDefecto;
  }
  if (typeof dato === 'string') {
    return dato.trim() || valorPorDefecto;
  }
  return dato;
}

function showLoading(element) {
  element.classList.add('loading');
  element.disabled = true;
  const originalText = element.innerHTML;
  element.setAttribute('data-original-text', originalText);
  element.innerHTML = '⏳ Procesando...';
}

function hideLoading(element) {
  element.classList.remove('loading');
  element.disabled = false;
  const originalText = element.getAttribute('data-original-text');
  if (originalText) {
    element.innerHTML = originalText;
  }
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${type === 'success'
      ? '#38a169'
      : type === 'error'
      ? '#e53e3e'
      : '#1a365d'};
    color: white;
    padding: 12px 20px;
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 10000;
    animation: slideInRight 0.3s ease;
  `;

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'slideOutRight 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Estilos de animación para el toast
if (!document.querySelector('#toast-styles')) {
  const style = document.createElement('style');
  style.id = 'toast-styles';
  style.textContent = `
    @keyframes slideInRight {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOutRight {
      from { transform: translateX(0); opacity: 1; }
      to { transform: translateX(100%); opacity: 0; }
    }
  `;
  document.head.appendChild(style);
}

// ============================================================
// RENDERIZAR
// ============================================================
function renderPropiedad() {
  if (!propiedadActual) {
    detallePropiedadDiv.innerHTML =
      '<p class="mensaje">No hay ninguna propiedad seleccionada.</p>';
    return;
  }

  const p = propiedadActual;
  detallePropiedadDiv.innerHTML = `
    <div class="detalle-grid">
      <div>
        <h3>Información básica</h3>
        <p><strong>Número de finca:</strong> ${limpiarDato(p.NumeroFinca)}</p>
        <p><strong>Número de medidor:</strong> ${limpiarDato(p.NumeroMedidor, 'No asignado')}</p>
        <p><strong>Valor fiscal:</strong> ${formatoDinero(p.ValorFiscal)}</p>
        <p><strong>Fecha registro:</strong> ${formatoFecha(p.FechaRegistro)}</p>
        <p><strong>Propietario:</strong> ${limpiarDato(p.PropietarioNombre, 'No asignado')}</p>
        <p><strong>Cédula:</strong> ${limpiarDato(p.PropietarioCedula)}</p>
      </div>
      <div>
        <h3>Clasificación y Consumo</h3>
        <p><strong>Uso:</strong> ${limpiarDato(
          p.TipoUsoNombre,
          limpiarDato(p.TipoUsoId, 'No especificado')
        )}</p>
        <p><strong>Zona:</strong> ${limpiarDato(
          p.TipoZonaNombre,
          limpiarDato(p.TipoZonaId, 'No especificada')
        )}</p>
        <p><strong>Metros cuadrados:</strong> ${limpiarDato(p.MetrosCuadrados, 0)} m²</p>
        <p><strong>Saldo m³ agua:</strong> ${limpiarDato(p.SaldoM3Agua, 0)} m³</p>
        <p><strong>Saldo m³ última factura:</strong> ${limpiarDato(
          p.SaldoM3UltimaFactura,
          0
        )} m³</p>
      </div>
    </div>
  `;
}

function renderResumenPendientes() {
  if (!propiedadActual) {
    resumenPendientesDiv.innerHTML = '';
    return;
  }

  if (!facturasPendientesActual || facturasPendientesActual.length === 0) {
    resumenPendientesDiv.innerHTML =
      '<div class="alert-box"><strong>No hay facturas pendientes de pago para esta propiedad.</strong></div>';
    return;
  }

  const cantidad = facturasPendientesActual.length;
  const totalAdeudado = facturasPendientesActual.reduce(
    (acc, f) => acc + Number(f.TotalFinal || 0),
    0
  );

  resumenPendientesDiv.innerHTML = `
    <div class="highlight">
      <p>
        <strong>Importante:</strong> Tiene
        <strong>${cantidad} factura${cantidad > 1 ? 's' : ''} pendiente${
    cantidad > 1 ? 's' : ''
  }</strong>
        con un total adeudado de
        <strong>${formatoDinero(totalAdeudado)}</strong>.
        Realice el pago antes de la fecha de vencimiento para evitar recargos.
      </p>
    </div>
  `;
}

function renderFacturas() {
  // Limpiar tablas
  tbodyFacturasPendientes.innerHTML = '';
  tbodyFacturasPagadas.innerHTML = '';

  // Resumen
  renderResumenPendientes();

  if (!propiedadActual) {
    tbodyFacturasPendientes.innerHTML = `
      <tr>
        <td colspan="7" class="text-center">Seleccione primero una propiedad</td>
      </tr>
    `;
    tbodyFacturasPagadas.innerHTML = `
      <tr>
        <td colspan="6" class="text-center">Seleccione primero una propiedad</td>
      </tr>
    `;
    return;
  }

  // --------- PENDIENTES ---------
  if (!facturasPendientesActual || facturasPendientesActual.length === 0) {
    tbodyFacturasPendientes.innerHTML = `
      <tr>
        <td colspan="7" class="text-center">No hay facturas pendientes</td>
      </tr>
    `;
  } else {
    facturasPendientesActual.forEach((factura, index) => {
      const hoy = new Date();
      const fechaVencimiento = new Date(factura.FechaVencimiento);
      const estaVencida = fechaVencimiento < hoy;
      const esLaMasAntigua = index === 0;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${formatoFecha(factura.FechaFactura)}</td>
        <td>${formatoFecha(factura.FechaVencimiento)}</td>
        <td>
          <span class="status-badge ${
            estaVencida ? 'status-overdue' : 'status-pending'
          }">
            ${estaVencida ? 'Vencida' : 'Pendiente'}
          </span>
        </td>
        <td>${formatoFecha(factura.FechaCuotaAgua)}</td>
        <td>${formatoDinero(factura.TotalOriginal)}</td>
        <td>${formatoDinero(factura.TotalFinal)}</td>
        <td class="invoice-actions">
          ${
            esLaMasAntigua
              ? `<button class="btn btn-primary btn-pagar">Pagar ahora</button>`
              : `<button class="btn btn-desactivado" disabled>Pagar ahora</button>`
          }
        </td>
      `;

      if (esLaMasAntigua) {
        const btnPagar = tr.querySelector('.btn-pagar');
        btnPagar.addEventListener('click', () => iniciarPago());
      }

      tbodyFacturasPendientes.appendChild(tr);
    });
  }

  // --------- PAGADAS ---------
  if (!facturasPagadasActual || facturasPagadasActual.length === 0) {
    tbodyFacturasPagadas.innerHTML = `
      <tr>
        <td colspan="6" class="text-center">No hay facturas pagadas</td>
      </tr>
    `;
  } else {
    facturasPagadasActual.forEach((f) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${formatoFecha(f.FechaFactura)}</td>
        <td>${formatoFecha(f.FechaVencimiento)}</td>
        <td>${formatoFecha(f.FechaCuotaAgua)}</td>
        <td>${formatoDinero(f.TotalOriginal)}</td>
        <td>${formatoDinero(f.TotalFinal)}</td>
        <td><span class="status-badge status-paid">Pagado</span></td>
      `;
      tbodyFacturasPagadas.appendChild(tr);
    });
  }
}

// Mostrar lista de propiedades cuando se busca por identificación
function renderPropiedadesPorCedula(lista) {
  contPropiedadesCedula.innerHTML = '';

  if (!lista || lista.length === 0) {
    contPropiedadesCedula.innerHTML =
      '<p class="mensaje">No se encontraron propiedades.</p>';
    return;
  }

  const container = document.createElement('div');
  container.className = 'card-propiedades-cedula';

  const titulo = document.createElement('h3');
  titulo.textContent = 'Propiedades asociadas al propietario';
  container.appendChild(titulo);

  const tabla = document.createElement('table');
  tabla.className = 'tabla tabla-mini';
  tabla.innerHTML = `
    <thead>
      <tr>
        <th>Número finca</th>
        <th>Medidor</th>
        <th>Valor fiscal</th>
        <th>Propietario</th>
        <th>Seleccionar</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;
  const tbody = tabla.querySelector('tbody');

  lista.forEach((p) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${limpiarDato(p.NumeroFinca)}</td>
      <td>${limpiarDato(p.NumeroMedidor, 'No asignado')}</td>
      <td>${formatoDinero(p.ValorFiscal)}</td>
      <td>${limpiarDato(p.NombrePropietario)}</td>
      <td><button class="btn btn-secondary btn-elegir-prop">Elegir</button></td>
    `;
    const btn = tr.querySelector('.btn-elegir-prop');
    btn.addEventListener('click', () => {
      inputFinca.value = p.NumeroFinca;
      contPropiedadesCedula.innerHTML = '';
      buscarPorFinca();
    });

    tbody.appendChild(tr);
  });

  container.appendChild(tabla);
  contPropiedadesCedula.appendChild(container);
}

// ============================================================
// LLAMADAS A LA API
// ============================================================
async function buscarPorFinca() {
  const finca = inputFinca.value.trim();
  if (!finca) {
    showToast('Debe digitar un número de finca', 'error');
    return;
  }

  showLoading(btnBuscarFinca);
  mensajeBusqueda.textContent = '🔍 Buscando propiedad...';
  mensajeBusqueda.style.color = '#2c3e50';
  contPropiedadesCedula.innerHTML = '';

  try {
    const res = await fetch(`/api/propiedades/finca/${encodeURIComponent(finca)}`);
    const data = await res.json();

    if (!data.success) {
      mensajeBusqueda.textContent = data.message || 'No se encontró la propiedad.';
      mensajeBusqueda.style.color = '#e53e3e';
      propiedadActual = null;
      facturasPendientesActual = [];
      facturasPagadasActual = [];
      renderPropiedad();
      renderFacturas();
      return;
    }

    mensajeBusqueda.textContent = '✅ Propiedad encontrada correctamente';
    mensajeBusqueda.style.color = '#38a169';
    propiedadActual = data.propiedad;
    facturasPendientesActual = data.facturasPendientes || [];
    facturasPagadasActual = data.facturasPagadas || [];
    renderPropiedad();
    renderFacturas();
  } catch (err) {
    console.error('Error al buscar por finca:', err);
    mensajeBusqueda.textContent = 'Error al consultar el servidor.';
    mensajeBusqueda.style.color = '#e53e3e';
    showToast('Error de conexión con el servidor', 'error');
  } finally {
    hideLoading(btnBuscarFinca);
  }
}

async function buscarPorIdentificacion() {
  const ident = inputIdent.value.trim();
  if (!ident) {
    showToast('Debe digitar un número de identificación', 'error');
    return;
  }

  showLoading(btnBuscarIdent);
  mensajeBusqueda.textContent = '🔍 Buscando propiedades...';
  mensajeBusqueda.style.color = '#2c3e50';

  try {
    const res = await fetch(
      `/api/propiedades/identificacion/${encodeURIComponent(ident)}`
    );
    const data = await res.json();

    if (!data.success) {
      mensajeBusqueda.textContent =
        data.message || 'No se encontraron propiedades para esa identificación.';
      mensajeBusqueda.style.color = '#e53e3e';
      contPropiedadesCedula.innerHTML = '';
      return;
    }

    mensajeBusqueda.textContent =
      '✅ Propiedades encontradas. Seleccione una de la lista.';
    mensajeBusqueda.style.color = '#38a169';
    renderPropiedadesPorCedula(data.propiedades);
  } catch (err) {
    console.error('Error al buscar por identificación:', err);
    mensajeBusqueda.textContent = 'Error al consultar el servidor.';
    mensajeBusqueda.style.color = '#e53e3e';
    showToast('Error de conexión con el servidor', 'error');
  } finally {
    hideLoading(btnBuscarIdent);
  }
}

// ============================================================
// FLUJO DE PAGO
// ============================================================
async function iniciarPago() {
  if (!propiedadActual) return;

  try {
    const params = new URLSearchParams({
      numeroFinca: propiedadActual.NumeroFinca,
    }).toString();

    const res = await fetch(`/api/facturas/resumen-pago?${params}`);
    const data = await res.json();

    if (!data.success) {
      showToast(data.message || 'No se pudo calcular el resumen de pago.', 'error');
      return;
    }

    resumenPagoActual = data.resumen;

    // Actualizar información en el modal
    resumenFinca.textContent = limpiarDato(resumenPagoActual.numeroFinca);
    resumenFechaFactura.textContent = formatoFecha(resumenPagoActual.fechaFactura);
    resumenFechaVencimiento.textContent = formatoFecha(
      resumenPagoActual.fechaVencimiento
    );
    resumenFechaPago.textContent = formatoFecha(resumenPagoActual.fechaPago);
    resumenTotalOriginal.textContent = formatoDinero(resumenPagoActual.totalOriginal);
    resumenDiasMora.textContent = `${limpiarDato(resumenPagoActual.diasMora, 0)} días`;
    resumenIntereses.textContent = formatoDinero(resumenPagoActual.interesMoratorio);
    resumenTotalFinal.textContent = formatoDinero(resumenPagoActual.totalFinal);

    mensajePago.textContent = '';
    inputReferencia.value = '';
    selectMedioPago.value = '1';
    modalPago.style.display = 'flex';
  } catch (err) {
    console.error('Error en iniciarPago:', err);
    showToast('Error al calcular el resumen de pago.', 'error');
  }
}

async function confirmarPago() {
  if (!resumenPagoActual || !propiedadActual) return;

  const tipoMedioPagoId = parseInt(selectMedioPago.value, 10);
  const numeroReferencia = inputReferencia.value.trim();

  showLoading(btnConfirmarPago);
  mensajePago.textContent = '⏳ Procesando pago...';
  mensajePago.style.color = '#2c3e50';

  try {
    const res = await fetch('/api/facturas/pagar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        numeroFinca: propiedadActual.NumeroFinca,
        tipoMedioPagoId,
        numeroReferencia,
        fechaPago: resumenPagoActual.fechaPago,
      }),
    });

    const data = await res.json();

    if (!data.success) {
      mensajePago.textContent = data.message || 'No se pudo procesar el pago.';
      mensajePago.style.color = '#e53e3e';
      return;
    }

    mensajePago.textContent = '✅ Factura pagada correctamente. Actualizando lista...';
    mensajePago.style.color = '#38a169';
    showToast('Factura pagada correctamente', 'success');

    facturasPendientesActual = data.facturasPendientes || [];
    facturasPagadasActual = data.facturasPagadas || [];
    renderFacturas();

    setTimeout(() => {
      modalPago.style.display = 'none';
      mensajePago.textContent = '';
    }, 2000);
  } catch (err) {
    console.error('Error al confirmar pago:', err);
    mensajePago.textContent = 'Error en el servidor.';
    mensajePago.style.color = '#e53e3e';
    showToast('Error al procesar el pago', 'error');
  } finally {
    hideLoading(btnConfirmarPago);
  }
}

// ============================================================
// EVENT LISTENERS
// ============================================================
btnBuscarFinca.addEventListener('click', buscarPorFinca);
btnBuscarIdent.addEventListener('click', buscarPorIdentificacion);

inputFinca.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') buscarPorFinca();
});

inputIdent.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') buscarPorIdentificacion();
});

btnCancelarPago.addEventListener('click', () => {
  modalPago.style.display = 'none';
  mensajePago.textContent = '';
});

btnConfirmarPago.addEventListener('click', confirmarPago);

window.addEventListener('click', (e) => {
  if (e.target === modalPago) {
    modalPago.style.display = 'none';
  }
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && modalPago.style.display === 'flex') {
    modalPago.style.display = 'none';
  }
});

// Inicializar
document.addEventListener('DOMContentLoaded', () => {
  console.log('Portal Administrador inicializado correctamente');
  renderFacturas();
});
