/*
  # Schema completo para APOLO GYM

  1. Nuevas Tablas
    - `socios` - Información de socios del gimnasio
    - `retiros` - Retiros de dinero de caja
    - `gastos` - Gastos del gimnasio
    - `ingresos` - Ingresos por carnets y renovaciones
    - `turnos` - Turnos de trabajo en caja
    - `asistencias` - Registro de asistencias de socios
    - `contadores` - Contadores para numeración automática

  2. Seguridad
    - RLS habilitado en todas las tablas
    - Políticas para usuarios autenticados
    - Acceso completo para operaciones CRUD

  3. Características
    - UUIDs como claves primarias
    - Timestamps automáticos
    - Validaciones de datos
    - Índices para mejor rendimiento
*/

-- Tabla de socios
CREATE TABLE IF NOT EXISTS socios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  carnet text UNIQUE NOT NULL,
  nombre_completo text NOT NULL,
  dni text NOT NULL,
  telefono text DEFAULT '',
  fecha_inicio date NOT NULL DEFAULT CURRENT_DATE,
  forma_pago text NOT NULL CHECK (forma_pago IN ('efectivo', 'transferencia')),
  monto numeric(10,2) NOT NULL DEFAULT 30000,
  estado text NOT NULL DEFAULT 'vigente' CHECK (estado IN ('vigente', 'vencido')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabla de retiros
CREATE TABLE IF NOT EXISTS retiros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text UNIQUE NOT NULL,
  monto numeric(10,2) NOT NULL,
  descripcion text DEFAULT '',
  fecha timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Tabla de gastos
CREATE TABLE IF NOT EXISTS gastos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  monto numeric(10,2) NOT NULL,
  proveedor text NOT NULL,
  motivo text NOT NULL,
  remito text DEFAULT '',
  fecha timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Tabla de ingresos
CREATE TABLE IF NOT EXISTS ingresos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  carnet text NOT NULL,
  nombre_socio text NOT NULL,
  monto numeric(10,2) NOT NULL,
  forma_pago text NOT NULL CHECK (forma_pago IN ('efectivo', 'transferencia')),
  concepto text DEFAULT 'otro' CHECK (concepto IN ('alta', 'renovacion', 'otro')),
  fecha timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Tabla de turnos
CREATE TABLE IF NOT EXISTS turnos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario text NOT NULL,
  fecha_inicio timestamptz DEFAULT now(),
  fecha_fin timestamptz,
  monto_inicial numeric(10,2) NOT NULL DEFAULT 0,
  monto_final numeric(10,2),
  recaudacion numeric(10,2),
  cerrado boolean DEFAULT false,
  altas_carnet integer DEFAULT 0,
  renovaciones integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabla de asistencias
CREATE TABLE IF NOT EXISTS asistencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  socio_id uuid REFERENCES socios(id) ON DELETE CASCADE,
  carnet text NOT NULL,
  nombre_completo text NOT NULL,
  fecha_inicio date,
  turno_id uuid REFERENCES turnos(id) ON DELETE SET NULL,
  by_usuario text,
  timestamp_iso timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Tabla de contadores
CREATE TABLE IF NOT EXISTS contadores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text UNIQUE NOT NULL CHECK (tipo IN ('carnet', 'retiro')),
  valor integer NOT NULL DEFAULT 1,
  updated_at timestamptz DEFAULT now()
);

-- Insertar contadores iniciales
INSERT INTO contadores (tipo, valor) 
VALUES ('carnet', 1), ('retiro', 1)
ON CONFLICT (tipo) DO NOTHING;

-- Índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_socios_carnet ON socios(carnet);
CREATE INDEX IF NOT EXISTS idx_socios_estado ON socios(estado);
CREATE INDEX IF NOT EXISTS idx_ingresos_fecha ON ingresos(fecha);
CREATE INDEX IF NOT EXISTS idx_ingresos_concepto ON ingresos(concepto);
CREATE INDEX IF NOT EXISTS idx_asistencias_fecha ON asistencias(timestamp_iso);
CREATE INDEX IF NOT EXISTS idx_asistencias_carnet ON asistencias(carnet);
CREATE INDEX IF NOT EXISTS idx_turnos_cerrado ON turnos(cerrado);

-- Habilitar RLS en todas las tablas
ALTER TABLE socios ENABLE ROW LEVEL SECURITY;
ALTER TABLE retiros ENABLE ROW LEVEL SECURITY;
ALTER TABLE gastos ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingresos ENABLE ROW LEVEL SECURITY;
ALTER TABLE turnos ENABLE ROW LEVEL SECURITY;
ALTER TABLE asistencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE contadores ENABLE ROW LEVEL SECURITY;

-- Políticas para usuarios autenticados (acceso completo)
CREATE POLICY "Usuarios autenticados pueden gestionar socios"
  ON socios FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Usuarios autenticados pueden gestionar retiros"
  ON retiros FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Usuarios autenticados pueden gestionar gastos"
  ON gastos FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Usuarios autenticados pueden gestionar ingresos"
  ON ingresos FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Usuarios autenticados pueden gestionar turnos"
  ON turnos FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Usuarios autenticados pueden gestionar asistencias"
  ON asistencias FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Usuarios autenticados pueden gestionar contadores"
  ON contadores FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para updated_at
CREATE TRIGGER update_socios_updated_at BEFORE UPDATE ON socios
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_turnos_updated_at BEFORE UPDATE ON turnos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contadores_updated_at BEFORE UPDATE ON contadores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();