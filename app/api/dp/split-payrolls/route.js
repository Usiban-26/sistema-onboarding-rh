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

      // 1. Extração do CPF no rodapé
      const cpfMatch = pageText.match(/(?:CPF|cpf)[^\d]*(\d{3}\.?\d{3}\.?\d{3}-?\d{2})/i)
                    || pageText.match(/\d{3}\.\d{3}\.\d{3}-\d{2}/)
                    || pageText.match(/(?:\D|^)(\d{11})(?:\D|$)/);

      const rawCpf = cpfMatch ? (cpfMatch[1] || cpfMatch[0]).replace(/\D/g, '') : null;

      if (!rawCpf || rawCpf.length !== 11) {
        continue; // Ignora páginas sem CPF identificado
      }

      // 2. Extração Flexível de Matrícula (qualquer quantidade de dígitos/pontos)
      let matricula = null;
      // Procura número que vem imediatamente após a palavra CADASTRO ou EMPREGADO
      const regMatch = pageText.match(/CADASTRO[^\d\n\r]*([0-9][0-9.\-_]{1,15})/i)
                    || pageText.match(/(?:Empregado|Matr[íi]cula)[^\d\n\r]*([0-9][0-9.\-_]{1,15})/i);
      
      if (regMatch) {
        matricula = regMatch[1].trim();
      }

      // 3. Extração Direta do Nome Ancorada nos Campos Vizinhos
      let nomeEncontrado = 'Colaborador';

      // Pega todo o texto situado entre "NOME" e "DATA ADMISSÃO" ou "CARGO"
      const matchBlocoNome = pageText.match(/\bNOME\b[:\s\r\n]+([\s\S]*?)(?=\bDATA\s*ADMISS[AÃ]O\b|\bCARGO\b|\bLOCAL\b|$)/i);

      if (matchBlocoNome && matchBlocoNome[1]) {
        let textoExtraido = matchBlocoNome[1].trim();

        // Se a matrícula veio grudada no início do bloco de nome, remove os números iniciais
        textoExtraido = textoExtraido.replace(/^[0-9.\-_]+\s*/, '');

        // Remove eventuais datas completas que tenham sobrado (ex: 21/05/2026)
        textoExtraido = textoExtraido.replace(/\d{1,2}\/\d{1,2}\/\d{2,4}.*$/, '');

        // Remove quebras de linha e palavras de controle do cabeçalho
        textoExtraido = textoExtraido
          .replace(/^(EMPRESA|CADASTRO)\s*/i, '')
          .replace(/[\r\n]+/g, ' ')
          .replace(/\s{2,}/g, ' ')
          .trim();

        // Garante que é um nome válido e não um título do sistema
        if (textoExtraido.length >= 3 && 
            !textoExtraido.toLowerCase().includes('demonstrativo') && 
            !textoExtraido.toLowerCase().includes('empresa')) {
          nomeEncontrado = textoExtraido;
        }
      }

      // Fallback: se ainda estiver como "Colaborador", procura linha de texto após CADASTRO
      if (nomeEncontrado === 'Colaborador') {
        const matchLinha = pageText.match(/CADASTRO\s+[0-9.\-_]+\s+([A-ZÀ-Ú\s]{3,60}?)(?=\s+\d{1,2}\/\d{1,2}\/\d{2,4}|\s+CARGO|$)/i);
        if (matchLinha && matchLinha[1]) {
          nomeEncontrado = matchLinha[1].trim();
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
