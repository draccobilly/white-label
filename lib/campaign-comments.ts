export const NEW_ACTIVITY_MS = 8 * 60 * 60 * 1000;

function wordSet(words: string) {
  return new Set(
    words
      .split(/\s+/)
      .map((word) => word.trim().toLowerCase())
      .filter(Boolean),
  );
}

const TITLE_STOP = wordSet(`
  a al ayuda ayudar build construir de del el for help la las los my para por su the to un una y
`);

/**
 * Words that show up capitalized in campaign titles but are never the person
 * the campaign is for: Title Case, slogans, body parts, illnesses, places,
 * and the nouns an NGO uses for its own work. One lowercase list per language.
 */
const COMMON_TITLE_WORDS_EN = `
  able about above access across act action actions after again against all almost alone along already
  also always american amid among angels animal animals another any anyone anything appeal arm arms around
  as ask asking at autism away babies baby back bad basic battle be beat beautiful because become bed been
  before behind being believe below best better between beyond bible big birth blanket blankets bless
  blessed blessing blessings blind boy boys brave bread break bring bringing broken brother brothers but by
  call called can cancer care cared caring case cat cats chance change changing chemo child childhood
  children christmas church city clean clinic clothes clothing coats cold come coming community cost costs
  could courage cure daily dark daughter daughters day days deaf dear deserve deserves dialysis diabetes did
  die dignity disabled disaster doctor doctors does dog dogs doing done down dream dreams drive during each
  early earthquake education elderly emergency end ending enough equipment even ever everyone everything eyes
  face families family far farm fast feed feeding feet few fight fighter fighting final finally find fire
  first fix flood floods food foot forgotten forward foundation free freedom fresh friend friends full fund
  funds future gear generous gentle get getting girl girls give giving go god goes going golden gone good
  great group grow had half hand hands happy hard has have having he heal healing health healthy hear
  hearing heart hearts heat heaven heavy held hello hero heroes hidden high him his hit holiday holidays
  home homeless homes honor hoping hospital hot hour hours house houses how humble hunger hungry hurricane
  hurt if ill immigrant immigrants important in independence injured inside into is it its job jobs
  journey just keep keeping kid kids kind kindness kit kits know last late learn learning leave left leg
  legs less let lets letter life lift light like little live lives living local lonely long look looking
  lord loss lost lot love loved loving low made man many may me meal meals means medical medicine
  medicines meet member members memory men might mind miracle mission missionaries missionary moment money
  month months more morning most mothers move moving much must national near need needed needing needs
  neighbor neighbors never new next night nights no nobody not nothing now nurse nutrition of off old on
  once one only open operation or orphan orphans other others our ours out over own pain parents part
  pastor path patient patients pay people place plan plant please poor possible power pray prayer prayers
  praying precious premature pressure program project prosthesis prosthetics protect protection proud
  provide public put quick quiet raise raising reach read ready real rebuild rebuilding recover recovery
  relief rent repair rescue rescued rest return rights rise rising risk road rock roof room rural sad safe
  safety said same save saved saving say school schools second see seed senior seniors serious set several
  shelter shoes short should sick side simple since single sister sisters sit sleep small smile so social
  some someone something soon sos soul special spirit stand standing start starting state stay step still
  stop storm story street streets strength strong struggle struggling student students study such suffering
  supplies support surgery survive survivor survivors sweet take taking teacher teachers team teen teens
  than thank thanks that the their them then there these they thing things think this those though three
  through time times tiny to today together tomorrow too took toward town toys transplant treat treatment
  tree trip true truly try trying turn twins two under until up upon urgent us use used van very victim
  victims village violence vision voice volunteer volunteers wait waiting walk walking want wants war warm
  warmth warrior warriors was water way we week weeks welcome well went were what wheelchair when where
  which while who whole why widow wife will win winter wish with within without woman women wonderful work
  worker workers working works world worth would year years yes yet you young your youth
`;

const COMMON_TITLE_WORDS_ES = `
  abajo abandonada abandonadas abandonado abandonados abrigo abuela abuelo abuelos acceso accidente
  adelante adulto adultos agua ahora al alegría algo alguien allí amiga amigas amigo amigos amor anciana
  anciano ancianos ángeles angeles animales año años apoya apoyar apoyemos apoyo aquí arriba así atención
  aún ayúdame ayúdanos ayudar ayudemos bajo barrio bebé bebés bendice bendición bendiciones bien bienestar
  biblia brazo brazos buena buenas bueno buenos cada calle calles cama cáncer cancer cariño casa casas caso
  causa centro cerca chica chicas chico chicos cinco cirugía cirugia ciudad clínica clinica colegio comedor
  comida comunidad con construir contigo contra corazón corazones cosas cristo cuando cuánto cuatro cuerpo
  cuidado cuidar dar de debajo dejar dejemos del dentro derecho derechos desde después día días diabetes
  diálisis dignidad dios discapacidad doctor doctora dolor dona donar donativo donemos dónde dos edad el él
  ella ellas ellos emergencia en encima enferma enfermedad enfermera enfermo enfermos entre equipo era es
  esa ese eso esta estamos están estas este esto estos estoy escuela esperamos esperando familia familias
  frío fuego fuerte fuerza fundación fundacion futuro gente gracias grande grandes grupo guerra hace hacer
  hacia hambre hasta hay hermana hermanas hermano hermanos hija hijas hijo hijos historia hogar hombre
  hombres hospital hoy huérfana huérfano huérfanos humilde humildes iglesia igual incendio invierno ir joven
  jóvenes juguetes juntas juntos la las le ley libertad libre lindo lo los lucha luchando luchar lugar madre
  madres mal mamá mamás mano manos mañana más médica médico medicina medicinas mejor menos mes meses mi
  mientras milagro mío mis misión mision misionero misioneros mismo mucho muchos mujer mujeres mundo muy
  nada nadie navidad necesidad necesita necesitamos necesitan niña niñas niño niños no noche noches nos
  nosotros nuestra nuestras nuestro nuestros nueva nuevas nuevo nuevos nunca o operación operacion oración
  oraciones oremos orfanato otra otras otro otros padre padres país pan papá papás para parte pastor pastora
  pequeña pequeñas pequeño pequeños perdió perro perros persona personas pie pierna piernas pies pobre
  pobres poco podemos poder por porque primera primero prótesis protesis proyecto pueblo puede pueden pues
  que qué quien quién quiere quieren quimio reconstrucción reconstruir recuperación recuperar refugio
  regalo regalos rehabilitación rescate ropa rueda ruedas sala salud salvar salvemos san santa santo se sé
  según segunda segundo seguir semana semanas señor señora ser si sí siempre siguen silla sillas sin sobre
  sola solas solo solos somos son soy su sueño sueños sus techo tiempo tiene tienen tierra toda todas todo
  todos trabajar trabajo tratamiento tres triste tu tú tus última último un una unas unidas unidos unos
  urgente usted ustedes vamos vez vida vidas vieja viejo vive viven vivienda vivir volver voz y ya yo
`;

const COMMON_TITLE_WORDS_PT = `
  abrigo acesso acidente adiante água agora ainda ajuda ajudar ajude ajudem alegria algo alguém ali amanhã
  amiga amigas amigo amigos amor anjo anjos animais ano anos apoie apoio aqui as assim atenção bairro bebê
  bebês bem bênção bênçãos bíblia boa boas bom bons braço braços brinquedos cachorro cachorros cada cadeira
  cama câncer carinho casa casas caso causa cega cego centro céu chance chegar cidade cinco cirurgia
  clínica coisas colégio com comida comunidade construir contigo contra coração corações corpo criança
  crianças cuidado cuidar da dar das de debaixo deficiência deixar dentro depois desde deus dia dias diabete
  diálise dignidade do doação doações doar doe doente doentes dois dor duas é e ela elas ele eles em
  emergência enfermeira enquanto entre equipe escola esperando essa esse esta estamos estão estas este estes
  estou eu família famílias fé fogo fome força forte fundação futuro gente grande grandes grupo guerra hoje
  homem homens hospital humilde humildes igreja igual incêndio inverno ir isso isto já jovem jovens juntas
  juntos lá lar lei liberdade lindo livre lugar luta lutando lutar mãe mães mais mal mamãe mão mãos médica
  médico medicina melhor menina meninas menino meninos menos mês meses mesmo meu meus milagre minha minhas
  missão missionário missionários moradia muito muitos mulher mulheres mundo na nada não nas natal
  necessidade ninguém no noite noites nos nós nossa nossas nosso nossos nova novas novo novos nunca o
  operação oração orações oremos orfanato os outra outras outro outros pai pais país pão papai para parte
  pastor pastora pé pequena pequenas pequeno pequenos perdeu perna pernas pés pessoa pessoas pobre pobres
  pode podem podemos poder pois por porque pouco povo precisa precisam precisamos presente presentes
  primeira primeiro projeto prótese quando quanto quatro que quem quer querem quimio reabilitação
  reconstrução reconstruir recuperação recuperar refúgio remédio remédios resgate roda rodas roupa rua ruas
  sala salvar são saúde se seguem seguir segunda segundo sei sem semana semanas sempre senhor senhora ser
  seu seus sim sobre somos sonho sonhos sou sozinha sozinhas sozinho sozinhos sua suas também tem têm tempo
  terra teto teu toda todas todo todos trabalhar trabalho tratamento três triste tu tua tudo última último
  um uma umas uns unidas unidos urgente vamos velha velho vez vida vidas vive vivem viver você vocês volta
  voltar voz
`;

const PLACE_WORDS = `
  acworth africa áfrica amazonas amazônia america américa angeles argentina asia ásia atlanta bahia bogotá
  bolivia bolívia boston brasil brazil california califórnia caracas chiapas chicago chile colombia
  colômbia cuba dallas dominicana ecuador eeuu equador eua europa europe favela filipinas florida gaza
  gerais goiás guadalajara guatemala habana haiti haití havana honduras houston india índia jalisco jersey
  juárez kenya lima managua mexico méxico miami minas monterrey nicaragua nordeste oaxaca panama panamá
  paraguai paraguay paulista peru perú philippines puebla puerto quênia quito rico rio sao são selva sertão
  sinaloa sonora tegucigalpa texas tijuana ucrania ucrânia uganda ukraine uruguai uruguay usa vegas
  venezuela veracruz york yucatán
`;

const SUBJECT_STOP = new Set<string>([
  ...TITLE_STOP,
  ...wordSet(`
    after ahora and apoyo arc before campaign campaña care causa cause change changes compassion
    difference diferencia difficult donate donated donation donations donar donativo devoted every familia
    family from fund fundraiser get gift gifts give giving gracias gratitude hearts here home hoy human
    impact join juntos keep kindness life lives love make need needs now our people person please return
    safe saving share sharing son story support supporting thank thanks this that time today together
    treatment urgent welcome with working your
  `),
  ...wordSet(COMMON_TITLE_WORDS_EN),
  ...wordSet(COMMON_TITLE_WORDS_ES),
  ...wordSet(COMMON_TITLE_WORDS_PT),
  ...wordSet(PLACE_WORDS),
]);

/**
 * Family nouns. "my father" becomes the subject "Father" on purpose, so these
 * stay out of the hard list, but a bare "Mom" or "Padre" in a title is not a name.
 */
const RELATION_WORDS = wordSet(`
  father mother mom dad mommy daddy papa mama grandma grandpa grandmother grandfather nana
`);

/**
 * Nouns that are also first names. "Help Hope walk again" names a person;
 * "Hope Rising" does not. They count after an explicit lead-in (Help, Ayuda a,
 * for, para) and are refused when the only evidence is a capital letter.
 */
const AMBIGUOUS_NAMES = wordSet(`
  angel ángel hope faith grace joy mercy summer dawn rose lily victor christian georgia virginia carolina
  orlando salvador israel jordan linda bella bela alma cielo luna luz sol paz cruz flor flores blanca gloria
  glória graça esperanza esperança consuelo dolores mercedes rosario socorro soledad pilar milagros caridad
  trinidad concepción asunción reyes santos nieves lucero estrella victoria vitória jesus jesús
`);

/** A capitalized word right after one of these belongs to a place or an organization. */
const PROPER_NOUN_PREFIX = wordSet(`
  san santa santo são sao saint st puerto porto rio río new nueva nuevo north south east west lake mount
  monte fort las los el la villa ciudad cidade costa isla ilha cabo sierra serra valle vale barrio bairro
  colonia comunidad comunidade iglesia igreja escuela escola colegio colégio fundación fundacion fundação
  casa hogar lar proyecto projeto misión mision missão operación operacion operação hospital clínica
  clinica centro school church foundation project mission operation house center centre clinic ministerio
  ministry ministério asociación asociacion associação association instituto institute club radio
`);

/** Determiners and prepositions. A capitalized word after one of these is a thing or a place. */
const NOT_A_PERSON_AFTER = wordSet(`
  the these those this that a an el la los las un una unos unas o os as um uma uns umas in at on into en
  al del do da dos das no na nos nas his her their our your my its su sus mi mis seu sua seus suas nosso
  nossa nossos nossas every each cada toda todo todas todos
`);

/** Skipped between a lead-in and the name: "Help Baby Mateo", "para Doña Rosa", "Help Little Maria". */
const HONORIFICS = wordSet(`
  don doña dona seu sr sra srta mr mrs ms miss dr dra pastor pastora hermano hermana irmão irmã brother
  sister padre madre father mother tía tío tia tio aunt uncle abuela abuelo vovó vovô grandma grandpa little
  baby pequeño pequeña pequeno pequena bebé bebê niño niña menino menina
`);

const SPANISH_HELP_VERBS = wordSet(`
  ayuda ayudar ayudemos ayúdanos ayúdame apoya apoyar apoyemos ajude ajudem ajudar
`);

/** After these the next capitalized word is almost always the person. */
const STRONG_LEAD_WORDS = new Set<string>([...SPANISH_HELP_VERBS, ...wordSet("help for para por")]);

/** After these a capitalized word is usually a person, unless it is also a common noun. */
const WEAK_LEAD_WORDS = wordSet("de with con com");

const POSSESSIVES = wordSet("my mi our nuestro nuestra his her su their sus meu minha nosso nossa");

const RELATION_NOUNS = wordSet(`
  father mother dad mom son daughter brother sister husband wife baby grandmother grandfather grandma
  grandpa padre madre papá papa mamá mama hijo hija hermano hermana esposo esposa bebé bebe abuelo abuela
  pai mãe mae filho filha irmão irmã marido avô avó vovó vovô
`);

const CONJUNCTIONS = wordSet("and y e &");

/** Verbs that follow a person's name: "Lucas needs", "Maria Silva necesita", "Goyito Crawls". */
const SUBJECT_VERBS = wordSet(`
  needs need is was has had wants wanted can cannot could will would fights fought battles lost survived
  survives lives lived works worked crawls walks waits hopes struggles suffers faces keeps continues returns
  deserves dreams beat beats wins won asks asked gets got goes went comes came stays tries cries smiles
  turns turned
  necesita necesitan necesitaba es era está estaba tiene tenía quiere quería puede podía lucha luchó
  perdió vive vivía trabaja sueña merece sobrevive sufre pide busca espera sigue volverá regresa camina
  cumple enfrenta pelea ganó venció recibe recibió
  precisa precisava é está estava tem tinha quer queria pode podia luta lutou perdeu mora morava trabalha
  sonha sofre pede continua voltará volta caminha venceu recebe recebeu vai
`);

const COMMON_WORD_SUFFIXES = [
  "ing",
  "tion",
  "sion",
  "ción",
  "sión",
  "ção",
  "ções",
  "ment",
  "mento",
  "miento",
  "ness",
  "ity",
  "ship",
  "hood",
  "ful",
  "less",
  "ous",
  "able",
  "ible",
  "ería",
  "ismo",
  "ism",
  "ology",
  "ología",
  "ologia",
];

const GENERIC_COMMENT_BODIES = new Set([
  "I saw how many people already stepped in and I didn’t want to scroll past.",
  "Even a small gift feels better than doing nothing. Hoping this helps today.",
  "This story stayed with me. Grateful there is a direct way to help.",
  "Praying for strength and a safer next chapter for this family.",
  "I donated because the need is practical, not abstract. Use it well.",
  "I just wanted to add my share while others are giving.",
  "Reading the updates made this real. Sending love and a contribution.",
  "May this cover one more bill, one more meal, one more day of relief.",
  "I can’t do much, but I can do this. Hold on.",
  "So many people giving at once made me trust this was worth joining.",
  "Wishing dignity, rest, and better days ahead.",
  "This is the kind of help I hope someone would offer my family too.",
  "Thank you for making the need clear. I gave what I could.",
  "Keep going. You are not carrying this alone anymore.",
  "I almost closed the page, then saw others donating. That decided it.",
  "Hope this little bit takes some pressure off tonight.",
  "Sending care from far away. Please use this for the most urgent need.",
  "The details here felt honest. That’s why I gave.",
  "May every gift stacked here become real safety.",
  "This family deserves a break. Glad to be one of the people showing up.",
  "If everyone waiting gives a little, this actually moves. That’s why I’m here.",
  "Thinking of you and choosing to help in a concrete way.",
  "I donated because medical and housing costs shouldn’t be faced alone.",
  "Small gift, full heart. Please keep us posted if you can.",
  "The number of supporters made me feel this would actually reach them.",
  "I wanted a note here so others keep going too.",
  "This is for the next appointment, the next meal, the next safe night.",
  "You asked for help and people are answering. I’m one of them.",
  "Grateful I could join the others instead of just wishing you well.",
  "Vi cuánta gente ya se sumó y no quise seguir de largo.",
  "Aunque sea poquito, es mejor que no hacer nada. Ojalá ayude hoy.",
  "Esta historia se me quedó. Qué bueno que hay una forma directa de ayudar.",
  "Rezando por fuerza y un capítulo más seguro para esta familia.",
  "Doné porque la necesidad es concreta, no abstracta. Úsenlo bien.",
  "Solo quería poner mi parte mientras otros también dan.",
  "Leer las actualizaciones lo hizo real. Envío cariño y un donativo.",
  "Que esto cubra una cuenta más, una comida más, un día más de alivio.",
  "No puedo hacer mucho, pero sí puedo hacer esto. Aguanten.",
  "Ver a tanta gente donando al mismo tiempo me hizo confiar.",
  "Les deseo dignidad, descanso y días mejores.",
  "Este es el tipo de ayuda que yo esperaría para mi familia.",
  "Gracias por dejar clara la necesidad. Di lo que pude.",
  "Sigan. Ya no cargan esto solos.",
  "Casi cerré la página, luego vi que otros estaban donando. Ahí me decidí.",
  "Ojalá este poquito quite un poco de presión esta noche.",
  "Mando apoyo desde lejos. Úsenlo en lo más urgente.",
  "Los detalles se sintieron honestos. Por eso doné.",
  "Que cada donativo de aquí se vuelva seguridad de verdad.",
  "Esta familia merece un respiro. Me da gusto ser de las personas que se aparecen.",
]);

/**
 * Several short noun phrases per situation. A campaign matches more than one,
 * and each comment cites a different phrase. One keyword must not become the
 * same clause in every note.
 */
const SITUATIONS: Array<{ test: RegExp; en: string[]; es: string[] }> = [
  {
    test: /blanket|socks?|thermal|beanie|gloves?|jacket|winter clothing|abrigo|cobija|frazada|calcet/i,
    en: ["a warm blanket and socks", "a jacket, a hat, and gloves", "clothes that keep the cold out"],
    es: ["una cobija y calcetines calientes", "una chaqueta, un gorro y guantes", "ropa que de verdad tape el frío"],
  },
  {
    test: /meal|food|nutrition|hungry|comida|alimento|hambre/i,
    en: ["a hot meal", "food for the next few days"],
    es: ["una comida caliente", "comida para los próximos días"],
  },
  {
    test: /shelter|housing|homeless|safer place|place to live|refugio|vivienda|albergue/i,
    en: ["temporary shelter", "a safe place to sleep"],
    es: ["un refugio temporal", "un lugar seguro para dormir"],
  },
  {
    test: /streets?|calle|callej|homeless/i,
    en: ["a night off the street", "somewhere to sleep that isn't the sidewalk"],
    es: ["una noche fuera de la calle", "un lugar para dormir que no sea la banqueta"],
  },
  {
    test: /cold|winter|freezing|frío|invierno/i,
    en: ["getting through a freezing night", "warmth on a cold night"],
    es: ["pasar una noche de frío", "calor en una noche helada"],
  },
  {
    test: /child|children|hijos|niñ/i,
    en: ["the children in this story", "a child who is out in this weather", "what these kids need tonight"],
    es: ["los niños de esta historia", "un niño que está a la intemperie", "lo que estos niños necesitan hoy"],
  },
  {
    test: /wheelchair|silla de ruedas/i,
    en: ["a real wheelchair", "moving without having to crawl"],
    es: ["una silla de ruedas de verdad", "moverse sin tener que arrastrarse"],
  },
  {
    test: /prótesis|prosthe/i,
    en: ["a prosthesis", "the chance to walk again"],
    es: ["una prótesis", "la posibilidad de volver a caminar"],
  },
  {
    test: /medicine|medicina|hospital|terapi|surgery|cirug/i,
    en: ["medicine and a doctor", "the next treatment"],
    es: ["medicinas y un médico", "el siguiente tratamiento"],
  },
  {
    test: /hearing|auditiv|\boír\b/i,
    en: ["hearing again", "care for someone who can't hear"],
    es: ["volver a oír", "atención para quien ya no oye"],
  },
  {
    test: /brick|ladrillo/i,
    en: ["a day that isn't spent making bricks to survive"],
    es: ["un día que no sea haciendo ladrillos para sobrevivir"],
  },
  {
    test: /mother|father|mamá|madre|papá|padre/i,
    en: ["a parent who is still holding the family together", "the family in this story"],
    es: ["un padre o una madre que sigue sosteniendo a la familia", "la familia de esta historia"],
  },
];

/** Clauses the old templates stamped onto every comment. One hit means rewrite. */
const STAMPED_CLAUSES = [
  "keep her children safe and cared for",
  "cuidar a sus hijos con lo que realmente necesitan",
  "cover the most urgent part of this story",
  "cubrir lo más urgente de esta historia",
  "the most urgent need",
  "lo más urgente",
  "cover medicine and medical care",
  "cubrir medicinas y atención médica",
  "get a safer place to live",
  "tener un lugar más seguro para vivir",
  "keep caring for family without collapsing",
  "seguir cuidando a su familia sin derrumbarse",
  "get a real wheelchair",
  "conseguir una silla de ruedas de verdad",
  "get a prosthesis and walk again",
  "help mom hear again",
  "not have to make bricks just to survive",
];

export type CampaignCommentSource = {
  title: string;
  summary?: string | null;
  story?: string | null;
  organizerName?: string | null;
  currency?: string | null;
};

export function utcDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function normalizeSubjectToken(word: string) {
  return word
    .replace(/^[^\p{L}]+/u, "")
    .replace(/['’].*$/u, "")
    .replace(/[^\p{L}]+$/u, "");
}

function hasCommonWordSuffix(token: string) {
  const lower = token.toLowerCase();
  return COMMON_WORD_SUFFIXES.some(
    (suffix) => lower.endsWith(suffix) && lower.length - suffix.length >= 2,
  );
}

/**
 * True when the word can never be the person a campaign is for, judged on the
 * word alone. Everything `extractCampaignSubject` returns passes this check,
 * which is what lets `commentUsesRejectedSubject` spot stale seeded comments.
 */
export function isRejectedCampaignSubject(word: string | null | undefined) {
  if (!word) return true;
  const token = normalizeSubjectToken(word);
  if (token.length < 3 || token.length > 18) return true;
  if (!/^\p{Lu}/u.test(token)) return true;
  if (SUBJECT_STOP.has(token.toLowerCase())) return true;
  return hasCommonWordSuffix(token);
}

/** "Little" in the title and "little feet" in the story: a common word, not a name. */
function usedAsCommonWord(token: string, corpus: string) {
  if (!corpus) return false;
  const lower = token.toLowerCase();
  if (lower === token) return false;
  const escaped = lower.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<!\\p{L})${escaped}(?!\\p{L})`, "u").test(corpus);
}

type Token = {
  raw: string;
  word: string;
  lower: string;
  capitalized: boolean;
};

function tokenize(text: string): Token[] {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((raw) => {
      const word = normalizeSubjectToken(raw);
      return {
        raw,
        word,
        lower: word.toLowerCase(),
        capitalized: /^\p{Lu}/u.test(word),
      };
    });
}

function presentName(word: string) {
  if (word.length >= 4 && word === word.toUpperCase()) {
    return word.charAt(0) + word.slice(1).toLowerCase();
  }
  return word;
}

type CandidateOptions = {
  /** Refuse nouns that are also names; only a capital letter backs this word. */
  strict: boolean;
  corpus: string;
  /** Look at the previous word for a determiner or a place/organization prefix. */
  gate: boolean;
};

function candidateAt(tokens: Token[], index: number, options: CandidateOptions) {
  const token = tokens[index];
  if (!token || !token.capitalized) return null;
  if (isRejectedCampaignSubject(token.word)) return null;
  if (RELATION_WORDS.has(token.lower)) return null;
  if (options.strict && AMBIGUOUS_NAMES.has(token.lower)) return null;
  if (usedAsCommonWord(token.word, options.corpus)) return null;
  if (options.gate) {
    const previous = tokens[index - 1];
    if (previous) {
      if (NOT_A_PERSON_AFTER.has(previous.lower)) return null;
      if (previous.capitalized && PROPER_NOUN_PREFIX.has(previous.lower)) return null;
    }
  }
  return presentName(token.word);
}

/**
 * Title Case titles capitalize every noun, so a capital letter there says
 * nothing. Only explicit patterns count for them.
 */
function isTitleCased(tokens: Token[]) {
  const counted = tokens.slice(1).filter((token) => token.word.length >= 4);
  const capitalized = counted.filter((token) => token.capitalized).length;
  return capitalized >= 3 && capitalized * 2 >= counted.length;
}

function relationSubject(text: string) {
  const match = text.match(
    /\b(?:my|mi)\s+(father|mother|dad|mom|son|daughter|padre|madre|hijo|hija)\b/i,
  );
  if (!match?.[1]) return null;
  const word = match[1].toLowerCase();
  if (word === "father" || word === "dad" || word === "padre") return "Father";
  if (word === "mother" || word === "mom" || word === "madre") return "Mother";
  if (word === "son" || word === "hijo") return "son";
  if (word === "daughter" || word === "hija") return "daughter";
  return null;
}

function firstViableName(text: string, corpus: string) {
  const tokens = tokenize(text);
  if (!tokens.length) return null;

  // "Jonatan, 34 years old" / "Rosa: una madre que no se rinde"
  const first = tokens[0]!;
  const second = tokens[1];
  if (/[,:;]$/.test(first.raw) || (second && /^[-–—|:]$/.test(second.raw))) {
    const found = candidateAt(tokens, 0, { strict: false, corpus, gate: false });
    if (found) return found;
  }

  // "Help X", "Ayuda a X", "for X", "para X", "de X", "with X"
  for (let index = 0; index < tokens.length - 1; index += 1) {
    const lower = tokens[index]!.lower;
    const strong = STRONG_LEAD_WORDS.has(lower);
    if (!strong && !WEAK_LEAD_WORDS.has(lower)) continue;
    let next = index + 1;
    if (SPANISH_HELP_VERBS.has(lower) && tokens[next]?.lower === "a") next += 1;
    while (tokens[next] && HONORIFICS.has(tokens[next]!.lower)) next += 1;
    const found = candidateAt(tokens, next, { strict: !strong, corpus, gate: false });
    if (found) return found;
  }

  // "my son Lucas", "mi hija Sofía"
  for (let index = 0; index + 2 < tokens.length; index += 1) {
    if (!POSSESSIVES.has(tokens[index]!.lower)) continue;
    if (!RELATION_NOUNS.has(tokens[index + 1]!.lower)) continue;
    const found = candidateAt(tokens, index + 2, { strict: false, corpus, gate: false });
    if (found) return found;
  }

  // "Lucas needs", "Maria Silva necesita", "Goyito Crawls"
  for (let index = 0; index < tokens.length; index += 1) {
    const found = candidateAt(tokens, index, { strict: true, corpus, gate: true });
    if (!found) continue;
    for (let look = index + 1; look < tokens.length && look <= index + 3; look += 1) {
      const next = tokens[look]!;
      if (SUBJECT_VERBS.has(next.lower)) return found;
      const surname = next.capitalized && !isRejectedCampaignSubject(next.word);
      if (!surname) break;
    }
  }

  // "Martha and Alberto"
  for (let index = 0; index + 2 < tokens.length; index += 1) {
    if (!CONJUNCTIONS.has(tokens[index + 1]!.lower)) continue;
    const found = candidateAt(tokens, index, { strict: true, corpus, gate: true });
    if (!found) continue;
    const partner = candidateAt(tokens, index + 2, { strict: true, corpus, gate: false });
    if (partner) return found;
  }

  // "Cecilia's dream"
  for (let index = 0; index < tokens.length; index += 1) {
    if (!/^\p{Lu}[\p{L}-]+(?:'s|’s)(?!\p{L})/u.test(tokens[index]!.raw)) continue;
    const found = candidateAt(tokens, index, { strict: true, corpus, gate: true });
    if (found) return found;
  }

  const relation = relationSubject(text);
  if (relation) return relation;

  // Weakest evidence: a capital letter inside a sentence-cased title.
  if (isTitleCased(tokens)) return null;
  for (let index = 0; index < tokens.length; index += 1) {
    const found = candidateAt(tokens, index, { strict: true, corpus, gate: true });
    if (found) return found;
  }
  return null;
}

const INTRO_PATTERN =
  /(?:[Mm]y name is|[Mm]e llamo|[Mm]e chamo|[Ii] am|[Ii][’']m|[Ss]oy|[Ee]u sou|[Ss]e llama|[Ss]e chama|[Nn]amed|[Ll]lamad[oa]|[Cc]hamad[oa])\s+(\p{Lu}[\p{L}'’-]+)/gu;

function organizerSubject(organizerName: string | null | undefined, corpus: string) {
  const tokens = tokenize((organizerName ?? "").trim());
  let index = 0;
  while (tokens[index] && HONORIFICS.has(tokens[index]!.lower)) index += 1;
  return candidateAt(tokens, index, { strict: true, corpus, gate: false });
}

export function extractCampaignSubject(
  title: string,
  organizerName?: string | null,
  extraText?: string | null,
) {
  const text = title.trim().replace(/\s+/g, " ");
  const extra = (extraText ?? "").trim();
  const corpus = `${text}\n${extra}`;

  const fromTitle = firstViableName(text, corpus);
  if (fromTitle) return fromTitle;

  if (extra) {
    for (const match of extra.matchAll(INTRO_PATTERN)) {
      const intro = tokenize(match[1] ?? "");
      const found = candidateAt(intro, 0, { strict: true, corpus, gate: false });
      if (found) return found;
    }
  }

  return organizerSubject(organizerName, corpus);
}

/**
 * True when a seeded comment names a subject the extractor would refuse today.
 * The lead words cover every named template in English and Spanish.
 */
export function commentUsesRejectedSubject(body: string) {
  const patterns = [
    /(?:\b(?:so|for|of|por|with|about|until|help|en|con|de|para|que|hasta)|Fuerza,)\s+(\p{Lu}[\p{L}'’-]+)/gu,
    /(\p{Lu}[\p{L}'’-]+)(?:’s|'s) story/gu,
    /(\p{Lu}[\p{L}'’-]+)\s+(?:should(?:n’t|n't)|no debería|no tiene|pueda)\b/gu,
  ];
  return patterns.some((pattern) =>
    [...body.matchAll(pattern)].some((match) =>
      isRejectedCampaignSubject(match[1]),
    ),
  );
}

function clipDetail(raw: string) {
  let text = raw.replace(/\*\*/g, " ").replace(/\s+/g, " ").trim();
  text = text.replace(
    /^(?:provides|delivers|includes|feeds(?: and protects)?|funds|covers|guarantees|proporciona|entrega|incluye|financia|cubre)\s*:?\s*/i,
    "",
  );
  const cut = text.split(/\s+(?:to|for|so|during|alongside|para|durante)\s+/i)[0] ?? text;
  text = cut
    .replace(/^(?:\d+\s+)+/, "")
    .replace(/^(?:a|an|the|un|una|el|la)\s+/i, "")
    .replace(/[,:;.\s]+$/g, "")
    .trim();
  if (text.length > 78) text = text.slice(0, 78).replace(/\s+\S*$/, "");
  if (text.length < 10 || !/[a-záéíóúñ]{4,}/i.test(text)) return null;
  return text.charAt(0).toLowerCase() + text.slice(1);
}

/** Concrete gifts named in the story, such as a kit line: "Provides a thermal blanket...". */
function tierDetails(text: string) {
  const details: string[] = [];
  const pattern =
    /(?:provides|delivers|includes|feeds(?: and protects)?|funds|covers|proporciona|entrega|incluye|financia|cubre)\s*:?\s*([^.\n]{12,160})/gi;
  for (const match of text.matchAll(pattern)) {
    const detail = clipDetail(match[1] ?? "");
    if (detail && !details.includes(detail)) details.push(detail);
    if (details.length >= 4) break;
  }
  return details;
}

/**
 * Up to six different things this campaign is actually about. Tier lines from
 * the story come first, then a few short phrases for each situation that matches.
 */
function alreadyCovered(details: string[], phrases: string[]) {
  const haystack = details.join(" ").toLowerCase();
  return phrases.some((phrase) => {
    const word = phrase
      .toLowerCase()
      .split(/\s+/)
      .find((part) => part.length > 4 && !/^(about|after|again|their|these|there|where|which|would|could|should)$/.test(part));
    return Boolean(word && haystack.includes(word));
  });
}

export function campaignDetails(source: CampaignCommentSource, spanish: boolean) {
  const text = `${source.title}\n${source.summary ?? ""}\n${source.story ?? ""}`;
  const details = tierDetails(text).slice(0, 3);
  for (const situation of SITUATIONS) {
    if (details.length >= 6) break;
    if (!situation.test.test(text)) continue;
    const phrases = spanish ? situation.es : situation.en;
    if (alreadyCovered(details, phrases)) continue;
    const phrase = phrases.find((item) => !details.includes(item));
    if (phrase) details.push(phrase);
  }
  return details.slice(0, 6);
}

export function campaignNeeds(source: CampaignCommentSource, spanish: boolean) {
  return campaignDetails(source, spanish);
}

export function commentUsesStampedClause(body: string) {
  const text = body.toLowerCase();
  return STAMPED_CLAUSES.some((clause) => text.includes(clause));
}

/**
 * True when the same five-word run shows up in at least half the notes.
 * That is the "every comment says the same thing" failure.
 */
export function commentsStampOnePhrase(bodies: string[]) {
  const usable = bodies.map((body) => body.trim()).filter((body) => body.length > 40);
  if (usable.length < 4) return false;
  const counts = new Map<string, number>();
  for (const body of usable) {
    const words = body
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((word) => word.length > 2);
    const seen = new Set<string>();
    for (let index = 0; index + 5 <= words.length; index += 1) {
      const gram = words.slice(index, index + 5).join(" ");
      if (seen.has(gram)) continue;
      seen.add(gram);
      counts.set(gram, (counts.get(gram) ?? 0) + 1);
    }
  }
  const threshold = Math.max(4, Math.ceil(usable.length * 0.5));
  for (const count of counts.values()) {
    if (count >= threshold) return true;
  }
  return false;
}

export function isGenericSocialComment(body: string) {
  return GENERIC_COMMENT_BODIES.has(body.trim());
}

export function isNewActivity(iso: string | null | undefined, now = Date.now()) {
  if (!iso) return false;
  const stamp = new Date(iso).getTime();
  return Number.isFinite(stamp) && now - stamp >= 0 && now - stamp < NEW_ACTIVITY_MS;
}

export function withoutAiDashes(value: string) {
  return value
    .replaceAll("—", ",")
    .replaceAll("–", ",")
    .replaceAll("---", ",")
    .replaceAll("--", ",")
    .replace(/,\s*,/g, ",")
    .replace(/\s+,/g, ",")
    .replace(/,\s+/g, ", ")
    .trim();
}

function sentence(value: string) {
  return withoutAiDashes(value);
}

const COMMENT_FRAMES_EN = [
  (detail: string) => `The part about ${detail} is what made me donate.`,
  (detail: string) => `I gave toward ${detail}. That's specific enough for me.`,
  (detail: string) => `Read about ${detail} and couldn't scroll past.`,
  (detail: string) => `Small gift. Please use it for ${detail}.`,
  (detail: string) => `I kept coming back to ${detail}. So I gave.`,
  (detail: string) => `Hoping this shows up as ${detail} for someone tonight.`,
  (detail: string) => `Added mine because ${detail} shouldn't have to wait.`,
  (detail: string) => `Not a vague appeal. My gift is for ${detail}.`,
];

const COMMENT_FRAMES_ES = [
  (detail: string) => `La parte de ${detail} fue lo que me decidió a donar.`,
  (detail: string) => `Doné para ${detail}. Eso ya es concreto.`,
  (detail: string) => `Leí lo de ${detail} y no pude seguir de largo.`,
  (detail: string) => `Un donativo chico. Úsenlo para ${detail}.`,
  (detail: string) => `Me quedé pensando en ${detail}. Por eso doné.`,
  (detail: string) => `Ojalá esto se vuelva ${detail} para alguien hoy.`,
  (detail: string) => `Puse mi parte porque ${detail} no debería esperar.`,
  (detail: string) => `No es un llamado vago. Mi donativo es para ${detail}.`,
];

const NAMED_FRAMES_EN = [
  (detail: string, name: string) => `I donated so ${name} can have ${detail}.`,
  (detail: string, name: string) => `Thinking of ${name} today. My gift is for ${detail}.`,
  (detail: string, name: string) => `The part about ${detail} is why I gave for ${name}.`,
];

const NAMED_FRAMES_ES = [
  (detail: string, name: string) => `Doné para que ${name} tenga ${detail}.`,
  (detail: string, name: string) => `Pensando en ${name} hoy. Mi donativo es para ${detail}.`,
  (detail: string, name: string) => `La parte de ${detail} es por lo que doné por ${name}.`,
];

const GENERIC_NOTES_EN = [
  "I saw how many people already stepped in, and I didn't want to be the one who scrolled past.",
  "Even a small gift feels better than doing nothing about this.",
  "The way this is written felt honest. That's why I gave.",
  "Someone asked for help and people are answering. I'm one of them.",
  "Glad there is a direct way to help, instead of just wishing them well.",
  "Added what I could. Hope the next person does the same.",
];

const GENERIC_NOTES_ES = [
  "Vi cuánta gente ya se sumó y no quise ser quien sigue de largo.",
  "Aunque sea poquito, es mejor que no hacer nada con esta historia.",
  "La forma en que está contado se sintió honesta. Por eso doné.",
  "Pidieron ayuda y la gente está respondiendo. Yo soy uno de ellos.",
  "Qué bueno que hay una forma directa de ayudar, no solo desearles lo mejor.",
  "Puse lo que pude. Ojalá el siguiente haga lo mismo.",
];

const REPLY_FRAMES_EN = [
  (detail: string) => `Same here. I gave for ${detail} too.`,
  (detail: string) => `That part about ${detail} got me as well.`,
  (detail: string) => `Thank you for writing. I added mine for ${detail}.`,
  (detail: string) => `Just gave too. I'm in for ${detail}.`,
];

const REPLY_FRAMES_ES = [
  (detail: string) => `Igual aquí. Yo también doné para ${detail}.`,
  (detail: string) => `Esa parte de ${detail} también me decidió.`,
  (detail: string) => `Gracias por escribir. Puse lo mío para ${detail}.`,
  (detail: string) => `Acabo de dar también. Voy por ${detail}.`,
];

const GENERIC_REPLIES_EN = [
  "Same here. Nobody should have to carry this alone.",
  "Just gave as well. Let's keep this moving.",
  "Thank you for writing. I donated after reading this.",
  "Added mine too. Glad you said it out loud.",
];

const GENERIC_REPLIES_ES = [
  "Igual aquí. Nadie debería cargar esto solo.",
  "Acabo de dar también. Sigamos moviendo esto.",
  "Gracias por escribir. Doné después de leerte.",
  "Puse lo mío también. Qué bueno que lo dijiste.",
];

function subjectSourceText(source: CampaignCommentSource) {
  return `${source.summary ?? ""}\n${source.story ?? ""}`;
}

function vary(details: string[], frames: Array<(detail: string) => string>, generics: string[]) {
  const pool = [...generics];
  details.forEach((detail, index) => {
    for (let step = 0; step < 2; step += 1) {
      const frame = frames[(index + step * 3) % frames.length];
      if (frame) pool.push(sentence(frame(detail)));
    }
  });
  return [...new Set(pool)];
}

export function campaignCommentPool(source: CampaignCommentSource) {
  const spanish = source.currency === "MXN" || source.currency === "ARS";
  const name = extractCampaignSubject(
    source.title,
    source.organizerName,
    subjectSourceText(source),
  );
  const details = campaignDetails(source, spanish);
  const frames = spanish ? COMMENT_FRAMES_ES : COMMENT_FRAMES_EN;
  const named = spanish ? NAMED_FRAMES_ES : NAMED_FRAMES_EN;
  const generics = spanish ? GENERIC_NOTES_ES : GENERIC_NOTES_EN;
  const pool = vary(details, frames, generics);
  if (name) {
    details.forEach((detail, index) => {
      const frame = named[index % named.length];
      if (frame) pool.push(sentence(frame(detail, name)));
    });
  }
  return [...new Set(pool)];
}

export function campaignReplyPool(source: CampaignCommentSource) {
  const spanish = source.currency === "MXN" || source.currency === "ARS";
  const details = campaignDetails(source, spanish);
  const frames = spanish ? REPLY_FRAMES_ES : REPLY_FRAMES_EN;
  const generics = spanish ? GENERIC_REPLIES_ES : GENERIC_REPLIES_EN;
  return vary(details, frames, generics);
}

export function pickFromPool(
  pool: string[],
  random: () => number,
  used: Set<number>,
) {
  if (!pool.length) return "";
  let index = Math.floor(random() * pool.length);
  let guard = 0;
  while (used.has(index) && used.size < pool.length && guard < 24) {
    index = Math.floor(random() * pool.length);
    guard += 1;
  }
  used.add(index);
  return withoutAiDashes(pool[index]!);
}

export function hashSeed(value: string) {
  let hash = 2166136261;
  for (const char of value) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function rng(seed: number) {
  let state = seed || 1;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export function dailySeedTimestamps(
  count: number,
  now: Date,
  random: () => number,
) {
  const stamps: Date[] = [];
  const recent = Math.min(8, count);
  for (let index = 0; index < count; index += 1) {
    const hoursAgo =
      index < recent
        ? 0.08 + random() * 7.4
        : 18 + (index - recent) * 4.2 + random() * 10;
    stamps.push(new Date(now.getTime() - Math.round(hoursAgo * 3_600_000)));
  }
  return stamps;
}

export function seededSocialNeedsRefresh(input: {
  newestPaidAt: Date | null;
  bodies: string[];
  now?: Date;
}) {
  const now = input.now ?? new Date();
  if (!input.newestPaidAt) return true;
  if (utcDateKey(input.newestPaidAt) !== utcDateKey(now)) return true;
  return (
    input.bodies.some(
      (body) =>
        isGenericSocialComment(body) ||
        commentUsesRejectedSubject(body) ||
        commentUsesStampedClause(body),
    ) || commentsStampOnePhrase(input.bodies)
  );
}
