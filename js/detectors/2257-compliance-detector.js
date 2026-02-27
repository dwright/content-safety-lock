/**
 * 2257 Compliance Statement Detector
 * Detects 18 U.S.C. § 2257 compliance statements in anchor tags to identify adult content sites
 */

const DOMAIN_2257_WHITELIST = [
  '.gov',
  '.edu',
  '.law',
  'wikipedia.org',
  'justia.com',
  'aclu.org',
  'oyez.org',
  'eff.org',
  'duckduckgo.com',
  'google.com',
  'bing.com',
  'yahoo.com',
  'laws-info.com',
  'chanrobles.com',
  'law.com',
];

const COMPLIANCE_2257_RULES = [
  {
    rule_id: 'compliance_statement',
    match_all: ['2257', 'compliance', 'statement'],
    match_none: ['guide', 'overview', 'explanation', 'what is'],
    whitelist_domain: []
  },
  {
    rule_id: 'custodian_records',
    match_all: ['2257', 'custodian', 'records'],
    match_none: ['template', 'generator', 'how to'],
    whitelist_domain: []
  },
  {
    rule_id: 'exempt_exemption',
    match_all: ['2257', ['exempt', 'exemption']],
    match_none: [],
    whitelist_domain: []
  },
  {
    rule_id: 'usc_reference',
    match_all: ['18', ['usc', 'u.s.c.'], '2257'],
    match_none: ['guide', 'overview', 'explanation', 'what is'],
    whitelist_domain: []
  },
  {
    rule_id: 'record_keeping',
    match_all: ['2257', ['record-keeping', 'record keeping']],
    match_none: ['guide', 'overview', 'explanation', 'what is'],
    whitelist_domain: []
  },
  {
    rule_id: 'cfr_reference',
    match_all: ['28', ['cfr', 'c.f.r.'], '75'],
    match_none: [],
    whitelist_domain: []
  }
];

function normalize(text) {
  return (text || '').toLowerCase();
}

function isCurrentPageSkippable() {
  if (window.location.protocol === 'file:') {
    return true;
  }
  const hostname = window.location.hostname;
  for (const domain of DOMAIN_2257_WHITELIST) {
    if (hostname.endsWith(domain)) {
      console.debug('[CSL] 2257 detector skipping whitelisted page:', hostname);
      return true;
    }
  }
  if ( /\.[a-z]{2}\.us$/.test(hostname) ) {
    console.debug('[CSL] 2257 detector skipping US state government page:', hostname);
    return true;
  }
  return false;
}

function matchesRule(linkText, rule) {
  const normalizedText = normalize(linkText);
  
  for (const term of rule.match_all) {
    if (Array.isArray(term)) {
      const matchedAny = term.some(subTerm => normalizedText.includes(normalize(subTerm)));
      if (!matchedAny) {
        return false;
      }
    } else {
      if (!normalizedText.includes(normalize(term))) {
        return false;
      }
    }
  }
  
  for (const term of rule.match_none) {
    if (normalizedText.includes(normalize(term))) {
      return false;
    }
  }
  
  return true;
}

function checkLink(link) {
  if (link.hasAttribute('data-2257-checked')) {
    return null;
  }
  
  link.setAttribute('data-2257-checked', 'true');
  
  const href = link.getAttribute('href');
  if (!href || href.startsWith('#') || href.startsWith('javascript:')) {
    return null;
  }
  
  const linkText = link.innerText || link.textContent || '';
  
  try {
    const resolvedHostname = new URL(href, window.location.href).hostname;
    if (resolvedHostname !== window.location.hostname) {
      return null;
    }
  } catch (e) {
    return null;
  }
  
  for (const rule of COMPLIANCE_2257_RULES) {
    if (matchesRule(linkText, rule)) {
      const resolvedHref = new URL(href, window.location.href).href;
      console.debug('[CSL] 2257 compliance match - rule:', rule.rule_id, 'href:', resolvedHref, 'text:', linkText.substring(0, 100));
      return {
        signal: 'ICRA:2257',
        details: [
          `Link text: "${linkText.trim().substring(0, 200)}"`,
          `Link URL: ${resolvedHref}`
        ]
      };
    }
  }
  
  return null;
}

function checkAllLinks() {
  const links = document.querySelectorAll('a:not([data-2257-checked])');
  
  for (const link of links) {
    const signal = checkLink(link);
    if (signal) {
      return signal;
    }
  }
  
  return null;
}

function detect2257Compliance() {
  if (isCurrentPageSkippable()) {
    return null;
  }
  
  const initialResult = checkAllLinks();
  
  let debounceTimeout;
  const observer = new MutationObserver((mutations) => {
    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(() => {
      const result = checkAllLinks();
      if (result) {
        console.debug('[CSL] 2257 compliance detected in dynamically added content');
        if (typeof checkAndBlock === 'function') {
          checkAndBlock();
        }
      }
    }, 250);
  });
  
  observer.observe(document.body || document.documentElement, {
    childList: true,
    subtree: true
  });
  
  return initialResult;
}
