import React, { useState } from 'react';

export default function LogoPoint({ size = 'md', className = '' }) {
  const [imgError, setImgError] = useState(false);

  // Mapeamento de tamanhos para a imagem oficial
  const sizeClasses = {
    xs: 'h-7 w-auto',
    sm: 'h-8 sm:h-9 w-auto',
    md: 'h-11 sm:h-12 w-auto',
    lg: 'h-16 sm:h-20 w-auto',
    hero: 'w-[88vw] max-w-[560px] sm:max-w-[720px] md:max-w-[840px] lg:max-w-[920px] h-auto',
  };

  // Se a imagem carregar com sucesso, exibe apenas a logo oficial (já contém POINT. Start)
  if (!imgError) {
    return (
      <img
        src="/logo-p.png"
        alt="POINT. Start"
        className={`${sizeClasses[size] || sizeClasses.md} object-contain transition-transform duration-500 select-none ${className}`}
        onError={() => setImgError(true)}
      />
    );
  }

  // Fallback tipográfico caso a imagem não possa ser carregada
  return (
    <div className={`flex flex-col items-center select-none ${className}`}>
      <span className="font-extrabold text-[#18181B] tracking-tight text-4xl sm:text-6xl md:text-7xl leading-none">
        POINT<span className="text-[#818CF8]">.</span>
      </span>
      <span className="font-handwriting text-[#818CF8] font-bold text-2xl sm:text-3xl md:text-4xl -mt-2 italic">
        Start
      </span>
    </div>
  );
}
