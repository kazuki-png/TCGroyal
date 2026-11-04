// Printed identifiers, not slab certificate numbers. A promo suffix is part of
// the identity: 150/XY-P must never become a generic search for 150.
export function printedCardNumbers(value:string):string[]{
 const text=value.normalize('NFKC').toUpperCase().replace(/[‐‑–—−]/g,'-').replace(/\s*([\/-])\s*/g,'$1');
 const matches=text.match(/(?<![A-Z0-9])[A-Z]{0,3}\d{1,4}[A-Z]?\/(?:\d{1,4}[A-Z]?|[A-Z]{1,6}-P)(?![A-Z0-9])|\b(?:OP|ST|EB|PRB)\d{2}-\d{3}\b/g)??[];
 return [...new Set(matches)];
}

// A complete modern Japanese promo identifier is stronger era evidence than
// an uncertain visual front-design estimate. A bare number proves no era.
export function hasModernPokemonPromoNumber(value:string):boolean{
 return printedCardNumbers(value).some(number=>/\/(?:ADV|PCG|DP|DPT|BW|XY|SM|S|SV)-P$/.test(number));
}
