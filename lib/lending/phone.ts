/** Japanese mobile numbers only; shared by the server and native app. */
export function normalizeMobilePhone(input: string, allowFictional = false): string | null {
 const compact=input.trim().replace(/[\s()-]/g,'')
 // NANP 555-0100..0199 is reserved for fiction. Preview test numbers only.
 if(allowFictional&&/^\+165055501\d{2}$/.test(compact))return compact
 if(/^0[789]0\d{8}$/.test(compact))return `+81${compact.slice(1)}`
 if(/^\+81[789]0\d{8}$/.test(compact))return compact
 return null
}
