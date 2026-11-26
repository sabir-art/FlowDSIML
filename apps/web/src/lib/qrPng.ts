import { encode } from 'uqr';

/**
 * Retours client, planche 2 : « Télécharger le QR code (PNG) ». QR code du lien en PNG (modules noirs
 * sur fond blanc, marge de 2 modules), 8 px par module, téléchargé sous `nom`.
 */
export async function downloadQrPng(text: string, name: string, scale = 8): Promise<void> {
  const { data, size } = encode(text, { border: 2 });
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#000';
  data.forEach((row, y) => row.forEach((on, x) => on && ctx.fillRect(x * scale, y * scale, scale, scale)));
  const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/png'));
  if (!blob) return;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
