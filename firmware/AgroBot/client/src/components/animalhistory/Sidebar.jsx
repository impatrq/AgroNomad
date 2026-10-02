
import { 
  LayoutDashboard, Beef, Map, FileText, Settings, 
  Search, Bell, ChevronDown, MapPin, CheckCircle, 
  MoreHorizontal, ChevronLeft, ChevronRight, Activity,
  Thermometer, Heart
} from 'lucide-react';

/**
 * Sidebar Component
 * Hidden on mobile, visible on large screens (lg:flex).
 */

export default function Sidebar(){
  const navItems = [
    { name: 'Dashboard', icon: <LayoutDashboard size={20} />, active: false },
    { name: 'Animals', icon: <Beef size={20} />, active: true }, // Active state
    { name: 'Yards', icon: <Map size={20} />, active: false },
    { name: 'Map', icon: <MapPin size={20} />, active: false },
    { name: 'Reports', icon: <FileText size={20} />, active: false },
    { name: 'Settings', icon: <Settings size={20} />, active: false },
  ];

  return (
    <aside className="hidden lg:flex flex-col w-64 bg-[#0b1210] border-r border-[#1f3328] h-screen sticky top-0">
      {/* Logo Area */}
      <div className="p-6 flex items-center gap-3">
        <div className="text-green-500">
          <Beef size={28} />
        </div>
        <div>
          <h1 className="text-white font-bold text-lg leading-tight">AgroNomad</h1>
          <p className="text-gray-400 text-xs">Smart livestock monitoring</p>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-4 mt-4 space-y-1">
        {navItems.map((item) => (
          <a
            key={item.name}
            href="#"
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              item.active 
                ? 'bg-green-600/20 text-green-500 font-medium' 
                : 'text-gray-400 hover:text-white hover:bg-[#15241d]'
            }`}
          >
            {item.icon}
            <span>{item.name}</span>
          </a>
        ))}
      </nav>

      {/* System Status Footer */}
      <div className="p-6 border-t border-[#1f3328]">
        <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
          <div className="w-2 h-2 rounded-full bg-green-500"></div>
          <span>System Online</span>
        </div>
        <p className="text-xs text-gray-500">Last update: 10:24</p>
      </div>
    </aside>
  );
};