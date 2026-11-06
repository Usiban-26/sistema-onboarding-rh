import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { registros, competence } = await request.json();

    if (!registros || !registros.length || !competence) {
      return NextResponse.json({ error: 'Parâmetros ausentes.' }, { status: 400 });
    }

    // Busca todos os funcionários da base oficial (para cruzar CPF, Matrícula e Nome)
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

    // Cria mapas em memória para busca instantânea por CPF, por Matrícula e por Nome
    const mapaPorCpf = new Map();
    const mapaPorMatricula = new Map();

    todosFuncionarios.forEach(f => {
      const cpfLimpo = (f.cpf || '').replace(/\D/g, '');
      if (cpfLimpo) mapaPorCpf.set(cpfLimpo, f);
      
      const matLimpa = (f.registration_number || '').trim();
      if (matLimpa) mapaPorMatricula.set(matLimpa, f);
    });

    const safeComp = competence.replace('/', '-');
    const dadosParaSalvar = [];
    const naoIdentificados = [];

    for (const item of registros) {
      let cpfFinal = item.cpf ? item.cpf.replace(/\D/g, '') : null;
      let matriculaFinal = item.matricula ? String(item.matricula).trim() : null;
      let nomeFinal = item.nome;

      // RESOLUÇÃO DO ITEM 4: Se o holerite não tem CPF (ex: líquido zerado sem linha de depósito),
      // localiza o colaborador na base 'employees' pela Matrícula!
      if (!cpfFinal && matriculaFinal && mapaPorMatricula.has(matriculaFinal)) {
        const colab = mapaPorMatricula.get(matriculaFinal);
        cpfFinal = colab.cpf.replace(/\D/g, '');
        if (nomeFinal === 'Colaborador') nomeFinal = colab.full_name;
      }

      // Se achou o CPF, complementa dados se faltar algo
      if (cpfFinal && mapaPorCpf.has(cpfFinal)) {
        const colab = mapaPorCpf.get(cpfFinal);
        if (!matriculaFinal && colab.registration_number) matriculaFinal = colab.registration_number;
        if (nomeFinal === 'Colaborador' && colab.full_name) nomeFinal = colab.full_name;
      }

      // Se após todas as tentativas tivermos o CPF de 11 dígitos, salvamos
      if (cpfFinal && cpfFinal.length === 11) {
        dadosParaSalvar.push({
          cpf: cpfFinal,
          employee_name: nomeFinal,
          registration_number: matriculaFinal,
          competence: competence,
          page_number: item.pageNumber,
          file_url: `${safeComp}/${cpfFinal}.pdf`,
          status: 'Pendente'
        });
      } else {
        naoIdentificados.push({
          pagina: item.pageNumber,
          matricula: matriculaFinal || 'Não identificada',
          motivo: 'Líquido zerado sem CPF e matrícula não localizada na base oficial'
        });
      }
    }

    // Upsert dos registros no banco em blocos
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
