import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function apenasDigitos(val) {
  return String(val || '').replace(/\D/g, '');
}

function normalizarNome(txt) {
  return String(txt || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function POST(request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { registros, competence } = await request.json();

    if (!registros || !registros.length || !competence) {
      return NextResponse.json({ error: 'Parâmetros ausentes.' }, { status: 400 });
    }

    // 1. Busca todos os funcionários da base oficial com paginação
    let todosFuncionarios = [];
    let inicio = 0;
    const passo = 1000;
    let continuar = true;

    while (continuar) {
      const { data: lote, error } = await supabase
        .from('employees')
        .select('cpf, full_name, registration_number')
        .range(inicio, inicio + passo - 1);

      if (error || !lote || lote.length === 0) {
        continuar = false;
      } else {
        todosFuncionarios = todosFuncionarios.concat(lote);
        if (lote.length < passo) continuar = false;
        else inicio += passo;
      }
    }

    // 2. Mapas em memória com chaves normalizadas (sem pontos, sem traços, sem zeros à esquerda)
    const mapaPorCpf = new Map();
    const mapaPorMatricula = new Map();
    const mapaPorNome = new Map();

    todosFuncionarios.forEach(f => {
      const cpfLimpo = apenasDigitos(f.cpf);
      if (cpfLimpo) mapaPorCpf.set(cpfLimpo, f);

      const matRaw = String(f.registration_number || '').trim();
      const matLimpa = apenasDigitos(matRaw);
      const matSemZero = matLimpa.replace(/^0+/, '');

      if (matRaw) mapaPorMatricula.set(matRaw, f);
      if (matLimpa) mapaPorMatricula.set(matLimpa, f);
      if (matSemZero) mapaPorMatricula.set(matSemZero, f);

      const nomeNorm = normalizarNome(f.full_name);
      if (nomeNorm && nomeNorm.length >= 4) {
        mapaPorNome.set(nomeNorm, f);
      }
    });

    const safeComp = competence.replace('/', '-');
    const dadosParaSalvar = [];
    const naoIdentificados = [];

    // 3. Processa cada página indexada do PDF
    for (const item of registros) {
      let cpfFinal = item.cpf ? apenasDigitos(item.cpf) : null;
      let matriculaBruta = item.matricula ? String(item.matricula).trim() : '';
      let matriculaLimpa = apenasDigitos(matriculaBruta);
      let matriculaSemZero = matriculaLimpa.replace(/^0+/, '');
      let nomeBruto = item.nome || 'Colaborador';
      let nomeNorm = normalizarNome(nomeBruto);

      let funcionarioEncontrado = null;

      // RESOLUÇÃO DE HOLERITE ZERADO (SEM CPF NO RODAPÉ):
      // Busca 1: Pela Matrícula (números puros sem ponto ou sem zeros)
      if (matriculaLimpa && mapaPorMatricula.has(matriculaLimpa)) {
        funcionarioEncontrado = mapaPorMatricula.get(matriculaLimpa);
      } else if (matriculaSemZero && mapaPorMatricula.has(matriculaSemZero)) {
        funcionarioEncontrado = mapaPorMatricula.get(matriculaSemZero);
      } else if (matriculaBruta && mapaPorMatricula.has(matriculaBruta)) {
        funcionarioEncontrado = mapaPorMatricula.get(matriculaBruta);
      }

      // Busca 2: Pelo Nome Completo (se a matrícula não bateu)
      if (!funcionarioEncontrado && nomeNorm && nomeNorm !== 'COLABORADOR' && mapaPorNome.has(nomeNorm)) {
        funcionarioEncontrado = mapaPorNome.get(nomeNorm);
      }

      // Se localizou na base de colaboradores, recupera o CPF e dados cadastrais
      let matriculaFinal = matriculaBruta;
      let nomeFinal = nomeBruto;

      if (funcionarioEncontrado) {
        if (!cpfFinal) cpfFinal = apenasDigitos(funcionarioEncontrado.cpf);
        matriculaFinal = funcionarioEncontrado.registration_number || matriculaBruta;
        nomeFinal = funcionarioEncontrado.full_name || nomeBruto;
      } else if (cpfFinal && mapaPorCpf.has(cpfFinal)) {
        const colab = mapaPorCpf.get(cpfFinal);
        if (!matriculaFinal && colab.registration_number) matriculaFinal = colab.registration_number;
        if (nomeFinal === 'Colaborador' && colab.full_name) nomeFinal = colab.full_name;
      }

      // Se temos o CPF de 11 dígitos garantido, salva normalmente
      if (cpfFinal && cpfFinal.length === 11) {
        dadosParaSalvar.push({
          cpf: cpfFinal,
          employee_name: nomeFinal,
          registration_number: matriculaFinal || null,
          competence: competence,
          page_number: item.pageNumber,
          file_url: `${safeComp}/${cpfFinal}.pdf`,
          status: 'Pendente'
        });
      } else {
        naoIdentificados.push({
          pagina: item.pageNumber,
          matricula: matriculaBruta || 'Sem matrícula',
          nome: nomeBruto,
          motivo: 'Holerite zerado sem CPF e sem correspondência na Base de Colaboradores'
        });
      }
    }

    // 4. Grava no banco em lotes
    const TAMANHO_BLOCO = 500;
    for (let i = 0; i < dadosParaSalvar.length; i += TAMANHO_BLOCO) {
      const pedaco = dadosParaSalvar.slice(i, i + TAMANHO_BLOCO);
      const { error: dbError } = await supabase
        .from('employee_payrolls')
        .upsert(pedaco, { onConflict: 'cpf,competence' });

      if (dbError) throw dbError;
    }

    return NextResponse.json({
      success: true,
      totalSalvos: dadosParaSalvar.length,
      naoIdentificados
    });

  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
