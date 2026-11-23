-- ==============================================================================
-- POINT. Start - Migração do Supabase: 8 Cards Padrão Trello & Google Meet
-- ==============================================================================
-- Execute este script no SQL Editor do Supabase:
-- https://supabase.com/dashboard/project/auimuxfkdqxjzgnecpez/sql

-- 1. Garante a existência das colunas para Google Meet na tabela tasks
ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS is_meeting boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS meet_link text,
ADD COLUMN IF NOT EXISTS meeting_start timestamp with time zone,
ADD COLUMN IF NOT EXISTS meeting_end timestamp with time zone;

-- 2. Função RPC para clonar/inicializar o modelo padrão de 5 etapas e 8 cards
CREATE OR REPLACE FUNCTION clone_client_template(
  p_name text,
  p_contact_name text DEFAULT '',
  p_contact_phone text DEFAULT '',
  p_start_date date DEFAULT CURRENT_DATE,
  p_drive_url text DEFAULT '',
  p_sheets_url text DEFAULT '',
  p_cnpj text DEFAULT '',
  p_city_state text DEFAULT '',
  p_segment text DEFAULT '',
  p_has_afd boolean DEFAULT false
) RETURNS uuid AS $$
DECLARE
  v_client_id uuid;
  v_stage_a_fazer uuid;
  v_stage_em_andamento uuid;
  v_stage_aguardando uuid;
  v_stage_agendado uuid;
  v_stage_concluido uuid;
BEGIN
  -- Cria o novo cliente
  INSERT INTO clients (
    name,
    contact_name,
    contact_phone,
    start_date,
    drive_folder_url,
    sheets_url,
    cnpj,
    city_state,
    segment,
    status
  ) VALUES (
    p_name,
    p_contact_name,
    p_contact_phone,
    p_start_date,
    p_drive_url,
    p_sheets_url,
    p_cnpj,
    p_city_state,
    p_segment,
    'No Prazo'
  ) RETURNING id INTO v_client_id;

  -- 1. Cria as 5 Etapas Trello
  INSERT INTO stages (client_id, position, title, color)
  VALUES (v_client_id, 1, 'A Fazer', '#818CF8')
  RETURNING id INTO v_stage_a_fazer;

  INSERT INTO stages (client_id, position, title, color)
  VALUES (v_client_id, 2, 'Em Andamento', '#3B82F6')
  RETURNING id INTO v_stage_em_andamento;

  INSERT INTO stages (client_id, position, title, color)
  VALUES (v_client_id, 3, 'Aguardando Cliente', '#F59E0B')
  RETURNING id INTO v_stage_aguardando;

  INSERT INTO stages (client_id, position, title, color)
  VALUES (v_client_id, 4, 'Agendado', '#A855F7')
  RETURNING id INTO v_stage_agendado;

  INSERT INTO stages (client_id, position, title, color)
  VALUES (v_client_id, 5, 'Concluído', '#10B981')
  RETURNING id INTO v_stage_concluido;

  -- 2. Insere os 8 Cards Padrão - TODOS na primeira coluna "A Fazer" e 100% zerados (0% de progresso)
  -- Card 1: Alinhamento Inicial e Cronograma
  INSERT INTO tasks (
    client_id, stage_id, title, owner, status, is_meeting, position, checklist, description
  ) VALUES (
    v_client_id,
    v_stage_a_fazer,
    'Alinhamento Inicial e Cronograma',
    'POINT.',
    'Não Iniciado',
    true,
    1,
    '[{"id":"1","text":"Realizar reunião de boas-vindas","done":false},{"id":"2","text":"Definir cronograma oficial","done":false}]'::jsonb,
    'Reunião de boas-vindas e alinhamento de escopo, regras e cronograma oficial da implantação.'
  );

  -- Card 2: Coleta de Dados e Colaboradores
  INSERT INTO tasks (
    client_id, stage_id, title, owner, status, is_meeting, position, checklist, description
  ) VALUES (
    v_client_id,
    v_stage_a_fazer,
    'Coleta de Dados e Colaboradores',
    'Cliente',
    'Não Iniciado',
    false,
    2,
    '[{"id":"1","text":"Preencher planilha de colaboradores","done":false},{"id":"2","text":"Validar dados cadastrais","done":false}]'::jsonb,
    'Preenchimento da planilha de colaboradores e validação dos dados cadastrais.'
  );

  -- Card 3: Migração de Histórico (AFD)
  INSERT INTO tasks (
    client_id, stage_id, title, owner, status, is_meeting, position, checklist, description
  ) VALUES (
    v_client_id,
    v_stage_a_fazer,
    'Migração de Histórico (AFD)',
    'POINT.',
    'Não Iniciado',
    false,
    3,
    '[{"id":"1","text":"Receber e importar arquivo AFD","done":false},{"id":"2","text":"Conferir marcações no painel POINT.","done":false}]'::jsonb,
    'Recebimento e importação do arquivo AFD no sistema e conferência de marcações no painel POINT.'
  );

  -- Card 4: Configuração de Jornadas e Regras
  INSERT INTO tasks (
    client_id, stage_id, title, owner, status, is_meeting, position, checklist, description
  ) VALUES (
    v_client_id,
    v_stage_a_fazer,
    'Configuração de Jornadas e Regras',
    'POINT.',
    'Não Iniciado',
    false,
    4,
    '[{"id":"1","text":"Cadastrar escalas e horários","done":false},{"id":"2","text":"Configurar perfis de acesso e fluxos","done":false}]'::jsonb,
    'Cadastro de escalas e horários, perfis de acesso e fluxos de aprovação.'
  );

  -- Card 5: Simulação e Validação
  INSERT INTO tasks (
    client_id, stage_id, title, owner, status, is_meeting, position, checklist, description
  ) VALUES (
    v_client_id,
    v_stage_a_fazer,
    'Simulação e Validação',
    'POINT.',
    'Não Iniciado',
    false,
    5,
    '[{"id":"1","text":"Simular batidas e fechamento","done":false},{"id":"2","text":"Obter aceite do cliente","done":false}]'::jsonb,
    'Simulação de batidas e fechamento e obtenção de aceite do cliente.'
  );

  -- Card 6: Treinamento da Equipe e Gestores
  INSERT INTO tasks (
    client_id, stage_id, title, owner, status, is_meeting, position, checklist, description
  ) VALUES (
    v_client_id,
    v_stage_a_fazer,
    'Treinamento da Equipe e Gestores',
    'POINT.',
    'Não Iniciado',
    true,
    6,
    '[{"id":"1","text":"Treinar RH e gestores no painel web","done":false},{"id":"2","text":"Treinar colaboradores no app/totem","done":false}]'::jsonb,
    'Treinamento do RH e gestores no painel web e treinamento de colaboradores no app/totem.'
  );

  -- Card 7: Go-Live (Início da Operação Oficial)
  INSERT INTO tasks (
    client_id, stage_id, title, owner, status, is_meeting, position, checklist, description
  ) VALUES (
    v_client_id,
    v_stage_a_fazer,
    'Go-Live (Início da Operação Oficial)',
    'POINT.',
    'Não Iniciado',
    false,
    7,
    '[{"id":"1","text":"Disparar convites do app","done":false},{"id":"2","text":"Validar primeiras batidas oficiais","done":false}]'::jsonb,
    'Disparo de convites do app para a equipe e validação das primeiras batidas oficiais.'
  );

  -- Card 8: Acompanhamento Assistido (30 dias)
  INSERT INTO tasks (
    client_id, stage_id, title, owner, status, is_meeting, position, checklist, description
  ) VALUES (
    v_client_id,
    v_stage_a_fazer,
    'Acompanhamento Assistido (30 dias)',
    'POINT.',
    'Não Iniciado',
    false,
    8,
    '[{"id":"1","text":"Monitorar primeiras semanas","done":false},{"id":"2","text":"Validar 1º fechamento de folha","done":false}]'::jsonb,
    'Monitoramento das primeiras semanas e validação do 1º fechamento de folha.'
  );

  -- Registra log de criação
  INSERT INTO activity_logs (
    client_id,
    client_name,
    action_type,
    description,
    source
  ) VALUES (
    v_client_id,
    p_name,
    'CLIENT_CREATED',
    'Cliente "' || p_name || '" criado com as 5 etapas Trello e 8 cards padrão de implantação.',
    'Plataforma'
  );

  RETURN v_client_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Recarrega o cache do PostgREST
NOTIFY pgrst, 'reload schema';
