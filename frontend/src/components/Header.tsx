import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from './UI/button';
import { Settings } from 'lucide-react';

export default function Header() {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  const handleNavigation = (path: string) => {
    navigate(path);
  };

  return (
    <header className="bg-white border-b border-gray-200 h-16 fixed top-0 left-0 right-0 z-50">
      <div className="h-full flex items-center justify-between px-6">
        {/* Left side - Logo and Navigation */}
        <div className="flex items-center gap-8">
          {/* Logo */}
          <div className="flex items-center gap-4">
            <span className="text-xl font-bold text-gray-900">SakuraTrade</span>
            
            {/* Trade Chat Icons - Removed for cleaner UI */}
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-2">
            <Button
              variant={isActive('/dashboard') ? 'default' : 'ghost'}
              size="sm"
              onClick={() => handleNavigation('/dashboard')}
              className={`h-8 px-4 rounded-full ${
                isActive('/dashboard') 
                  ? 'bg-[#5ED0E8] text-white hover:bg-[#5ED0E8]/90' 
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              ダッシュボード
            </Button>
            
            <Button
              variant={isActive('/trade') ? 'default' : 'ghost'}
              size="sm"
              onClick={() => handleNavigation('/trade')}
              className={`h-8 px-4 rounded-full ${
                isActive('/trade') 
                  ? 'bg-[#5ED0E8] text-white hover:bg-[#5ED0E8]/90' 
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              トレードチャット
            </Button>

            <Button
              variant={isActive('/trade-records') ? 'default' : 'ghost'}
              size="sm"
              onClick={() => handleNavigation('/trade-records')}
              className={`h-8 px-4 rounded-full ${
                isActive('/trade-records')
                  ? 'bg-[#5ED0E8] text-white hover:bg-[#5ED0E8]/90'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              トレード記録
            </Button>
          </nav>
        </div>

        {/* Right side - Settings */}
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleNavigation('/settings')}
            className="w-8 h-8 p-0 text-gray-600 hover:text-gray-900 hover:bg-gray-100"
          >
            <Settings className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
