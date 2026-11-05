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

    // Busca a base de funcionários para enriquecer nomes/matrículas que faltarem
    const { data: todosFuncionarios } = await supabase
      .from('employees')
      .select('cpf, full_name, registration_number');

    const mapaColab = new Map();
    (todosFuncionarios || []).forEach(f => mapaColab.set(f.cpf, f));

    const safeComp = competence.replace('/', '-');

    // Mapeia os registros para upsert no banco
    const dadosParaSalvar = registros.map(item => {
      const funcionario = mapaColab.get(item.cpf);
      const nomeFinal = item.nome !== 'Colaborador' ? item.nome : (funcionario?.full_name || 'Colaborador');
      const matriculaFinal = item.matricula || funcionario?.registration_number || null;

      return {
        cpf: item.cpf,
        employee_name: nomeFinal,
        registration_number: matriculaFinal,
        competence: competence,
        page_number: item.pageNumber,
        file_url: `${safeComp}/${item.cpf}.pdf`, // Endereço padronizado
        status: 'Pendente'
      };
    });

    // Grava tudo no banco em blocos de 500 para máximo desempenho
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
      totalSalvos: dadosParaSalvar.length
    });

  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
