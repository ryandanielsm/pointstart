import React from 'react';
import LogoPoint from './LogoPoint';
import NotificationBell from './NotificationBell';

export default function Topbar({
  activeTab,
  onTabChange,
  onShowCover,
  tasks = [],
  client = null,
  onSelectTask = null,
  pendingCount = 0,
}) {
  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#E2E8F0] px-4 sm:px-6 lg:px-8 py-2.5 transition-colors">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Esquerda: Logo POINT. Start com largura fixa para contrabalancear o centro */}
        <div className="flex items-center w-36 sm:w-48 shrink-0">
          <button
            onClick={onShowCover}
            title="Voltar para a Capa / Apresentação"
            className="flex items-center group cursor-pointer focus:outline-none transition-transform hover:scale-102"
          >
            <LogoPoint size="sm" showSubtitle={false} />
          </button>
        </div>

        {/* Centro Absoluto / Equilibrado: Abas 'Fluxo' e 'Histórico' 100% centralizadas */}
        <nav className="flex items-center justify-center gap-1 sm:gap-2">
          <button
            onClick={() => onTabChange('fluxo')}
            className={`relative px-4 py-2 text-sm font-semibold transition-all cursor-pointer ${
              activeTab === 'fluxo'
                ? 'text-[#18181B]'
                : 'text-[#71717A] hover:text-[#18181B]'
            }`}
          >
            <span>Fluxo</span>
            {activeTab === 'fluxo' && (
              <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-[#18181B] rounded-full transition-all" />
            )}
          </button>

          <button
            onClick={() => onTabChange('historico')}
            className={`relative px-4 py-2 text-sm font-semibold transition-all cursor-pointer ${
              activeTab === 'historico'
                ? 'text-[#18181B]'
                : 'text-[#71717A] hover:text-[#18181B]'
            }`}
          >
            <span>Histórico</span>
            {activeTab === 'historico' && (
              <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-[#18181B] rounded-full transition-all" />
            )}
          </button>
        </nav>

        {/* Direita: Sino de notificação roxinho com contador lilás de pendências críticas */}
        <div className="w-36 sm:w-48 shrink-0 flex items-center justify-end">
          <NotificationBell
            tasks={tasks}
            client={client}
            onSelectTask={onSelectTask}
            onNavigateToHistory={() => onTabChange('historico')}
          />
        </div>
      </div>
    </header>
  );
}
