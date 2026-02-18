// src/components/Layout.tsx
import React from 'react';
import {
  Users,
  CreditCard,
  Search,
  CalendarCheck,
  HardDrive,
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  currentPage: string;
  onNavigate: (page: string) => void;
  locked?: boolean;
}

export const Layout: React.FC<LayoutProps> = ({
  children,
  currentPage,
  onNavigate,
}) => {
  // 👇 Asistencias va primero
  const menuItems = [
    { id: 'asistencias', label: 'Asistencias', icon: CalendarCheck },
    { id: 'socios', label: 'Gestión de Socios', icon: Users },
    { id: 'buscar', label: 'Buscar Socio', icon: Search },
    { id: 'caja', label: 'Caja', icon: CreditCard },
    // Dejalo si ya tenés la página Backups, si no, podés quitarlo
    { id: 'backups', label: 'Backups', icon: HardDrive },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header superior (con logo grande si lo querés también aquí) */}
      <header className="bg-gradient-to-r from-blue-700 to-blue-900 text-white shadow-lg">
        <div className="container mx-auto px-6 py-6 flex items-center gap-5">
          <img
            src="/logo-apolo.jpg"
            alt="APOLO GYM"
            className="h-24 w-auto rounded-md shadow-lg object-contain"
          />
          <h1 className="text-4xl md:text-5xl font-bold tracking-wide">
            APOLO MEGAGYM    *DC4*          </h1>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <nav className="w-72 bg-white shadow-lg min-h-screen">
          {/* Logo arriba de la lista */}
          <div className="p-6 border-b">
            <img
              src="/logo-apolo.jpg"
              alt="Logo Apolo"
              className="w-full max-w-[220px] mx-auto rounded-md shadow object-contain"
            />
          </div>

          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">
              Panel de Control
            </h2>
            <ul className="space-y-2">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const active = currentPage === item.id;
                return (
                  <li key={item.id}>
                    <button
                      onClick={() => onNavigate(item.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                        active
                          ? 'bg-blue-600 text-white shadow-md'
                          : 'text-gray-700 hover:bg-gray-100 hover:text-blue-600'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      {item.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </nav>

        {/* Main Content */}
        <main className="flex-1 p-8">{children}</main>
      </div>
    </div>
  );
};
