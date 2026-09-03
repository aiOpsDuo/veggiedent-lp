/**
 * Um arquivo do tamanho que o teste precisar, sem alocar o tamanho.
 *
 * Um `File` de 60 MB de verdade tornaria a suíte lenta e frágil sem provar nada
 * a mais: o que o painel lê do arquivo escolhido é o nome, o tipo e o tamanho.
 */
export function arquivoDe(nome: string, tipo: string, bytes: number): File {
  const file = new File(['x'], nome, { type: tipo })
  Object.defineProperty(file, 'size', { value: bytes })
  return file
}
