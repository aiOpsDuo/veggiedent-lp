import { useState } from 'react'
import { Card } from '../shared/Card'
import { MultiImageMediaField } from './MultiImageMediaField'

/**
 * Harness de verificação (T36, item 3) — não é uma tela de conteúdo do CMS.
 * Existe só para exercitar `MultiImageMediaField` de verdade, num navegador
 * logado, sem depender de nenhuma seção existente: o valor fica em memória
 * nesta tela, nunca é gravado em nenhum documento. Ver a decisão registrada
 * no comentário de `MultiImageMediaField.tsx` sobre por que nenhuma seção
 * real foi migrada para usar esta variante ainda.
 */
export function MultiImageFieldHarnessScreen(): JSX.Element {
  const [ids, setIds] = useState<readonly string[]>([])

  return (
    <section className="space-y-6 pb-24">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
          Verificação — campo de múltiplas imagens
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Harness de desenvolvimento (T36, item 3), não uma tela do CMS: envie e
          remova imagens de verdade para conferir a variante múltipla do
          dropzone. Nada aqui é gravado em nenhuma seção — o valor abaixo só
          existe enquanto esta tela estiver aberta.
        </p>
      </header>

      <Card className="space-y-2">
        <label
          htmlFor="harness-multi-imagem"
          className="text-sm font-medium text-slate-800 dark:text-slate-200"
        >
          Fotos de exemplo
        </label>
        <MultiImageMediaField
          id="harness-multi-imagem"
          describedBy={undefined}
          invalid={false}
          required={false}
          value={ids}
          onChange={setIds}
        />
      </Card>

      <p className="text-xs text-slate-500 dark:text-slate-400">
        {ids.length === 0
          ? 'Identificadores guardados agora: nenhum.'
          : `Identificadores guardados agora: ${ids.join(', ')}.`}
      </p>
    </section>
  )
}
