export interface ParsedGrounding {
  sources: Array<{ title: string; uri: string; domain: string }>;
  claims: Array<{ text: string; startIndex: number; endIndex: number; sourceIndices: number[] }>;
  searchQueriesExecuted: string[];
}

const extractDomain = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
};

const looksLikeDomain = (s: string): boolean => {
  return !!s && !s.includes(' ') && /\.[a-z]{2,}$/i.test(s.trim());
};

const resolveDomain = (title: string, uri: string): string => {
  const cleanTitle = (title || '').trim().toLowerCase().replace('www.', '');
  if (looksLikeDomain(cleanTitle)) return cleanTitle;
  return extractDomain(uri);
};

export const parseGroundingMetadata = (response: any): ParsedGrounding => {
  const candidate = response?.candidates?.[0];
  const metadata = candidate?.groundingMetadata;

  const chunks = metadata?.groundingChunks || [];
  const supports = metadata?.groundingSupports || [];
  const queries = metadata?.webSearchQueries || [];

  const sources = chunks
    .map((c: any) => {
      const web = c?.web || {};
      if (!web.uri) return null;
      return { title: web.title || 'Untitled', uri: web.uri, domain: resolveDomain(web.title, web.uri) };
    })
    .filter((item: any): item is { title: string; uri: string; domain: string } => item !== null);

  const claims = supports.map((s: any) => ({
    text: s.segment?.text || '',
    startIndex: s.segment?.startIndex ?? 0,
    endIndex: s.segment?.endIndex ?? 0,
    sourceIndices: s.groundingChunkIndices || [],
  }));

  return { sources, claims, searchQueriesExecuted: queries };
};
