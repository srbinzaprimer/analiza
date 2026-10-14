// Čitanje i provera spiska kanala (katalog/kanali.json).

// YouTube @ime: 3–30 znakova, slova, brojevi, _, - i tačka.
const HANDLE = /^@[\p{L}\p{N}_.-]{3,30}$/u;
const JEZIK = /^[a-z]{2,3}$/;

/**
 * @returns {{ handle: string, ime: string | null, jezik: string, titlovi: string[], potvrdjeno: boolean }[]}
 */
export function procitajKanale(sadrzaj) {
  const lista = sadrzaj?.kanali;
  if (!Array.isArray(lista)) {
    throw new Error('katalog/kanali.json mora da ima listu "kanali".');
  }

  const greske = [];
  const vidjeni = new Set();
  const kanali = lista.map((k, i) => {
    const gde = `kanal #${i + 1}`;
    if (typeof k?.handle !== "string" || !HANDLE.test(k.handle)) {
      greske.push(`${gde}: "handle" mora da bude YouTube @ime, npr. "@kanal"`);
    } else if (vidjeni.has(k.handle.toLowerCase())) {
      greske.push(`${gde}: ${k.handle} je naveden dvaput`);
    } else {
      vidjeni.add(k.handle.toLowerCase());
    }
    const jezik = k?.jezik ?? "tr";
    if (!JEZIK.test(jezik)) greske.push(`${gde}: "jezik" mora da bude kod jezika, npr. "tr"`);
    const titlovi = k?.titlovi ?? [];
    if (!Array.isArray(titlovi) || !titlovi.every((t) => JEZIK.test(t))) {
      greske.push(`${gde}: "titlovi" mora da bude lista kodova jezika, npr. ["en"]`);
    }
    if (k?.potvrdjeno !== undefined && typeof k.potvrdjeno !== "boolean") {
      greske.push(`${gde}: "potvrdjeno" mora da bude true ili false`);
    }
    return {
      handle: k?.handle,
      ime: typeof k?.ime === "string" ? k.ime : null,
      jezik,
      titlovi,
      potvrdjeno: k?.potvrdjeno === true,
    };
  });

  if (greske.length > 0) {
    throw new Error(`Greške u katalog/kanali.json:\n- ${greske.join("\n- ")}`);
  }
  return kanali;
}
