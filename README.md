# APOLO GYM - Sistema de Gestión

Un sistema completo de gestión para gimnasios desarrollado con React, TypeScript, Supabase y Electron. Permite administrar socios, carnets, caja, turnos de trabajo y asistencias de manera eficiente y profesional con sincronización en tiempo real.

🌐 **Demo en línea**: [https://sistema-de-gesti-n-a-6tbw.bolt.host](https://sistema-de-gesti-n-a-6tbw.bolt.host)

## 🏋️ Características Principales

### 🔐 Sistema de Autenticación
- **Autenticación segura** con Supabase Auth
- **Registro de usuarios** con confirmación por email
- **Sesiones persistentes** y manejo automático de tokens
- **Interfaz de login/registro** moderna y responsive

### 📅 Control de Asistencias (Supabase)
- **Registro rápido** por carnet, nombre o DNI del socio
- **Sugerencias automáticas** con estado visual (vigente/vencido)
- **Historial completo** sincronizado en tiempo real
- **Métricas avanzadas**: asistencias del día, mes, promedios
- **Reportes detallados** por período
- **Exportación** en formatos JSON y CSV
- **Búsqueda inteligente** con autocompletado

### 📋 Gestión de Socios (Supabase)
- **Registro de nuevos socios** con datos completos
- **Campo de teléfono** para contacto adicional
- **Generación automática de carnets** con numeración secuencial (formato: AÑO-XXX)
- **Control de estados** (vigente/vencido) basado en fecha de inicio
- **Visualización tipo carnet** con diseño profesional
- **Búsqueda rápida** por número de carnet, nombre o DNI
- **Edición completa** de datos del socio
- **Renovación de membresías** con un clic
- **Eliminación segura** con confirmación por clave
- **Estadísticas del mes**: altas y renovaciones con detalles
- **Prevención de carnets duplicados** automática

### 💰 Sistema de Caja (Supabase)
- **Control de turnos** con usuario responsable y monto inicial
- **Registro de ingresos** por carnets con forma de pago (efectivo/transferencia)
- **Gestión de retiros** del dueño con numeración automática
- **Control de gastos** con proveedor, motivo y remito
- **Cálculo automático** del efectivo disponible en caja
- **Cierre de turno** con cálculo de recaudación
- **Métricas en tiempo real** de altas y renovaciones por turno

### 🔍 Búsqueda y Consultas
- **Búsqueda por carnet** con visualización completa del socio
- **Estados visuales** claros (vigente en verde, vencido en rojo)
- **Información detallada** del socio y su estado de membresía
- **Edición inline** de datos del socio

### 💾 Sistema de Backups
- **Exportación manual** de todos los datos en formato JSON
- **Importación** de backups para restaurar datos
- **Backups automáticos** programables por intervalo o hora específica
- **Soporte para carpetas** de Google Drive u otras ubicaciones sincronizadas
- **Compatibilidad Web/Escritorio** con File System Access API

## 🛠️ Tecnologías Utilizadas

- **Frontend**: React 18 + TypeScript
- **Base de Datos**: Supabase (PostgreSQL)
- **Autenticación**: Supabase Auth
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Desktop**: Electron
- **Build Tool**: Vite
- **Linting**: ESLint
- **Hosting**: Bolt Hosting

## 🌐 Acceso Web

La aplicación está disponible en línea en: **[https://sistema-de-gesti-n-a-6tbw.bolt.host](https://sistema-de-gesti-n-a-6tbw.bolt.host)**

## 📦 Instalación

### Prerrequisitos
- Node.js 16 o superior
- npm o yarn
- Cuenta de Supabase (para base de datos)

### Pasos de instalación

1. **Clonar el repositorio**
```bash
git clone [URL_DEL_REPOSITORIO]
cd apolo-gym
```

2. **Instalar dependencias**
```bash
npm install
```

3. **Configurar Supabase**
- Crear proyecto en [Supabase](https://supabase.com)
- Ejecutar las migraciones SQL desde `supabase/migrations/`
- Configurar las credenciales en `src/lib/supabase.ts`

4. **Ejecutar en modo desarrollo**
```bash
npm run dev
```

5. **Para ejecutar como aplicación de escritorio**
```bash
# Instalar dependencias de Electron (si no están instaladas)
npm install electron electron-builder --save-dev

# Ejecutar la aplicación de escritorio
npm run electron:dev
```

## 🚀 Uso del Sistema

### Acceso Web
1. Visita [https://sistema-de-gesti-n-a-6tbw.bolt.host](https://sistema-de-gesti-n-a-6tbw.bolt.host)
2. Crea una cuenta o inicia sesión
3. Los datos se sincronizan automáticamente con Supabase
4. Usa la función de backups para exportar/importar datos

### Inicio de Sesión
1. Registra una cuenta con email y contraseña
2. Confirma tu email (si está habilitado)
3. Inicia sesión para acceder al sistema

### Gestión de Socios
1. **Crear nuevo socio**: Haz clic en "Nuevo Socio" y completa el formulario
2. **Ver carnets**: Los carnets se muestran en formato visual con estado (vigente/vencido)
3. **Ver detalles**: Haz clic en cualquier carnet para ver información completa
4. **Estadísticas**: Ve las altas y renovaciones del mes con detalles exportables

### Control de Asistencias
1. **Marcar asistencia**: Ingresa el carnet (ej: 25-001), nombre o DNI del socio
2. **Ver sugerencias**: El sistema muestra coincidencias con estado visual
3. **Métricas en tiempo real**: Ve asistencias del día, mes y promedios
4. **Consultar reportes**: Selecciona un rango de fechas para ver estadísticas

### Sistema de Caja
1. **Iniciar turno**: Antes de cualquier operación, inicia un turno con tu nombre y monto inicial
2. **Registrar ingresos**: Ingresa el número de carnet y monto del pago
3. **Registrar retiros**: Anota retiros del dueño con descripción opcional
4. **Registrar gastos**: Documenta gastos con proveedor, motivo y remito
5. **Cerrar turno**: Al finalizar, cierra el turno indicando el monto final

### Sistema de Backups
1. **Exportar**: Descarga todos los datos en formato JSON
2. **Importar**: Restaura datos desde un archivo de backup
3. **Programar**: Configura backups automáticos (requiere elegir carpeta destino)

### Búsqueda de Socios
1. Ingresa el número de carnet, nombre o DNI
2. El sistema mostrará toda la información del socio
3. El estado se indica visualmente (verde=vigente, rojo=vencido)

## 📁 Estructura del Proyecto

```
apolo-gym/
├── src/
│   ├── components/          # Componentes reutilizables
│   │   ├── Layout.tsx       # Layout principal con navegación
│   │   └── AuthWrapper.tsx  # Wrapper de autenticación
│   ├── pages/               # Páginas principales
│   │   ├── Asistencias.tsx  # Control de asistencias (Supabase)
│   │   ├── Socios.tsx       # Gestión de socios (Supabase)
│   │   ├── BuscarCarnet.tsx # Búsqueda de carnets
│   │   ├── Backups.tsx      # Sistema de backups
│   │   └── Caja.tsx         # Sistema de caja (Supabase)
│   ├── hooks/               # Custom hooks
│   │   ├── useGymData.ts    # Hook para localStorage (legacy)
│   │   └── useSupabaseGymData.ts # Hook principal para Supabase
│   ├── lib/                 # Configuraciones
│   │   └── supabase.ts      # Cliente y tipos de Supabase
│   ├── types/               # Definiciones de tipos
│   │   ├── index.ts         # Tipos principales
│   │   └── global.d.ts      # Tipos globales
│   ├── utils/               # Utilidades
│   │   ├── localStorage.ts  # Manejo de datos locales (legacy)
│   │   └── supabaseAsistencias.ts # Utilidades para asistencias
│   ├── App.tsx              # Componente principal
│   └── main.tsx             # Punto de entrada
├── supabase/                # Configuración de Supabase
│   └── migrations/          # Migraciones SQL
│       └── 20251127033947_violet_math.sql # Schema completo
├── electron/                # Configuración de Electron
│   ├── main.js              # Proceso principal
│   ├── preload.js           # Script de preload
│   └── assets/              # Recursos de la aplicación
├── public/                  # Archivos públicos
│   └── logo-apolo.jpg       # Logo del gimnasio
└── package.json             # Dependencias y scripts
```

## 💾 Almacenamiento de Datos

### Base de Datos Supabase
- **Tablas principales**: socios, retiros, gastos, ingresos, turnos, asistencias, contadores
- **Autenticación**: Manejo seguro de usuarios con Supabase Auth
- **Tiempo real**: Sincronización automática entre dispositivos
- **Backups**: Sistema de exportación/importación JSON

### Tablas de la Base de Datos

#### `socios`
- Información completa de socios
- Carnets únicos con formato AÑO-XXX
- Estados calculados automáticamente

#### `asistencias`
- Registro de asistencias con timestamp
- Relación con socios y turnos
- Métricas y reportes

#### `turnos`
- Control de turnos de trabajo
- Métricas de altas y renovaciones
- Cálculos de caja

#### `ingresos`
- Registro de pagos por carnets
- Clasificación por concepto (alta/renovación)
- Formas de pago

#### `retiros` y `gastos`
- Control financiero completo
- Numeración automática
- Trazabilidad de movimientos

#### `contadores`
- Numeración automática de carnets y retiros
- Prevención de duplicados

## 🔧 Configuración

### Configuración de Supabase
Para configurar la conexión con Supabase, edita `src/lib/supabase.ts`:

```typescript
const supabaseUrl = 'TU_SUPABASE_URL';
const supabaseAnonKey = 'TU_SUPABASE_ANON_KEY';
```

### Configuración de Montos
Los montos por defecto se pueden modificar en los componentes correspondientes:
- Monto de carnet: `30000` (en formularios de socio e ingreso)

### Configuración de Backups
- **Web**: Los backups se descargan o guardan en carpeta elegida (si el navegador soporta File System Access API)
- **Escritorio**: Los backups se guardan en la carpeta seleccionada (ideal: Google Drive para sincronización)

## 🎨 Características de Diseño

- **Interfaz moderna** con Tailwind CSS
- **Diseño responsivo** que se adapta a diferentes tamaños de pantalla
- **Iconografía consistente** con Lucide React
- **Estados visuales claros** con códigos de color
- **Transiciones suaves** para mejor experiencia de usuario
- **Autenticación visual** con indicadores de estado

## 📊 Funcionalidades de Negocio

### Control de Vencimientos
- Los carnets vencen automáticamente después de 30 días
- El estado se actualiza dinámicamente al cargar los datos
- Visualización clara del estado en toda la aplicación

### Numeración Automática
- **Carnets**: Formato AÑO-XXX (ej: 25-001, 25-002...)
- **Retiros**: Numeración secuencial simple (001, 002, 003...)
- **Prevención de duplicados**: Sistema robusto de verificación

### Control de Asistencias
- **Registro por turno**: Las asistencias se asocian al turno y usuario activo
- **Búsqueda inteligente**: Encuentra socios por carnet exacto, nombre parcial o DNI
- **Métricas en tiempo real**: Estadísticas del día, mes y promedios históricos
- **Sincronización**: Datos actualizados en tiempo real entre dispositivos

### Cálculos Automáticos
- **Efectivo en caja**: Monto inicial + ingresos efectivo - retiros - gastos
- **Recaudación de turno**: Monto final - monto inicial
- **Métricas de turno**: Altas y renovaciones automáticas

## 🔒 Seguridad

- **Autenticación robusta** con Supabase Auth
- **Row Level Security (RLS)** en todas las tablas
- **Validación de datos** en todos los formularios
- **Políticas de acceso** granulares por usuario autenticado
- **Tokens seguros** con renovación automática

## 🌍 Compatibilidad

- **Navegadores**: Chrome, Firefox, Safari, Edge (versiones modernas)
- **Dispositivos**: Desktop, tablet, móvil (diseño responsivo)
- **Sistemas**: Windows, macOS, Linux (versión Electron)
- **Base de datos**: PostgreSQL via Supabase

## 🐛 Solución de Problemas

### La aplicación no carga datos
- Verifica la conexión a internet
- Revisa las credenciales de Supabase en `src/lib/supabase.ts`
- Verifica que las migraciones SQL se hayan ejecutado correctamente

### Error de autenticación
- Verifica que el email esté confirmado (si está habilitado)
- Revisa la configuración de Supabase Auth
- Intenta cerrar sesión y volver a iniciar

### Los carnets se duplican
- El sistema ahora previene automáticamente los duplicados
- Si persiste, verifica la tabla `contadores` en Supabase

### Las asistencias no se sincronizan
- Verifica la conexión a Supabase
- Revisa la consola del navegador para errores
- Asegúrate de estar autenticado correctamente

### Problemas con backups automáticos
- **Web**: Asegúrate de mantener la pestaña abierta y dar permisos de carpeta
- **Escritorio**: Verifica que la carpeta destino tenga permisos de escritura

### Los datos no se sincronizan entre dispositivos
- Verifica que todos los dispositivos estén conectados a internet
- Asegúrate de usar la misma cuenta en todos los dispositivos
- Los datos se sincronizan automáticamente con Supabase

## 📝 Licencia

Este proyecto es de uso privado para APOLO GYM.

## 👥 Soporte

Para soporte técnico o consultas sobre el sistema, contacta al desarrollador.

## 🔗 Enlaces Útiles

- **Aplicación Web**: [https://sistema-de-gesti-n-a-6tbw.bolt.host](https://sistema-de-gesti-n-a-6tbw.bolt.host)
- **Supabase**: [https://supabase.com](https://supabase.com)
- **Documentación React**: [https://react.dev](https://react.dev)
- **Tailwind CSS**: [https://tailwindcss.com](https://tailwindcss.com)

---

**APOLO GYM** - Sistema de Gestión Profesional con Supabase 💪🔥