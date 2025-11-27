require('dotenv').config();
const express = require('express');
const sql = require('mssql');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// =========================
// Configuración de SQL Server
// =========================
const dbConfig = {
  user: process.env.DB_USER || 'Camila',
  password: process.env.DB_PASSWORD || 'CamilaThompson04',
  server: process.env.DB_SERVER || 'mssql-201669-0.cloudclusters.net',
  port: parseInt(process.env.DB_PORT || '10029'),
  database: process.env.DB_NAME || 'Proyecto3-Camila',
  options: {
    encrypt: true,
    trustServerCertificate: true,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

let globalPool = null;

async function getPool() {
  if (globalPool) {
    return globalPool;
  }
  globalPool = await sql.connect(dbConfig);
  console.log('✅ Conectado a SQL Server');
  return globalPool;
}

// =========================
// Middlewares
// =========================
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// =========================
// Rutas básicas de vistas
// =========================
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/app', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// =========================
// Helpers
// =========================
function mapLoginError(code) {
  switch (code) {
    case 50001:
      return 'El usuario no existe.';
    case 50002:
      return 'La contraseña es incorrecta.';
    default:
      return 'Error al validar las credenciales.';
  }
}

function mapConsultaFincaError(code) {
  switch (code) {
    case 51001:
      return 'El número de finca es obligatorio.';
    case 51002:
      return 'No existe una propiedad con ese número de finca.';
    default:
      return 'Error al consultar la información de la propiedad.';
  }
}

function mapConsultaCedulaError(code) {
  switch (code) {
    case 50001:
      return 'La cédula es obligatoria.';
    case 50002:
      return 'No existe una persona con esa cédula.';
    case 50003:
      return 'La persona no tiene propiedades activas.';
    default:
      return 'Error al consultar propiedades por cédula.';
  }
}

function mapPagoError(code) {
  switch (code) {
    case 52001:
      return 'El número de finca es obligatorio.';
    case 52002:
      return 'El medio de pago es inválido.';
    case 52003:
      return 'La propiedad no existe.';
    case 52004:
      return 'La propiedad no tiene facturas pendientes.';
    default:
      return 'Error al procesar el pago de la factura.';
  }
}

function formatDateOnly(jsDate) {
  if (!jsDate) return null;
  const d = new Date(jsDate);
  if (Number.isNaN(d.getTime())) return null;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// Función para limpiar y formatear datos
function cleanData(data) {
  if (Array.isArray(data)) {
    return data.map(item => cleanData(item));
  }
  
  if (data && typeof data === 'object') {
    const cleaned = {};
    for (const [key, value] of Object.entries(data)) {
      if (value === null || value === undefined) {
        cleaned[key] = '';
      } else if (typeof value === 'string') {
        cleaned[key] = value.trim();
      } else {
        cleaned[key] = value;
      }
    }
    return cleaned;
  }
  
  return data;
}

// =========================
// ENDPOINTS API 
// =========================

// ---- Login ----
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Usuario y contraseña son obligatorios.',
      });
    }

    const pool = await getPool();
    const request = pool.request();
    request.input('inUser', sql.NVarChar(100), username);
    request.input('inPassword', sql.NVarChar(100), password);
    request.output('outResultCode', sql.Int);

    const result = await request.execute('SP_LoginApp');
    const code = result.output.outResultCode;

    if (code !== 0) {
      return res.json({
        success: false,
        code,
        message: mapLoginError(code),
      });
    }

    // Obtener info básica del usuario para mostrar en pantalla
    const userQuery = await pool
      .request()
      .input('username', sql.NVarChar(100), username)
      .query('SELECT TOP 1 Id, Username FROM Usuario WHERE Username = @username');

    const user = userQuery.recordset[0] || { Username: username };

    return res.json({
      success: true,
      message: 'Inicio de sesión exitoso.',
      user: {
        id: user.Id,
        username: user.Username,
      },
    });
  } catch (err) {
    console.error('Error en /api/login:', err);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor al iniciar sesión.',
    });
  }
});

// ---- Consulta por número de finca ----
app.get('/api/propiedades/finca/:numeroFinca', async (req, res) => {
  try {
    const numeroFinca = (req.params.numeroFinca || '').trim();

    if (!numeroFinca) {
      return res.json({
        success: false,
        code: 51001,
        message: 'Debes ingresar un número de finca.',
      });
    }

    const pool = await getPool();
    const request = pool.request();
    request.input('inNumeroFinca', sql.NVarChar(50), numeroFinca);
    request.output('outResultCode', sql.Int);

    const result = await request.execute('SP_ConsuFacturaxPropiedad');
    const code = result.output.outResultCode;

    if (code !== 0) {
      return res.json({
        success: false,
        code,
        message: mapConsultaFincaError(code),
      });
    }

    // Obtener todos los recordsets
    const propiedadData = result.recordsets[0]?.[0] || null;
    let facturasPendientes = result.recordsets[1] || [];
    const facturasPagadas = result.recordsets[2] || [];

    // ORDENAR facturas pendientes por fecha de vencimiento
    facturasPendientes = facturasPendientes.sort((a, b) => {
      const fechaA = new Date(a.FechaVencimiento);
      const fechaB = new Date(b.FechaVencimiento);
      return fechaA - fechaB;
    });

    // Formatear propiedad con datos completos
    let propiedad = null;
    if (propiedadData) {
      propiedad = {
        Id: propiedadData.Id,
        NumeroFinca: propiedadData.NumeroFinca || numeroFinca,
        NumeroMedidor: propiedadData.NumeroMedidor || 'No asignado',
        MetrosCuadrados: propiedadData.MetrosCuadrados || 0,
        ValorFiscal: propiedadData.ValorFiscal || 0,
        FechaRegistro: propiedadData.FechaRegistro,
        SaldoM3Agua: propiedadData.SaldoM3Agua || 0,
        SaldoM3UltimaFactura: propiedadData.SaldoM3UltimaFactura || 0,
        TipoUsoNombre: propiedadData.TipoUso || 'No especificado',
        TipoZonaNombre: propiedadData.TipoZona || 'No especificada',
        TipoUsoId: propiedadData.TipoUsoId || '',
        TipoZonaId: propiedadData.TipoZonaId || '',
        PropietarioNombre: propiedadData.PropietarioNombre || 'No asignado',
        PropietarioCedula: propiedadData.PropietarioCedula || 'N/A'
      };
    }

    // Formatear facturas pendientes
    const facturasPendientesFormateadas = facturasPendientes.map(factura => ({
      FechaFactura: factura.FechaFactura,
      FechaVencimiento: factura.FechaVencimiento,
      FechaCuotaAgua: factura.FechaCuotaAgua,
      TotalOriginal: factura.TotalOriginal || 0,
      TotalFinal: factura.TotalFinal || 0,
      Estado: factura.Estado || 'Pendiente'
    }));

    // Formatear facturas pagadas 
    const facturasPagadasFormateadas = facturasPagadas.map(factura => ({
      FechaFactura: factura.FechaFactura,
      FechaVencimiento: factura.FechaVencimiento,
      FechaCuotaAgua: factura.FechaCuotaAgua,
      TotalOriginal: factura.TotalOriginal || 0,
      TotalFinal: factura.TotalFinal || 0,
      Estado: factura.Estado || 'PagadoNormal'
    }));

    return res.json({
      success: true,
      propiedad: cleanData(propiedad),
      facturasPendientes: cleanData(facturasPendientesFormateadas),
      facturasPagadas: cleanData(facturasPagadasFormateadas),
    });
  } catch (err) {
    console.error('Error en GET /api/propiedades/finca:', err);
    return res.status(500).json({
      success: false,
      message: 'Error interno al consultar la propiedad.',
    });
  }
});

// ---- Consulta de propiedades por cédula ----
app.get('/api/propiedades/identificacion/:cedula', async (req, res) => {
  try {
    const cedula = (req.params.cedula || '').trim();

    if (!cedula) {
      return res.json({
        success: false,
        code: 50001,
        message: 'Debes ingresar una cédula.',
      });
    }

    const pool = await getPool();
    const request = pool.request();
    request.input('inCedula', sql.NVarChar(50), cedula);
    request.output('outResultCode', sql.Int);

    const result = await request.execute('SP_ListaPropiedadesCedula');
    const code = result.output.outResultCode;

    if (code !== 0) {
      return res.json({
        success: false,
        code,
        message: mapConsultaCedulaError(code),
      });
    }

    let propiedades = result.recordset || [];
    
    // Formatear propiedades con datos completos
    propiedades = propiedades.map(prop => ({
      Id: prop.Id,
      NumeroFinca: prop.NumeroFinca || 'N/A',
      NumeroMedidor: prop.NumeroMedidor || 'No asignado',
      MetrosCuadrados: prop.MetrosCuadrados || 0,
      ValorFiscal: prop.ValorFiscal || 0,
      FechaRegistro: prop.FechaRegistro,
      SaldoM3Agua: prop.SaldoM3Agua || 0,
      SaldoM3UltimaFactura: prop.SaldoM3UltimaFactura || 0,
      NombrePropietario: prop.NombrePropietario || 'No especificado',
      Cedula: prop.Cedula || cedula,
      Email: prop.Email || '',
      Telefono: prop.Telefono || '',
      TipoUso: prop.TipoUso || 'No especificado',
      TipoZona: prop.TipoZona || 'No especificada'
    }));

    return res.json({
      success: true,
      propiedades: cleanData(propiedades),
    });
  } catch (err) {
    console.error('Error en GET /api/propiedades/identificacion:', err);
    return res.status(500).json({
      success: false,
      message: 'Error interno al consultar propiedades por cédula.',
    });
  }
});

// ---- Resumen de pago de factura pendiente ----
app.get('/api/facturas/resumen-pago', async (req, res) => {
  try {
    const numeroFinca = (req.query.numeroFinca || '').trim();
    const fechaPagoStr = (req.query.fechaPago || '').trim();

    if (!numeroFinca) {
      return res.json({
        success: false,
        message: 'El número de finca es obligatorio.',
      });
    }

    const pool = await getPool();

    // Buscar propiedad
    const propResult = await pool
      .request()
      .input('numeroFinca', sql.NVarChar(50), numeroFinca)
      .query(`
        SELECT TOP 1 Id, NumeroFinca
        FROM Propiedad
        WHERE NumeroFinca = @numeroFinca
      `);

    if (propResult.recordset.length === 0) {
      return res.json({
        success: false,
        message: 'No existe una propiedad con ese número de finca.',
      });
    }

    const idPropiedad = propResult.recordset[0].Id;

    // Buscar factura pendiente MÁS PRÓXIMA A VENCER 
    const factResult = await pool
      .request()
      .input('idPropiedad', sql.Int, idPropiedad)
      .query(`
        SELECT TOP 1
              F.Id                AS IdFactura
            , F.FechaFactura
            , F.FechaVencimiento
            , F.FechaCuotaAgua
            , F.TotalOriginal
            , F.TotalFinal
        FROM Factura F
        WHERE F.IdPropiedad = @idPropiedad
          AND F.Estado = 'Pendiente'
        ORDER BY F.FechaVencimiento ASC;  -- ORDENAR POR FECHA VENCIMIENTO MÁS PRÓXIMA
      `);

    if (factResult.recordset.length === 0) {
      return res.json({
        success: false,
        message: 'La propiedad no tiene facturas pendientes.',
      });
    }

    const factura = factResult.recordset[0];

    const fechaPago = fechaPagoStr ? new Date(fechaPagoStr) : new Date();

    const fechaVencimiento = new Date(factura.FechaVencimiento);
    let diasMora = 0;
    if (fechaPago > fechaVencimiento) {
      const diffMs = fechaPago.getTime() - fechaVencimiento.getTime();
      diasMora = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      if (diasMora < 0) diasMora = 0;
    }

    const totalOriginal = Number(factura.TotalOriginal || 0);

    let interesMoratorio = 0;
    if (diasMora > 0) {
      interesMoratorio = (totalOriginal * 0.04 / 30.0) * diasMora;
    }
    const totalFinal = totalOriginal + interesMoratorio;

    const resumen = {
      numeroFinca,
      fechaFactura: formatDateOnly(factura.FechaFactura),
      fechaVencimiento: formatDateOnly(factura.FechaVencimiento),
      fechaCuotaAgua: formatDateOnly(factura.FechaCuotaAgua),
      fechaPago: formatDateOnly(fechaPago),
      totalOriginal,
      diasMora,
      interesMoratorio,
      totalFinal,
    };

    return res.json({
      success: true,
      resumen: cleanData(resumen),
    });
  } catch (err) {
    console.error('Error en GET /api/facturas/resumen-pago:', err);
    return res.status(500).json({
      success: false,
      message: 'Error interno al generar el resumen de pago.',
    });
  }
});

// ---- Pago de factura ----
app.post('/api/facturas/pagar', async (req, res) => {
  try {
    const { numeroFinca, tipoMedioPagoId, numeroReferencia, fechaPago } = req.body;

    if (!numeroFinca) {
      return res.json({
        success: false,
        message: 'El número de finca es obligatorio.',
      });
    }
    if (!tipoMedioPagoId) {
      return res.json({
        success: false,
        message: 'Debes seleccionar un medio de pago.',
      });
    }

    const fechaPagoDate = fechaPago ? new Date(fechaPago) : new Date();

    const pool = await getPool();
    const request = pool.request();
    request.input('inNumeroFinca', sql.NVarChar(50), numeroFinca);
    request.input('inTipoMedioPagoId', sql.Int, tipoMedioPagoId);
    request.input('inNumeroReferencia', sql.NVarChar(50), numeroReferencia || null);
    request.input('inFechaPago', sql.Date, fechaPagoDate);
    request.output('outResultCode', sql.Int);

    const result = await request.execute('SP_PagarFactura');
    const code = result.output.outResultCode;

    if (code !== 0) {
      return res.json({
        success: false,
        code,
        message: mapPagoError(code),
      });
    }

    // Después de pagar, devolvemos la lista actualizada de facturas pendientes y pagadas
    const refresco = await pool
      .request()
      .input('inNumeroFinca', sql.NVarChar(50), numeroFinca)
      .output('outResultCode', sql.Int)
      .execute('SP_ConsuFacturaxPropiedad');

    const codeRef = refresco.output.outResultCode;

    let facturasPendientes = [];
    let facturasPagadas = [];
    
    if (codeRef === 0) {
      facturasPendientes = refresco.recordsets[1] || [];
      facturasPagadas = refresco.recordsets[2] || [];
      
      // ORDENAR facturas pendientes por fecha de vencimiento
      facturasPendientes = facturasPendientes.sort((a, b) => {
        const fechaA = new Date(a.FechaVencimiento);
        const fechaB = new Date(b.FechaVencimiento);
        return fechaA - fechaB;
      });

      // Formatear facturas sin ID
      facturasPendientes = facturasPendientes.map(factura => ({
        FechaFactura: factura.FechaFactura,
        FechaVencimiento: factura.FechaVencimiento,
        FechaCuotaAgua: factura.FechaCuotaAgua,
        TotalOriginal: factura.TotalOriginal || 0,
        TotalFinal: factura.TotalFinal || 0,
        Estado: factura.Estado || 'Pendiente'
      }));

      facturasPagadas = facturasPagadas.map(factura => ({
        FechaFactura: factura.FechaFactura,
        FechaVencimiento: factura.FechaVencimiento,
        FechaCuotaAgua: factura.FechaCuotaAgua,
        TotalOriginal: factura.TotalOriginal || 0,
        TotalFinal: factura.TotalFinal || 0,
        Estado: factura.Estado || 'PagadoNormal'
      }));
    }

    return res.json({
      success: true,
      message: 'Pago registrado correctamente.',
      facturasPendientes: cleanData(facturasPendientes),
      facturasPagadas: cleanData(facturasPagadas),
    });
  } catch (err) {
    console.error('Error en POST /api/facturas/pagar:', err);
    return res.status(500).json({
      success: false,
      message: 'Error interno al procesar el pago.',
    });
  }
});

// =========================
// Inicio del servidor
// =========================
app.listen(PORT, () => {
  console.log(`🚀 Servidor escuchando en http://localhost:${PORT}`);
});