/**
 * 网络搜索服务
 * 支持 SearXNG (推荐自建) 和 DuckDuckGo (备用)
 */

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
}

// SearXNG 配置
const SEARXNG_URL = process.env.SEARXNG_URL || '';

/**
 * 使用 SearXNG 进行搜索
 */
async function searchWithSearXNG(query: string, maxResults: number): Promise<SearchResult[]> {
  if (!SEARXNG_URL) {
    return [];
  }

  try {
    const searchUrl = `${SEARXNG_URL}/search?q=${encodeURIComponent(query)}&format=json&language=zh-CN`;

    const response = await fetch(searchUrl, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('[SearXNG] 请求失败:', response.status);
      return [];
    }

    const data = await response.json();

    return (data.results || []).slice(0, maxResults).map((item: { title?: string; url?: string; content?: string }) => ({
      title: item.title || '',
      url: item.url || '',
      snippet: item.content || '',
    }));
  } catch (error) {
    console.error('[SearXNG] 搜索出错:', error);
    return [];
  }
}

/**
 * 使用 DuckDuckGo HTML 搜索 (备用方案)
 */
async function searchWithDuckDuckGo(query: string, maxResults: number): Promise<SearchResult[]> {
  try {
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
    });

    if (!response.ok) {
      console.error('[DuckDuckGo] 请求失败:', response.status);
      return [];
    }

    const html = await response.text();
    return parseDuckDuckGoResults(html, maxResults);
  } catch (error) {
    console.error('[DuckDuckGo] 搜索出错:', error);
    return [];
  }
}

/**
 * 解析 DuckDuckGo HTML 搜索结果
 */
function parseDuckDuckGoResults(html: string, maxResults: number): SearchResult[] {
  const results: SearchResult[] = [];

  const resultBlocks = html.match(/<div class="result[^"]*"[^>]*>[\s\S]*?<\/div>\s*<\/div>/g) || [];

  for (const block of resultBlocks.slice(0, maxResults)) {
    const urlMatch = block.match(/href="([^"]+)"\s+class="result__a"/);
    const titleMatch = block.match(/class="result__a"[^>]*>([^<]+)</);
    const snippetMatch = block.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/);

    if (urlMatch && titleMatch) {
      let url = urlMatch[1];
      if (url.includes('uddg=')) {
        const uddgMatch = url.match(/uddg=([^&]+)/);
        if (uddgMatch) {
          url = decodeURIComponent(uddgMatch[1]);
        }
      }

      results.push({
        title: cleanHtml(titleMatch[1]),
        url: url,
        snippet: snippetMatch ? cleanHtml(snippetMatch[1]) : '',
      });
    }
  }

  return results;
}

/**
 * 清理 HTML 标签和实体
 */
function cleanHtml(text: string): string {
  return text
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 搜索网络
 * 优先使用 SearXNG，失败则回退到 DuckDuckGo
 */
export async function searchWeb(query: string, maxResults: number = 5): Promise<SearchResponse> {
  console.log(`[Web Search] 搜索: "${query}"`);

  let results: SearchResult[] = [];

  // 优先使用 SearXNG
  if (SEARXNG_URL) {
    console.log(`[Web Search] 使用 SearXNG: ${SEARXNG_URL}`);
    results = await searchWithSearXNG(query, maxResults);
  }

  // SearXNG 失败或未配置，回退到 DuckDuckGo
  if (results.length === 0 && !SEARXNG_URL) {
    console.log('[Web Search] 使用 DuckDuckGo (备用)');
    results = await searchWithDuckDuckGo(query, maxResults);
  }

  console.log(`[Web Search] 找到 ${results.length} 条结果`);
  return { query, results };
}

/**
 * 将搜索结果格式化为上下文文本
 */
export function formatSearchResultsForContext(searchResponse: SearchResponse): string {
  if (searchResponse.results.length === 0) {
    return '';
  }

  let context = `\n\n【网络搜索结果】搜索词: "${searchResponse.query}"\n`;
  context += '以下是相关的网络搜索结果，请参考这些信息来回答用户的问题：\n\n';

  searchResponse.results.forEach((result, index) => {
    context += `${index + 1}. **${result.title}**\n`;
    context += `   来源: ${result.url}\n`;
    if (result.snippet) {
      context += `   摘要: ${result.snippet}\n`;
    }
    context += '\n';
  });

  context += '请根据以上搜索结果，结合你的知识，为用户提供准确、有帮助的回答。如果搜索结果与问题不相关，请依据你的知识回答。\n';

  return context;
}
