// SVG ikona iz src/ikone; width/height/aria-hidden kao u PHP funkciji ikona().
const svgovi = import.meta.glob('../ikone/*.svg', { query: '?raw', import: 'default', eager: true });

const izvori = {};
for (const [putanja, tekst] of Object.entries(svgovi)) {
  izvori[putanja.replace(/^.*\/(.*)\.svg$/, '$1')] = tekst;
}

export function ikonaSvg(ime, velicina = 18) {
  const svg = izvori[ime];
  if (!svg) return '';
  return svg.replace(/<svg\b[^>]*>/, (tag) => tag
    .replace(/\s(width|height)="[^"]*"/g, '')
    .replace('<svg', `<svg width="${velicina}" height="${velicina}" aria-hidden="true"`));
}

export default function Ikona({ ime, velicina = 18 }) {
  return <span style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: ikonaSvg(ime, velicina) }} />;
}
