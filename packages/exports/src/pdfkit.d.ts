// PDFKit n'a pas de types : seule la version autonome (navigateur) est importée, typée par pdfTagged.ts
declare module 'pdfkit/js/pdfkit.standalone.js' {
  const PDFDocument: unknown;
  export default PDFDocument;
}
