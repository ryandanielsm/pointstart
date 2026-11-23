import React, { useEffect, useState } from 'react';
import LogoPoint from './LogoPoint';
import { ChevronDown } from 'lucide-react';

export default function SplashCover({ isOpen, onEnter }) {
  const [mounted, setMounted] = useState(false);
  const [touchStartY, setTouchStartY] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setMounted(true);
    }, 120);
    return () => clearTimeout(timer);
  }, []);

  // Detecta rolagem para baixo (wheel) e toque (swipe)
  useEffect(() => {
    if (!isOpen) return;

    const handleWheel = (e) => {
      if (e.deltaY > 15) {
        onEnter();
      }
    };

    const handleTouchStart = (e) => {
      setTouchStartY(e.touches[0].clientY);
    };

    const handleTouchMove = (e) => {
      if (touchStartY === null) return;
      const currentY = e.touches[0].clientY;
      const diff = touchStartY - currentY;
      if (diff > 25) {
        onEnter();
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        onEnter();
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: true });
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onEnter, touchStartY]);

  return (
    <div
      onClick={onEnter}
      className={`fixed inset-0 z-50 flex flex-col justify-between overflow-hidden bg-[#F5F5F2] cursor-pointer transition-transform duration-1000 ease-[cubic-bezier(0.85,0,0.15,1)] ${
        isOpen ? 'translate-y-0' : '-translate-y-full pointer-events-none'
      }`}
    >
      {/* Luz roxinha mágica que se move suavemente e organicamente por toda a tela */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden select-none">
        {/* Luz Roxinha 1: Esfera principal com movimento orgânico fluido por toda a tela */}
        <div
          className={`absolute top-1/2 left-1/2 w-[550px] sm:w-[680px] md:w-[780px] h-[550px] sm:h-[680px] md:h-[780px] rounded-full bg-[radial-gradient(circle,rgba(129,140,248,0.46)_0%,rgba(147,112,219,0.30)_35%,rgba(129,140,248,0.14)_60%,transparent_75%)] blur-[90px] md:blur-[120px] animate-wander-purple-1 transition-opacity duration-1500 ${
            mounted ? 'opacity-100' : 'opacity-0'
          }`}
        />

        {/* Luz Roxinha 2: Luz complementar em contra-tempo que passeia em órbitas cruzadas */}
        <div
          className={`absolute top-1/2 left-1/2 w-[480px] sm:w-[600px] md:w-[700px] h-[480px] sm:h-[600px] md:h-[700px] rounded-full bg-[radial-gradient(circle,rgba(167,139,250,0.38)_0%,rgba(129,140,248,0.24)_40%,transparent_72%)] blur-[80px] md:blur-[110px] animate-wander-purple-2 transition-opacity duration-1500 delay-300 ${
            mounted ? 'opacity-100' : 'opacity-0'
          }`}
        />

        {/* Halo de luz suave etérea perolada ao fundo para profundidade */}
        <div
          className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] rounded-full bg-gradient-to-r from-white/60 via-[#EEF2FF]/40 to-transparent blur-3xl transition-opacity duration-1000 ${
            mounted ? 'opacity-100' : 'opacity-0'
          }`}
        />

        {/* Textura ultra sutil */}
        <div className="absolute inset-0 opacity-[0.02] bg-[radial-gradient(#18181B_1px,transparent_1px)] [background-size:24px_24px]" />
      </div>

      {/* Espaço superior para equilíbrio visual */}
      <div className="relative z-10 pt-12 select-none" />

      {/* Centro: Logo POINT. Start em tamanho heroico */}
      <div className="relative z-10 flex flex-col items-center justify-center px-4 sm:px-8 my-auto select-none">
        <div
          className={`transform transition-all duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)] flex flex-col items-center justify-center relative ${
            mounted
              ? 'translate-y-0 opacity-100 scale-100 blur-none'
              : 'translate-y-12 opacity-0 scale-85 blur-xl'
          }`}
        >
          {/* Logo Principal */}
          <div className="relative transform transition-transform duration-700 ease-out hover:scale-[1.03]">
            <LogoPoint size="hero" className="filter drop-shadow-sm" />
          </div>
        </div>
      </div>

      {/* Indicador Inferior Minimalista: "Role para baixo e acesse" com barra shimmer */}
      <div className="relative z-10 pb-10 flex flex-col items-center justify-center select-none group">
        <span className="text-xs sm:text-sm font-semibold text-[#3F3F46] tracking-wide group-hover:text-[#18181B] transition-colors">
          Role para baixo e acesse
        </span>

        {/* Tracinho lilás (#818CF8) deslizante tipo shimmer / ping-pong */}
        <div className="mt-2.5 w-36 h-1 bg-[#E2E8F0] rounded-full shimmer-track">
          <div className="shimmer-bar" />
        </div>

        <ChevronDown className="w-4 h-4 mt-2 text-[#71717A] group-hover:text-[#18181B] animate-bounce transition-colors" />
      </div>
    </div>
  );
}
