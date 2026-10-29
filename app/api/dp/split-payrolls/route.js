import { NextResponse } from 'next/server';
import { PDFDocument } from 'pdf-lib';
import pdfParse from 'pdf-parse';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const competence = formData.get('competence') || '';

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado.' }, { status: 400 });
    }
    if (!competence) {
      return NextResponse.json({ error: 'Nenhuma competência selecionada.' }, { status: 400 });
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const originalPdfDoc = await PDFDocument.load(fileBuffer);
    const totalPages = originalPdfDoc.getPageCount();

    if (totalPages === 0) {
      return NextResponse.json({ error: 'O PDF enviado está vazio.' }, { status: 400 });
    }

    const processados = [];
    const atualizados = [];

    // Fatiamento direto página por página
    for (let i = 0; i < totalPages; i++) {
      const singlePageDoc = await PDFDocument.create();
      const [copiedPage] = await singlePageDoc.copyPages(originalPdfDoc, [i]);
      singlePageDoc.addPage(copiedPage);
      const singlePdfBytes = await singlePageDoc.save();

      const parsedText = await pdfParse(Buffer.from(singlePdfBytes));
      const pageText = parsedText.text;

      // 1. Extração do CPF no rodapé ("portador do CPF 074.940.539-21")
      const cpfMatch = pageText.match(/(?:CPF|cpf)[^\d]*(\d{3}\.?\d{3}\.?\d{3}-?\d{2})/i)
                    || pageText.match(/\d{3}\.\d{3}\.\d{3}-\d{2}/)
                    || pageText.match(/(?:\D|^)(\d{11})(?:\D|$)/);

      const rawCpf = cpfMatch ? (cpfMatch[1] || cpfMatch[0]).replace(/\D/g, '') : null;

      if (!rawCpf || rawCpf.length !== 11) {
        continue; // Ignora páginas sem CPF identificado
      }

      // 2. Extração Precisa e Universal de Matrícula e Nome (Padrão Senior HCM)
      let matricula = null;
      let nomeEncontrado = 'Colaborador';

      // Divide o texto do PDF linha a linha
      const linhas = pageText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

      // Localiza o índice da linha que contém a palavra CARGO
      const indexCargo = linhas.findIndex(l => /^(CARGO|LOCAL)\b/i.test(l) || l.includes('CARGO '));

      if (indexCargo > 0) {
        // A linha imediatamente anterior ao CARGO contém: [MATRÍCULA] [NOME] [DATA ADMISSÃO]
        const linhaDados = linhas[indexCargo - 1];

        // Expressão: captura o primeiro bloco (matrícula), o nome no meio e a data opcional no final
        const matchDados = linhaDados.match(/^([0-9.\-_]{1,15})\s+([A-Za-zÀ-ÖØ-öø-ÿ\s]{3,60}?)(?:\s+\d{1,2}\/\d{1,2}\/\d{2,4})?$/);

        if (matchDados) {
          matricula = matchDados[1].trim();
          const nomeCandidato = matchDados[2].trim();
          if (nomeCandidato && !nomeCandidato.toLowerCase().includes('empresa') && !nomeCandidato.toLowerCase().includes('cadastro')) {
            nomeEncontrado = nomeCandidato;
          }
        } else {
          // Caso a linha não termine em data, isola tirando o primeiro número (matrícula)
          const partes = linhaDados.split(/\s{2,}|\t/);
          if (partes.length >= 2) {
            matricula = partes[0].replace(/[^\d.\-_]/g, '').trim();
            nomeEncontrado = partes[1].replace(/\d{1,2}\/\d{1,2}\/\d{2,4}.*$/, '').trim();
          } else {
            // Separação por espaço simples: primeiro termo = matrícula
            const tokens = linhaDados.split(' ');
            if (tokens.length >= 2 && /^[0-9.\-_]+$/.test(tokens[0])) {
              matricula = tokens[0];
              const restoSemData = tokens.slice(1).join(' ').replace(/\d{1,2}\/\d{1,2}\/\d{2,4}.*$/, '').trim();
              if (restoSemData.length >= 3) {
                nomeEncontrado = restoSemData;
              }
            }
          }
        }
      }

      // Fallback de segurança se indexCargo não tiver sido localizado
      if (nomeEncontrado === 'Colaborador' || !matricula) {
        for (const l of linhas) {
          const matchLinha = l.match(/^([0-9][0-9.\-_]{2,14})\s+([A-Za-zÀ-ÖØ-öø-ÿ\s]{3,50})/);
          if (matchLinha && !l.includes('ACUCAR') && !l.includes('BANDEIRANTES') && !l.includes('DEMONSTRATIVO')) {
            matricula = matchLinha[1].trim();
            nomeEncontrado = matchLinha[2].replace(/\d{1,2}\/\d{1,2}\/\d{2,4}.*$/, '').trim();
            break;
          }
        }
      }

      // 4. Prevenção de duplicidade: checa se já existe registro com mesmo CPF e competência
      const { data: existente } = await supabase
        .from('employee_payrolls')
        .select('id')
        .eq('cpf', rawCpf)
        .eq('competence', competence)
        .maybeSingle();

      const safeCompetence = competence.replace('/', '-');
      const fileName = `${safeCompetence}/${rawCpf}.pdf`;

      // Upload no storage (upsert)
      await supabase.storage
        .from('holerites')
        .upload(fileName, singlePdfBytes, {
          contentType: 'application/pdf',
          upsert: true
        });

      const { data: publicUrlData } = supabase.storage
        .from('holerites')
        .getPublicUrl(fileName);

      if (existente) {
        // Atualiza mantendo o mesmo ID
        await supabase
          .from('employee_payrolls')
          .update({
            employee_name: nomeEncontrado,
            registration_number: matricula,
            file_url: publicUrlData.publicUrl,
            status: 'Pendente'
          })
          .eq('id', existente.id);

        atualizados.push(rawCpf);
      } else {
        // Cria novo
        const { data: dbData } = await supabase
          .from('employee_payrolls')
          .insert([
            {
              employee_name: nomeEncontrado,
              cpf: rawCpf,
              registration_number: matricula,
              competence: competence,
              file_url: publicUrlData.publicUrl,
              status: 'Pendente'
            }
          ])
          .select()
          .single();

        if (dbData) processados.push(dbData);
      }
    }

    return NextResponse.json({
      success: true,
      totalPages,
      processedCount: processados.length,
      updatedCount: atualizados.length,
      message: `${processados.length} novos holerites importados e ${atualizados.length} atualizados com sucesso.`
    });
  } catch (error) {
    console.error('Erro ao processar PDF do Senior HCM:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
