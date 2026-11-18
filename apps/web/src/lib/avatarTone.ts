/** Couleur d'avatar stable par membre, prise dans chart-1…chart-5. */
export function avatarTone(id: string) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return (h % 5) + 1;
}
