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

      // 2. Extração à Prova de Falhas (Achatar o texto e usar assinatura de dados)
      let matricula = null;
      let nomeEncontrado = 'Colaborador';

      // Substitui as quebras de linha por espaços para neutralizar a desorganização de colunas do PDF
      const flatText = pageText.replace(/\r?\n/g, ' ').replace(/\s{2,}/g, ' ');

      // Padrão 1: Matrícula (qualquer formato) + Nome + Data Admissão 
      // Ex: "1.015344 ALESSANDRO DE OLIVEIRA 21/05/2026" ou "10697032906 IGOR EURIPEDES DIAS 06/08/2026"
      const regexPadrao1 = /\b([0-9.\-_]{4,15})\s+([A-Za-zÀ-Úà-ú\s]{4,60}?)\s+\d{2}\/\d{2}\/\d{4}\b/i;
      const match1 = flatText.match(regexPadrao1);

      if (match1) {
        matricula = match1[1].trim();
        nomeEncontrado = match1[2].trim();
      } else {
        // Padrão 2: Matrícula + Nome + CARGO (Quando a data não está no holerite)
        const regexPadrao2 = /\b([0-9.\-_]{4,15})\s+([A-Za-zÀ-Úà-ú\s]{4,60}?)\s+CARGO\b/i;
        const match2 = flatText.match(regexPadrao2);
        
        if (match2) {
          matricula = match2[1].trim();
          nomeEncontrado = match2[2].trim();
        } else {
          // Padrão 3: Leitura sequencial de rótulos (CADASTRO -> Valor -> NOME -> Valor)
          const regexPadrao3 = /CADASTRO\s+([0-9.\-_]{4,15})\s+NOME\s+([A-Za-zÀ-Úà-ú\s]{4,60}?)\s+(?:DATA|CARGO|LOCAL)/i;
          const match3 = flatText.match(regexPadrao3);
          
          if (match3) {
            matricula = match3[1].trim();
            nomeEncontrado = match3[2].trim();
          }
        }
      }

      // Limpeza de impurezas para assegurar um nome perfeito
      if (nomeEncontrado !== 'Colaborador') {
        nomeEncontrado = nomeEncontrado
          .replace(/^(NOME|CADASTRO|EMPRESA|DATA)\s*/i, '') // Remove lixo do início
          .replace(/\b(DATA|ADMISS[AÃ]O|CARGO|LOCAL|CNPJ)\b.*$/i, '') // Remove lixo do fim
          .replace(/[0-9.\-_]/g, '') // Elimina números ou pontuações residuais
          .trim();
          
        // Validação contra rótulos da empresa lidos por engano
        if (nomeEncontrado.length < 4 || 
            nomeEncontrado.toLowerCase().includes('demonstrativo') || 
            nomeEncontrado.toLowerCase().includes('acucar e alcool') ||
            nomeEncontrado.toLowerCase().includes('bandeirantes')) {
          nomeEncontrado = 'Colaborador';
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
