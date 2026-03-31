import { load } from 'cheerio';
import got from 'got';
import tls from 'tls';

const normalizeUrl = (candidate, baseUrl) => {
  try {
    return new URL(candidate, baseUrl).toString();
  } catch {
    return null;
  }
};

const fetchTlsInfo = (target) => {
  return new Promise((resolve) => {
    const url = new URL(target);
    const host = url.hostname;
    const port = Number(url.port || 443);

    const socket = tls.connect({ host, port, servername: host, rejectUnauthorized: false }, () => {
      const cert = socket.getPeerCertificate(true);
      const protocol = socket.getProtocol ? socket.getProtocol() : null;
      socket.end();
      if (!cert || !cert.valid_to) {
        return resolve({ protocol, certificate: null });
      }
      resolve({
        protocol,
        certificate: {
          subject: cert.subject || {},
          issuer: cert.issuer || {},
          validFrom: cert.valid_from,
          validTo: cert.valid_to,
          fingerprint: cert.fingerprint,
        },
      });
    });

    socket.on('error', (err) => {
      resolve({ protocol: null, certificateError: err.message });
    });
  });
};

const safeFetchHead = async (href) => {
  try {
    const res = await got.head(href, {
      followRedirect: true,
      throwHttpErrors: false,
      timeout: { request: 15000 }
    });
    return { status: res.statusCode, finalUrl: res.url, contentLength: res.headers['content-length'] || null, redirected: res.redirectUrls.length > 0, redirectChain: res.redirectUrls };
  } catch (err) {
    return { status: null, error: err.message };
  }
};

const fetchRobotsAndSitemap = async (targetUrl) => {
  try {
    const root = new URL('/', targetUrl).toString();
    const robotsUrl = new URL('/robots.txt', root).toString();
    const robotsRes = await got(robotsUrl, { throwHttpErrors: false, timeout: { request: 10000 } });
    const robotsBody = robotsRes.statusCode === 200 ? robotsRes.body : null;

    const sitemapUrl = new URL('/sitemap.xml', root).toString();
    const sitemapRes = await got(sitemapUrl, { throwHttpErrors: false, timeout: { request: 10000 } });
    const sitemapBody = sitemapRes.statusCode === 200 ? sitemapRes.body : null;

    const sitemapCount = sitemapBody ? (sitemapBody.match(/<loc>/g) || []).length : 0;

    return { robotsUrl, robotsStatus: robotsRes.statusCode, robotsBody, sitemapUrl, sitemapStatus: sitemapRes.statusCode, sitemapCount };
  } catch (err) {
    return { robotsError: err.message };
  }
};

const parseStructuredData = ($) => {
  const scripts = [];
  $('script[type="application/ld+json"]').each((i, el) => {
    const text = $(el).html();
    if (!text) return;
    try {
      const json = JSON.parse(text);
      scripts.push(json);
    } catch {
      scripts.push({ invalidJsonLd: text.substring(0, 200) });
    }
  });

  const microdata = [];
  $('[itemscope]').each((i, el) => {
    microdata.push($(el).attr('itemtype') || 'unknown');
  });

  const rdfa = [];
  $('[typeof]').each((i, el) => {
    rdfa.push($(el).attr('typeof') || 'unknown');
  });

  return { jsonLd: scripts, microdata, rdfa };
};

const generateSeoPreview = (meta) => {
  const title = meta.title || 'Untitled page';
  const description = meta.metaDescription || 'No meta description available';
  const displayUrl = meta.finalUrl || meta.url;
  return { title, description, displayUrl };
};

export default async function handler(req, res) {
  const { url, headless } = req.query;

  if (!url) return res.status(400).json({ message: 'Missing url query parameter.' });

  let targetUrl;
  try {
    targetUrl = new URL(url).toString();
  } catch (err) {
    return res.status(400).json({ message: 'Invalid URL.' });
  }

  const start = Date.now();
  let pageData = {};

  try {
    const gotResponse = await got(targetUrl, {
      method: 'GET',
      responseType: 'text',
      throwHttpErrors: false,
      followRedirect: true,
      timeout: { request: 45000 },
      headers: { 'User-Agent': 'Mozilla/5.0 (SEO Scanner) Gecko/20100101 Firefox/137.0' }
    });

    const status = gotResponse.statusCode;
    const finalUrl = gotResponse.url;
    const redirectChain = gotResponse.redirectUrls || [];
    const headers = gotResponse.headers;
    const fetchTime = Date.now() - start;

    const tlsInfo = await fetchTlsInfo(finalUrl);
    const robotsAndSitemap = await fetchRobotsAndSitemap(finalUrl);

    const html = gotResponse.body;
    const contentType = (headers['content-type'] || '').toLowerCase();

    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
      return res.status(415).json({ message: `Unsupported content type (${contentType}).`, status, finalUrl, redirectChain });
    }

    let $;
    try {
      $ = load(html, { xmlMode: false, decodeEntities: true });
    } catch (err) {
      return res.status(502).json({ message: `Failed to parse HTML of target page: ${err.message}` });
    }

    const title = $('title').text().trim();
    const metaDescription = $('meta[name="description"]').attr('content')?.trim() || '';
    const canonical = $('link[rel="canonical"]').attr('href') || '';
    const robots = $('meta[name="robots"]').attr('content') || '';
    const viewport = $('meta[name="viewport"]').attr('content') || '';
    const lang = $('html').attr('lang') || '';

    const headLinks = {
      alternate: [],
      hreflang: [],
      prev: null,
      next: null,
    };

    $('link[rel="alternate"]').each((i, el) => headLinks.alternate.push($(el).attr('href')));
    $('link[hreflang]').each((i, el) => headLinks.hreflang.push({ tag: $(el).attr('hreflang'), href: $(el).attr('href') }));
    headLinks.prev = $('link[rel="prev"]').attr('href') || null;
    headLinks.next = $('link[rel="next"]').attr('href') || null;

    const headings = { h1: [], h2: [], h3: [], h4: [], h5: [], h6: [] };
    for (let i = 1; i <= 6; i++) {
      $(`h${i}`).each((idx, el) => {
        headings[`h${i}`].push($(el).text().trim());
      });
    }

    const h1Count = headings.h1.length;
    const headingsIssues = [];
    if (h1Count === 0) headingsIssues.push('Missing H1');
    if (h1Count > 1) headingsIssues.push('Multiple H1 headers');

    const images = [];
    $('img').each((i, el) => {
      const src = normalizeUrl($(el).attr('src') || '', finalUrl) || $(el).attr('src') || '';
      images.push({
        src,
        alt: ($(el).attr('alt') || '').trim(),
        loading: $(el).attr('loading') || 'auto',
        width: $(el).attr('width') || null,
        height: $(el).attr('height') || null
      });
    });

    const internalLinks = [];
    const externalLinks = [];
    const linkDetails = [];

    const sourceHost = new URL(finalUrl).hostname;

    $('a[href]').each((i, el) => {
      const rawHref = $(el).attr('href');
      const href = normalizeUrl(rawHref, finalUrl);
      if (!href) return;
      const urlObj = new URL(href);
      const isExternal = urlObj.hostname !== sourceHost;
      const protocol = urlObj.protocol.replace(':', '');
      const rel = ($(el).attr('rel') || '').toLowerCase().split(/\s+/).filter(Boolean);

      if (isExternal) externalLinks.push(href); else internalLinks.push(href);

      linkDetails.push({ href, isExternal, protocol, rel });
    });

    // limit checks to avoid huge scan duration
    const linkCheckList = linkDetails.slice(0, 30);
    const checkedLinks = await Promise.all(linkCheckList.map((l) => safeFetchHead(l.href).then((info) => ({ ...l, ...info }))));

    const brokenLinks = checkedLinks.filter((l) => !l.status || l.status >= 400 || (l.redirected && l.redirectChain && l.redirectChain.length > 0 && l.finalUrl !== l.href));
    const redirectingLinks = checkedLinks.filter((l) => l.redirected);

    const structuredData = parseStructuredData($);

    const social = {
      openGraph: {},
      twitter: {}
    };

    $('meta[property^="og:"]').each((i, el) => {
      const key = $(el).attr('property');
      const content = $(el).attr('content');
      if (key && content) social.openGraph[key.replace('og:', '')] = content;
    });
    $('meta[name^="twitter:"]').each((i, el) => {
      const key = $(el).attr('name');
      const content = $(el).attr('content');
      if (key && content) social.twitter[key.replace('twitter:', '')] = content;
    });

    let headlessData = null;
    if (headless === 'true' || headless === '1') {
      headlessData = { warning: 'Headless rendering requires playwright. Install playwright and restart, or disable headless.' };
    }

    const checkPhoneViewport = viewport.includes('width=device-width');

    const formIssues = [];
    $('form').each((i, formEl) => {
      const hasLabelIssue = $(formEl).find('input[aria-label], input[id]').length === 0;
      if (hasLabelIssue) formIssues.push(`Form ${i + 1} may have missing labels`);
    });

    const roText = robots.toLowerCase();

    pageData = {
      url: targetUrl,
      finalUrl,
      status,
      redirectChain,
      headers,
      fetchTime,
      tlsInfo,
      robots: roText,
      viewport,
      canonical,
      lang,
      title,
      metaDescription,
      maybeMobileFriendly: checkPhoneViewport,
      headLinks,
      headings,
      headingIssues: headingsIssues,
      images,
      linkSummary: { internal: internalLinks.length, external: externalLinks.length, total: linkDetails.length },
      linkDetails: checkedLinks,
      brokenLinks: brokenLinks.length,
      redirectingLinks: redirectingLinks.length,
      structuredData,
      social,
      robotsAndSitemap,
      seoPreview: generateSeoPreview({ title, metaDescription, finalUrl }),
      accessibility: {
        missingAlt: images.filter((i) => !i.alt).length,
        forms: formIssues,
        landmarks: {
          hasNav: $('nav').length > 0,
          hasMain: $('main').length > 0,
          hasHeader: $('header').length > 0,
          hasFooter: $('footer').length > 0
        }
      },
      metaCompleteness: {
        title: Boolean(title),
        description: Boolean(metaDescription),
        canonical: Boolean(canonical),
        robots: Boolean(robots),
        hreflang: headLinks.hreflang.length
      },
      socialCompleteness: {
        openGraph: Boolean(social.openGraph.title && social.openGraph.image && social.openGraph.description),
        twitter: Boolean(social.twitter.title && social.twitter.image && social.twitter.description)
      },
      structuredPreview: { topLine: `${title} - ${metaDescription.slice(0, 180)}`, url: finalUrl },
      headless: headlessData,
      rawHTML: html
    };

    return res.status(200).json(pageData);
  } catch (err) {
    return res.status(500).json({ message: `Scan failed: ${err.message}` });
  }
}
