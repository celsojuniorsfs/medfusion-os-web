/**
 * O QR Code colado no equipamento aponta pro alias curto /os/:equipmentId (web#101, gerado em
 * web#102) — extrai só o id do caminho em vez de exigir que a origem bata exatamente com a deste
 * app: um QR impresso a partir de outro ambiente (ex.: produção) ainda deve funcionar aqui, já
 * que o id sozinho é suficiente pra resolver o equipamento (e a própria API decide se ele
 * existe/pertence a alguém). Um texto escaneado que não seja uma URL, ou que não bata com esse
 * formato (ex.: QR Code de outra coisa), retorna null — não é um erro, é "não reconhecido".
 */
export function extractEquipmentId(scannedText: string): string | null {
  try {
    const url = new URL(scannedText);
    const match = url.pathname.match(/^\/os\/([0-9a-fA-F-]{36})\/?$/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}
