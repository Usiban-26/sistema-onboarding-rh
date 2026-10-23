# Sistema de Admissão & Onboarding RH - Usiban

## 1. Visão Geral e Stack Tecnológica
- **Finalidade:** Digitalização, automação e gestão do processo admissional de novos colaboradores.
- **Front-end:** Next.js (React), App Router, Tailwind CSS / Inline Styling.
- **Hospedagem & Deploy:** Vercel (CI/CD integrado ao repositório `Usiban-26/sistema-onboarding-rh`).
- **Back-end & Banco:** Supabase (PostgreSQL).
- **Armazenamento de Ficheiros:** Supabase Storage (Bucket `documentos-rh`, público).

## 2. Estrutura de Rotas e Páginas
- `/` (`app/page.js`): Portal público do candidato.
  - Carrega dinamicamente a lista de documentos ativos da tabela `required_documents`.
  - Permite o preenchimento de dados pessoais e anexo individual de cada documento.
  - Grava os arquivos no bucket `documentos-rh` com `contentType` forçado para integridade.
- `/admin` (`app/admin/page.js`): Painel restrito do RH.
  - Proteção por senha mestra (`rh2026`).
  - **Aba 1 (Candidatos & Validação):** Filtros por status, aprovação, rejeição com justificativa e links para abertura direta dos documentos.
  - **Aba 2 (Configurar Documentos Exigidos):** Adição e desativação em tempo real de documentos requeridos na admissão.

## 3. Modelo de Dados (Supabase)
### Tabela `onboarding_candidates`
- `id`: UUID (Primary Key)
- `full_name`: Text
- `email`: Text
- `phone`: Text
- `job_title`: Text
- `department`: Text
- `status`: Text ('Pendente', 'Aprovado', 'Rejeitado / Pendência')
- `feedback_reason`: Text (Motivo de pendência preenchido pelo RH)
- `created_at`: Timestamp

### Tabela `required_documents`
- `id`: UUID (Primary Key)
- `title`: Text (Nome da exigência)
- `description`: Text (Instruções ao candidato)
- `is_required`: Boolean
- `is_active`: Boolean
- `created_at`: Timestamp

### Tabela `candidate_documents`
- `id`: UUID (Primary Key)
- `candidate_id`: UUID (FK -> `onboarding_candidates.id`)
- `document_name`: Text
- `document_url`: Text (URL pública direta no bucket)
- `created_at`: Timestamp

  ### Tabela `required_personal_fields`
- `id`: UUID (Primary Key)
- `label`: Text (Nome da pergunta, ex: PIS, Nome da Mãe)
- `field_type`: Text ('text', 'email', 'tel', 'date', 'number')
- `placeholder`: Text
- `is_required`: Boolean
- `is_active`: Boolean
- `created_at`: Timestamp

## 4. Variáveis de Ambiente Necessárias (Vercel)
- `NEXT_PUBLIC_SUPABASE_URL`: URL do projeto no Supabase.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Chave anônima de leitura/escrita com RLS.
