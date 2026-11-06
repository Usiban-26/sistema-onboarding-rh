import { NextResponse } from 'next/server';
import { PDFDocument } from 'pdf-lib';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const cpf = searchParams.get('cpf')?.replace(/\D/g, '');
    const competence = searchParams.get('competence');

    if (!cpf || !competence) {
      return new NextResponse('Parâmetros inválidos.', { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    // 1. Busca os metadados do holerite
    const { data: holerite } = await supabase
      .from('employee_payrolls')
      .select('page_number, file_url')
      .eq('cpf', cpf)
      .eq('competence', competence)
      .maybeSingle();

    if (!holerite) {
      return new NextResponse('Holerite não localizado no sistema.', { status: 404 });
    }

    const safeComp = competence.replace('/', '-');

    // Caso 1: Nova Arquitetura Rápida (com número de página e folha consolidada)
    if (holerite.page_number) {
      const pathConsolidado = `${safeComp}/folha_completa.pdf`;
      const { data: fileBlob, error: downloadError } = await supabase.storage
        .from('holerites')
        .download(pathConsolidado);

      if (!downloadError && fileBlob) {
        const pdfBytes = await fileBlob.arrayBuffer();
        const pdfDocOriginal = await PDFDocument.load(pdfBytes);

        const singleDoc = await PDFDocument.create();
        const [pageCopied] = await singleDoc.copyPages(pdfDocOriginal, [holerite.page_number - 1]);
        singleDoc.addPage(pageCopied);
        const finalPdfBytes = await singleDoc.save();

        return new NextResponse(finalPdfBytes, {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `inline; filename="holerite_${safeComp}_${cpf}.pdf"`
          }
        });
      }
    }

    // Caso 2: Fallback para arquivos individuais salvos anteriormente
    const pathIndividual = `${safeComp}/${cpf}.pdf`;
    const { data: indBlob, error: indError } = await supabase.storage
      .from('holerites')
      .download(pathIndividual);

    if (!indError && indBlob) {
      const indBytes = await indBlob.arrayBuffer();
      return new NextResponse(indBytes, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="holerite_${safeComp}_${cpf}.pdf"`
        }
      });
    }

    return new NextResponse('Arquivo do holerite não encontrado no armazenamento.', { status: 404 });

  } catch (err) {
    return new NextResponse(`Erro ao gerar PDF: ${err.message}`, { status: 500 });
  }
}
