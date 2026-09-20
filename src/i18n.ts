import type { Locale, Localized, SiteConfig } from './schema.js';

export function translate(value: Localized, locale: Locale): string {
  if (typeof value === 'string') return value;
  const result = value[locale];
  if (!result) throw new Error(`Tradução ausente para o idioma '${locale}'.`);
  return result;
}

export const labels = {
  pt: {
    home: 'Início',
    about: 'Sobre',
    research: 'Pesquisa',
    team: 'Equipe',
    supervision: 'Orientações',
    publications: 'Publicações',
    faculty: 'Professores',
    researchers: 'Pesquisadores',
    students: 'Alunos ativos',
    alumni: 'Egressos',
    references: 'Referências',
    areas: 'Áreas de atuação',
    details: 'Conheça esta linha de pesquisa',
    skip: 'Pular para o conteúdo',
    theme: 'Alternar modo claro e escuro',
    navigation: 'Navegação principal',
    menu: 'Menu',
    languages: 'Idiomas',
    built: 'Feito com SciPages',
    emptyReferences: 'Nenhuma referência cadastrada.',
    notFound: 'Página não encontrada',
    back: 'Voltar ao início',
    since: 'Desde',
  },
  en: {
    home: 'Home',
    about: 'About',
    research: 'Research',
    team: 'Team',
    supervision: 'Supervision',
    publications: 'Publications',
    faculty: 'Faculty',
    researchers: 'Researchers',
    students: 'Current students',
    alumni: 'Alumni',
    references: 'References',
    areas: 'Research areas',
    details: 'Explore this research area',
    skip: 'Skip to content',
    theme: 'Toggle light and dark mode',
    navigation: 'Main navigation',
    menu: 'Menu',
    languages: 'Languages',
    built: 'Built with SciPages',
    emptyReferences: 'No references yet.',
    notFound: 'Page not found',
    back: 'Back to home',
    since: 'Since',
  },
} as const;

export function routePath(
  config: SiteConfig,
  page: string,
  locale: Locale,
): string {
  const names: Record<string, Record<Locale, string>> = {
    home: { pt: '', en: '' },
    research: { pt: 'pesquisa', en: 'research' },
    team: { pt: 'equipe', en: 'team' },
    publications: { pt: 'publicacoes', en: 'publications' },
  };
  const slug = names[page]?.[locale] ?? page;
  const prefix = locale === config.defaultLocale ? '' : `${locale}/`;
  return `${config.base}${prefix}${slug ? `${slug}/` : ''}`;
}

export function assetPath(base: string, value: string): string {
  if (/^https?:\/\//.test(value)) return value;
  return `${base}${value.replace(/^\//, '')}`;
}
