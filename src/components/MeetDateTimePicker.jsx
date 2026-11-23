import React, { useState, useEffect, useRef } from 'react';
import {
  Calendar,
  Clock,
  ChevronLeft,
  ChevronRight,
  Check,
} from 'lucide-react';

const MONTH_NAMES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

const WEEK_DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

// Horários comerciais predefinidos de 30 em 30 minutos (08:00 às 19:30)
const COMMERCIAL_SLOTS = [
  '08:00',
  '08:30',
  '09:00',
  '09:30',
  '10:00',
  '10:30',
  '11:00',
  '11:30',
  '12:00',
  '12:30',
  '13:00',
  '13:30',
  '14:00',
  '14:30',
  '15:00',
  '15:30',
  '16:00',
  '16:30',
  '17:00',
  '17:30',
  '18:00',
  '18:30',
  '19:00',
  '19:30',
];

/**
 * Formata 'YYYY-MM-DD' para 'DD/MM/YYYY'
 */
function formatDateBr(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

/**
 * Retorna string 'YYYY-MM-DD' para hoje
 */
function getTodayIso() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Verifica se um horário específico já passou na data selecionada
 */
function isSlotInThePast(dateStr, timeStr) {
  const todayStr = getTodayIso();
  if (!dateStr || dateStr < todayStr) return true;
  if (dateStr > todayStr) return false;

  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const [h, m] = timeStr.split(':').map(Number);

  if (h < currentHour) return true;
  if (h === currentHour && m <= currentMinute) return true;
  return false;
}

export default function MeetDateTimePicker({
  value, // 'YYYY-MM-DDTHH:mm' ou similar
  onChange,
}) {
  const todayIso = getTodayIso();
  const now = new Date();

  // Divide o valor recebido em data e hora
  const initialDate = value && value.includes('T') ? value.split('T')[0] : value || todayIso;
  const initialTime = value && value.includes('T') ? value.split('T')[1].slice(0, 5) : '09:00';

  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [selectedTime, setSelectedTime] = useState(initialTime);

  // Estados dos popovers
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [timeOpen, setTimeOpen] = useState(false);

  // Mês e ano visíveis no calendário
  const [viewYear, setViewYear] = useState(() => {
    const parts = (initialDate || todayIso).split('-');
    return parseInt(parts[0], 10) || now.getFullYear();
  });
  const [viewMonth, setViewMonth] = useState(() => {
    const parts = (initialDate || todayIso).split('-');
    return parseInt(parts[1], 10) - 1 || now.getMonth();
  });

  // Campos para horário personalizado
  const [customHour, setCustomHour] = useState(() => initialTime.split(':')[0] || '14');
  const [customMin, setCustomMin] = useState(() => initialTime.split(':')[1] || '00');

  const calendarRef = useRef(null);
  const timeRef = useRef(null);

  // Sincroniza estados caso a prop `value` seja alterada externamente
  useEffect(() => {
    if (value && value.includes('T')) {
      const [d, t] = value.split('T');
      if (d) {
        setSelectedDate(d);
        const parts = d.split('-');
        if (parts.length === 3) {
          setViewYear(parseInt(parts[0], 10));
          setViewMonth(parseInt(parts[1], 10) - 1);
        }
      }
      if (t) {
        const cleanT = t.slice(0, 5);
        setSelectedTime(cleanT);
        setCustomHour(cleanT.split(':')[0] || '14');
        setCustomMin(cleanT.split(':')[1] || '00');
      }
    }
  }, [value]);

  // Fecha popovers ao clicar fora
  useEffect(() => {
    function handleClickOutside(e) {
      if (calendarRef.current && !calendarRef.current.contains(e.target)) {
        setCalendarOpen(false);
      }
      if (timeRef.current && !timeRef.current.contains(e.target)) {
        setTimeOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Notifica o pai sobre nova data e hora
  const emitChange = (newDate, newTime) => {
    setSelectedDate(newDate);
    setSelectedTime(newTime);
    if (onChange) {
      onChange(`${newDate}T${newTime}`);
    }
  };

  // Navegação de meses
  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  // Verifica se o botão do mês anterior deve ser desabilitado (não permitir voltar para meses passados)
  const isPrevMonthDisabled = () => {
    const curYear = now.getFullYear();
    const curMonth = now.getMonth();
    return viewYear < curYear || (viewYear === curYear && viewMonth <= curMonth);
  };

  // Gera a matriz de dias do mês atual
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();

  // Seleciona um dia no calendário
  const handleSelectDay = (dayNum) => {
    const mm = String(viewMonth + 1).padStart(2, '0');
    const dd = String(dayNum).padStart(2, '0');
    const newDateStr = `${viewYear}-${mm}-${dd}`;

    // Se a data selecionada for hoje e o horário selecionado estiver no passado, ajusta para próximo horário válido
    let newTimeStr = selectedTime;
    if (isSlotInThePast(newDateStr, newTimeStr)) {
      const nextSlot = COMMERCIAL_SLOTS.find((s) => !isSlotInThePast(newDateStr, s));
      newTimeStr = nextSlot || '23:59';
    }

    emitChange(newDateStr, newTimeStr);
    setCalendarOpen(false);
  };

  // Atalho: Selecionar "Hoje"
  const handleSelectToday = () => {
    setViewYear(now.getFullYear());
    setViewMonth(now.getMonth());
    handleSelectDay(now.getDate());
  };

  // Atalho: Selecionar "Amanhã"
  const handleSelectTomorrow = () => {
    const tom = new Date();
    tom.setDate(tom.getDate() + 1);
    setViewYear(tom.getFullYear());
    setViewMonth(tom.getMonth());
    const mm = String(tom.getMonth() + 1).padStart(2, '0');
    const dd = String(tom.getDate()).padStart(2, '0');
    const tomorrowStr = `${tom.getFullYear()}-${mm}-${dd}`;
    emitChange(tomorrowStr, selectedTime);
    setCalendarOpen(false);
  };

  // Seleciona horário predefinido
  const handleSelectSlot = (slot) => {
    if (isSlotInThePast(selectedDate, slot)) return;
    emitChange(selectedDate, slot);
    setTimeOpen(false);
  };

  // Aplica horário customizado
  const handleApplyCustomTime = () => {
    const customStr = `${customHour.padStart(2, '0')}:${customMin.padStart(2, '0')}`;
    if (isSlotInThePast(selectedDate, customStr)) {
      alert('O horário informado já passou para a data de hoje. Selecione um horário futuro.');
      return;
    }
    emitChange(selectedDate, customStr);
    setTimeOpen(false);
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
      {/* ======================================================== */}
      {/* 1. CAMPO: DATA DA REUNIÃO (com popover de calendário) */}
      {/* ======================================================== */}
      <div className="relative" ref={calendarRef}>
        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
          Data da Reunião
        </label>
        <button
          type="button"
          onClick={() => {
            setCalendarOpen((prev) => !prev);
            setTimeOpen(false);
          }}
          className="w-full h-9 text-xs px-3 rounded-lg border border-indigo-200 bg-white hover:border-[#6366F1] focus:outline-none focus:ring-1.5 focus:ring-[#818CF8]/40 text-slate-800 flex items-center justify-between shadow-2xs transition-all cursor-pointer group"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Calendar className="w-3.5 h-3.5 text-[#6366F1] shrink-0" />
            <span className="truncate font-medium">
              {formatDateBr(selectedDate) || 'Selecione a data'}
            </span>
          </div>
          <span className="text-[10px] text-indigo-500 font-semibold group-hover:underline">
            Alterar
          </span>
        </button>

        {/* Popover do Calendário Customizado */}
        {calendarOpen && (
          <div className="absolute left-0 top-full mt-1.5 z-50 w-72 rounded-2xl bg-white border border-indigo-100 shadow-xl p-3.5 animate-fade-in">
            {/* Cabeçalho do Mês */}
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-900">
                {MONTH_NAMES[viewMonth]} {viewYear}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  disabled={isPrevMonthDisabled()}
                  className="p-1 rounded-lg hover:bg-indigo-50 text-slate-600 hover:text-[#6366F1] disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                  title="Mês anterior"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleNextMonth}
                  className="p-1 rounded-lg hover:bg-indigo-50 text-slate-600 hover:text-[#6366F1] transition-colors cursor-pointer"
                  title="Próximo mês"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Cabeçalho dos Dias da Semana */}
            <div className="grid grid-cols-7 gap-1 text-center mb-1">
              {WEEK_DAYS.map((wd) => (
                <span key={wd} className="text-[10px] font-bold text-slate-400">
                  {wd}
                </span>
              ))}
            </div>

            {/* Grid dos Dias do Mês */}
            <div className="grid grid-cols-7 gap-1 text-center">
              {/* Espaços vazios antes do 1º dia */}
              {Array.from({ length: firstDayOfWeek }).map((_, idx) => (
                <div key={`empty-${idx}`} className="h-7 w-7" />
              ))}

              {/* Dias do mês */}
              {Array.from({ length: daysInMonth }).map((_, idx) => {
                const dayNum = idx + 1;
                const mm = String(viewMonth + 1).padStart(2, '0');
                const dd = String(dayNum).padStart(2, '0');
                const dayIso = `${viewYear}-${mm}-${dd}`;

                const isPast = dayIso < todayIso;
                const isToday = dayIso === todayIso;
                const isSelected = dayIso === selectedDate;

                return (
                  <button
                    key={dayNum}
                    type="button"
                    disabled={isPast}
                    onClick={() => handleSelectDay(dayNum)}
                    className={`h-7 w-7 mx-auto rounded-lg text-xs font-semibold flex items-center justify-center transition-all ${
                      isPast
                        ? 'opacity-30 text-slate-400 cursor-not-allowed line-through'
                        : isSelected
                        ? 'bg-[#6366F1] text-white shadow-xs scale-105'
                        : isToday
                        ? 'border border-[#6366F1] text-[#6366F1] hover:bg-indigo-50 cursor-pointer'
                        : 'text-slate-700 hover:bg-indigo-50 hover:text-[#6366F1] cursor-pointer'
                    }`}
                  >
                    {dayNum}
                  </button>
                );
              })}
            </div>

            {/* Rodapé com atalhos rápidos "Hoje" e "Amanhã" */}
            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleSelectToday}
                  className="px-2 py-0.5 rounded-md text-[#6366F1] font-semibold hover:bg-indigo-50 transition-colors cursor-pointer"
                >
                  Hoje
                </button>
                <button
                  type="button"
                  onClick={handleSelectTomorrow}
                  className="px-2 py-0.5 rounded-md text-[#6366F1] font-semibold hover:bg-indigo-50 transition-colors cursor-pointer"
                >
                  Amanhã
                </button>
              </div>
              <button
                type="button"
                onClick={() => setCalendarOpen(false)}
                className="px-2 py-0.5 rounded-md text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* 2. CAMPO: HORÁRIO (com popover de seleção clara) */}
      {/* ======================================================== */}
      <div className="relative" ref={timeRef}>
        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
          Horário da Reunião
        </label>
        <button
          type="button"
          onClick={() => {
            setTimeOpen((prev) => !prev);
            setCalendarOpen(false);
          }}
          className="w-full h-9 text-xs px-3 rounded-lg border border-indigo-200 bg-white hover:border-[#6366F1] focus:outline-none focus:ring-1.5 focus:ring-[#818CF8]/40 text-slate-800 flex items-center justify-between shadow-2xs transition-all cursor-pointer group"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Clock className="w-3.5 h-3.5 text-[#6366F1] shrink-0" />
            <span className="truncate font-semibold font-mono text-slate-900">
              {selectedTime ? `${selectedTime}h` : 'Selecione o horário'}
            </span>
          </div>
          <span className="text-[10px] text-indigo-500 font-semibold group-hover:underline">
            Alterar
          </span>
        </button>

        {/* Popover do Seletor de Horário Customizado */}
        {timeOpen && (
          <div className="absolute right-0 top-full mt-1.5 z-50 w-72 rounded-2xl bg-white border border-indigo-100 shadow-xl p-3.5 animate-fade-in">
            {/* Cabeçalho */}
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-900">
                Horários Comerciais
              </span>
              <span className="text-[10px] text-[#6366F1] font-semibold">
                De 30 em 30 min
              </span>
            </div>

            {/* Grid de Horários Comerciais */}
            <div className="grid grid-cols-4 gap-1.5 max-h-44 overflow-y-auto pr-0.5">
              {COMMERCIAL_SLOTS.map((slot) => {
                const isPast = isSlotInThePast(selectedDate, slot);
                const isSelected = slot === selectedTime;

                return (
                  <button
                    key={slot}
                    type="button"
                    disabled={isPast}
                    onClick={() => handleSelectSlot(slot)}
                    className={`py-1.5 text-xs font-mono font-medium rounded-lg text-center transition-all ${
                      isPast
                        ? 'opacity-30 bg-slate-50 text-slate-400 cursor-not-allowed line-through'
                        : isSelected
                        ? 'bg-[#6366F1] text-white font-bold shadow-xs'
                        : 'bg-white hover:bg-indigo-50 hover:text-[#6366F1] text-slate-700 border border-slate-200/80 cursor-pointer'
                    }`}
                  >
                    {slot}
                  </button>
                );
              })}
            </div>

            {/* Seletor Customizado: "Hora" e "Minuto" explícitos */}
            <div className="mt-3 pt-2.5 border-t border-slate-100">
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Outro Horário
              </span>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                    Hora
                  </label>
                  <select
                    value={customHour}
                    onChange={(e) => setCustomHour(e.target.value)}
                    className="w-full h-8 text-xs font-mono px-2 rounded-lg border border-indigo-200 bg-white text-slate-800 focus:outline-none focus:ring-1.5 focus:ring-[#818CF8]/40 cursor-pointer"
                  >
                    {Array.from({ length: 24 }).map((_, h) => {
                      const strH = String(h).padStart(2, '0');
                      return (
                        <option key={strH} value={strH}>
                          {strH}h
                        </option>
                      );
                    })}
                  </select>
                </div>

                <span className="text-slate-400 font-bold mt-3">:</span>

                <div className="flex-1">
                  <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                    Minuto
                  </label>
                  <select
                    value={customMin}
                    onChange={(e) => setCustomMin(e.target.value)}
                    className="w-full h-8 text-xs font-mono px-2 rounded-lg border border-indigo-200 bg-white text-slate-800 focus:outline-none focus:ring-1.5 focus:ring-[#818CF8]/40 cursor-pointer"
                  >
                    {['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'].map(
                      (m) => (
                        <option key={m} value={m}>
                          {m}m
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div className="shrink-0 mt-3.5">
                  <button
                    type="button"
                    onClick={handleApplyCustomTime}
                    className="h-8 px-3 rounded-lg bg-[#6366F1] hover:bg-[#4F46E5] text-white text-xs font-semibold flex items-center gap-1 shadow-2xs transition-colors cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Ok</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
