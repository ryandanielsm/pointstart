/**
 * POINT. Start - Utilitários de Data e Fuso Horário (Brasília / America/Sao_Paulo / UTC-3)
 * Garante que todas as comparações de data, vencimento e reuniões respeitem
 * rigorosamente o horário oficial de Brasília, sem discrepâncias com UTC.
 */

export const BRASILIA_TIMEZONE = 'America/Sao_Paulo';

/**
 * Retorna a data atual no formato 'YYYY-MM-DD' segundo o fuso de Brasília
 */
export function getBrasiliaTodayStr() {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: BRASILIA_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(new Date());
  } catch {
    const d = new Date();
    d.setHours(d.getHours() - 3);
    return d.toISOString().split('T')[0];
  }
}

/**
 * Soma dias úteis (segunda a sexta) a partir de uma data de referência no fuso de Brasília.
 * Retorna a data resultante no formato 'YYYY-MM-DD'.
 */
export function addBusinessDays(startDate = new Date(), daysToAdd = 1) {
  let currentDate;
  if (typeof startDate === 'string') {
    const cleanStr = startDate.split('T')[0];
    const parts = cleanStr.split('-').map(Number);
    if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
      currentDate = new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
    } else {
      currentDate = new Date();
      currentDate.setHours(12, 0, 0, 0);
    }
  } else if (startDate instanceof Date && !isNaN(startDate.getTime())) {
    currentDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), 12, 0, 0);
  } else {
    currentDate = new Date();
    currentDate.setHours(12, 0, 0, 0);
  }

  let added = 0;
  while (added < daysToAdd) {
    currentDate.setDate(currentDate.getDate() + 1);
    const dayOfWeek = currentDate.getDay(); // 0 = Domingo, 6 = Sábado
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      added++;
    }
  }

  const y = currentDate.getFullYear();
  const m = String(currentDate.getMonth() + 1).padStart(2, '0');
  const d = String(currentDate.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Retorna o timestamp (ms) do momento atual no fuso de Brasília
 */
export function getBrasiliaNowTime() {
  return Date.now();
}

/**
 * Converte qualquer representação de data/hora para timestamp ms absoluto
 * Se a string não contiver fuso horário (ex: "2026-11-23T19:14" ou "2026-11-23"),
 * assume que foi informada no fuso de Brasília (-03:00).
 */
export function parseBrasiliaDate(input) {
  if (!input) return null;
  if (input instanceof Date) return isNaN(input.getTime()) ? null : input;

  if (typeof input === 'number') {
    const d = new Date(input);
    return isNaN(d.getTime()) ? null : d;
  }

  if (typeof input === 'string') {
    let clean = input.trim();
    if (!clean) return null;

    // Se for apenas data YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
      clean = `${clean}T00:00:00-03:00`;
    } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(clean)) {
      // Data e hora sem timezone especificado: adiciona -03:00 (Brasília)
      clean = `${clean}-03:00`;
    }

    const parsed = new Date(clean);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
}

/**
 * Verifica se uma reunião Google Meet já foi efetivamente encerrada
 * Compara a data/hora final (meeting_end ou meeting_start + 45min) com o horário atual de Brasília.
 * Retorna FALSE para reuniões agendadas para mais tarde no mesmo dia ou dias futuros.
 */
export function isMeetingExpiredInBrasilia(meetingStart, meetingEnd, defaultDurationMin = 45) {
  if (!meetingStart && !meetingEnd) return false;

  let endTimestamp = null;

  if (meetingEnd) {
    const endObj = parseBrasiliaDate(meetingEnd);
    if (endObj) endTimestamp = endObj.getTime();
  }

  if (!endTimestamp && meetingStart) {
    const startObj = parseBrasiliaDate(meetingStart);
    if (startObj) {
      endTimestamp = startObj.getTime() + defaultDurationMin * 60000;
    }
  }

  if (!endTimestamp) return false;

  // Só está expirada se o momento de término já ficou para trás
  const nowMs = Date.now();
  return endTimestamp < nowMs;
}

/**
 * Verifica se a reunião está agendada para o dia de hoje (em Brasília)
 */
export function isMeetingTodayInBrasilia(meetingStart) {
  if (!meetingStart) return false;
  const startObj = parseBrasiliaDate(meetingStart);
  if (!startObj) return false;

  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: BRASILIA_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const meetDay = formatter.format(startObj);
    const today = formatter.format(new Date());
    return meetDay === today;
  } catch {
    return false;
  }
}

/**
 * Retorna os minutos restantes até o início da reunião (positivo: futura, negativo: em andamento/passada)
 */
export function getMinutesUntilMeeting(meetingStart) {
  if (!meetingStart) return null;
  const startObj = parseBrasiliaDate(meetingStart);
  if (!startObj) return null;

  const diffMs = startObj.getTime() - Date.now();
  return Math.round(diffMs / 60000);
}

/**
 * Formata data e hora para exibição amigável em pt-BR no fuso de Brasília
 */
export function formatBrasiliaDateTime(dateInput, includeTime = true) {
  const d = parseBrasiliaDate(dateInput);
  if (!d) return '';

  const options = {
    timeZone: BRASILIA_TIMEZONE,
    day: '2-digit',
    month: 'short',
  };

  if (includeTime) {
    options.hour = '2-digit';
    options.minute = '2-digit';
  }

  return new Intl.DateTimeFormat('pt-BR', options).format(d).replace('.', '');
}
