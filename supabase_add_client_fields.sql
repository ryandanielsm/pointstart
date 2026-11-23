-- ==============================================================================
-- POINT. Start - Migração do Supabase: Novos Campos de Cadastro da Empresa
-- ==============================================================================
-- Execute este comando no SQL Editor do seu projeto Supabase:
-- https://supabase.com/dashboard/project/auimuxfkdqxjzgnecpez/sql

-- 1. Adiciona as 3 colunas opcionais (nullable text) na tabela clients
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS cnpj text,
ADD COLUMN IF NOT EXISTS city_state text,
ADD COLUMN IF NOT EXISTS segment text;

-- 2. Recarrega o cache do PostgREST para reconhecer as novas colunas imediatamente
NOTIFY pgrst, 'reload schema';
