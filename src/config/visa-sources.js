/**
 * Canadian Immigration Visa Sources Configuration
 * Contains all official immigration program URLs for tracking requirements and conditions
 */

const VISA_SOURCES = {
  // Express Entry Programs
  expressEntry: {
    federalSkilledWorker: {
      id: 'ee-fsw',
      name: 'Express Entry - Federal Skilled Worker Program',
      category: 'Express Entry',
      url: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/who-can-apply/federal-skilled-workers.html#where',
      description: 'For skilled workers with foreign work experience who want to immigrate permanently',
      selectors: {
        content: 'main, article, .content-main, #wb-main',
        requirements: '.mwsgeneric-base-html, .panel, .well, ul li',
        lastUpdated: '.mwsgeneric-base-html time, .date-modified'
      }
    },
    federalSkilledTrades: {
      id: 'ee-fst',
      name: 'Express Entry - Federal Skilled Trades Program',
      category: 'Express Entry',
      url: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/who-can-apply/federal-skilled-trades.html',
      description: 'For skilled tradespeople who want to become permanent residents',
      selectors: {
        content: 'main, article, .content-main, #wb-main',
        requirements: '.mwsgeneric-base-html, .panel, .well, ul li',
        lastUpdated: '.mwsgeneric-base-html time, .date-modified'
      }
    },
    canadianExperienceClass: {
      id: 'ee-cec',
      name: 'Express Entry - Canadian Experience Class',
      category: 'Express Entry',
      url: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/who-can-apply/canadian-experience-class.html',
      description: 'For skilled workers who have Canadian work experience and want permanent residence',
      selectors: {
        content: 'main, article, .content-main, #wb-main',
        requirements: '.mwsgeneric-base-html, .panel, .well, ul li',
        lastUpdated: '.mwsgeneric-base-html time, .date-modified'
      }
    },
    crsScoring: {
      id: 'ee-crs',
      name: 'Express Entry - Comprehensive Ranking System (CRS) Criteria',
      category: 'Express Entry',
      url: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/check-score/crs-criteria.html',
      description: 'CRS scoring criteria for Express Entry candidates',
      selectors: {
        content: 'main, article, .content-main, #wb-main',
        requirements: '.mwsgeneric-base-html, .panel, table, ul li',
        lastUpdated: '.mwsgeneric-base-html time, .date-modified'
      }
    },
    languageTests: {
      id: 'ee-lang',
      name: 'Express Entry - Language Test Results',
      category: 'Express Entry',
      url: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/documents/language-test.html',
      description: 'Language test requirements for Express Entry',
      selectors: {
        content: 'main, article, .content-main, #wb-main',
        requirements: '.mwsgeneric-base-html, .panel, table, ul li',
        lastUpdated: '.mwsgeneric-base-html time, .date-modified'
      }
    }
  },

  // Economic Classes
  economicClasses: {
    permanentResident: {
      id: 'ec-pr',
      name: 'Permanent Resident Program - Economic Classes',
      category: 'Economic Immigration',
      url: 'https://www.canada.ca/en/immigration-refugees-citizenship/corporate/publications-manuals/operational-bulletins-manuals/permanent-residence/economic-classes.html',
      description: 'Operational guidelines for economic class permanent residence',
      selectors: {
        content: 'main, article, .content-main, #wb-main',
        requirements: '.mwsgeneric-base-html, .panel, ul li',
        lastUpdated: '.mwsgeneric-base-html time, .date-modified'
      }
    }
  },

  // Work Programs
  workPrograms: {
    iec: {
      id: 'wp-iec',
      name: 'International Experience Canada (IEC)',
      category: 'Work Permits',
      url: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/work-canada/iec.html',
      description: 'Working holiday, young professionals, and international co-op programs',
      selectors: {
        content: 'main, article, .content-main, #wb-main',
        requirements: '.mwsgeneric-base-html, .panel, ul li',
        lastUpdated: '.mwsgeneric-base-html time, .date-modified'
      }
    },
    workPermit: {
      id: 'wp-general',
      name: 'Work Permit',
      category: 'Work Permits',
      url: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/work-canada/work-permit.html',
      description: 'General work permit information and requirements',
      selectors: {
        content: 'main, article, .content-main, #wb-main',
        requirements: '.mwsgeneric-base-html, .panel, ul li',
        lastUpdated: '.mwsgeneric-base-html time, .date-modified'
      }
    }
  },

  // Study Programs
  studyPrograms: {
    studyPermit: {
      id: 'sp-main',
      name: 'Study Permit',
      category: 'Study Permits',
      url: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/study-canada/study-permit.html',
      description: 'General study permit information and requirements',
      selectors: {
        content: 'main, article, .content-main, #wb-main',
        requirements: '.mwsgeneric-base-html, .panel, ul li',
        lastUpdated: '.mwsgeneric-base-html time, .date-modified'
      }
    },
    provincialAttestation: {
      id: 'sp-pal',
      name: 'Study Permit - Provincial Attestation Letter (PAL)',
      category: 'Study Permits',
      url: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/study-canada/study-permit/get-documents/provincial-attestation-letter.html',
      description: 'Provincial or territorial attestation letter requirements',
      selectors: {
        content: 'main, article, .content-main, #wb-main',
        requirements: '.mwsgeneric-base-html, .panel, ul li',
        lastUpdated: '.mwsgeneric-base-html time, .date-modified'
      }
    },
    pgwp: {
      id: 'sp-pgwp',
      name: 'Post-Graduation Work Permit (PGWP)',
      category: 'Study Permits',
      url: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/study-canada/work/after-graduation/about.html',
      description: 'Work permit after graduation from Canadian institution',
      selectors: {
        content: 'main, article, .content-main, #wb-main',
        requirements: '.mwsgeneric-base-html, .panel, ul li',
        lastUpdated: '.mwsgeneric-base-html time, .date-modified'
      }
    },
    spouseWorkPermit: {
      id: 'sp-spouse',
      name: 'Student Spouse/Common-Law Partner Work Permit',
      category: 'Study Permits',
      url: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/study-canada/work/help-your-spouse-common-law-partner-work-canada.html',
      description: 'Work permit for spouses of international students',
      selectors: {
        content: 'main, article, .content-main, #wb-main',
        requirements: '.mwsgeneric-base-html, .panel, ul li',
        lastUpdated: '.mwsgeneric-base-html time, .date-modified'
      }
    }
  },

  // Visitor Programs
  visitorPrograms: {
    visitorVisa: {
      id: 'vp-trv',
      name: 'Visitor Visa (Temporary Resident Visa)',
      category: 'Visitor',
      url: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/visit-canada/visitor-visa.html',
      description: 'Temporary resident visa for visiting Canada',
      selectors: {
        content: 'main, article, .content-main, #wb-main',
        requirements: '.mwsgeneric-base-html, .panel, ul li',
        lastUpdated: '.mwsgeneric-base-html time, .date-modified'
      }
    }
  },

  // Provincial Nominee Programs
  pnp: {
    ontario: {
      id: 'pnp-on',
      name: 'Ontario Immigrant Nominee Program (OINP)',
      category: 'Provincial Nominee Program',
      province: 'Ontario',
      url: 'https://www.ontario.ca/page/ontario-immigrant-nominee-program-oinp',
      description: 'Ontario\'s provincial immigration program',
      selectors: {
        content: 'main, article, .content-area, #main-content',
        requirements: '.page-content, ul li, .accordion',
        lastUpdated: '.date-modified, time'
      }
    },
    britishColumbia: {
      id: 'pnp-bc',
      name: 'BC Provincial Nominee Program (BC PNP)',
      category: 'Provincial Nominee Program',
      province: 'British Columbia',
      url: 'https://www.welcomebc.ca/immigrate-to-b-c/about-the-bc-provincial-nominee-program',
      description: 'British Columbia\'s provincial immigration program',
      selectors: {
        content: 'main, article, .content-area',
        requirements: '.content, ul li',
        lastUpdated: '.date-modified, time'
      }
    },
    alberta: {
      id: 'pnp-ab',
      name: 'Alberta Advantage Immigration Program',
      category: 'Provincial Nominee Program',
      province: 'Alberta',
      url: 'https://www.alberta.ca/alberta-advantage-immigration-program',
      description: 'Alberta\'s provincial immigration program',
      selectors: {
        content: 'main, article, .content',
        requirements: '.content, ul li',
        lastUpdated: '.date-modified, time'
      }
    },
    saskatchewan: {
      id: 'pnp-sk',
      name: 'Saskatchewan Immigrant Nominee Program (SINP)',
      category: 'Provincial Nominee Program',
      province: 'Saskatchewan',
      url: 'https://www.saskatchewan.ca/residents/moving-to-saskatchewan/live-in-saskatchewan/by-immigrating/saskatchewan-immigrant-nominee-program',
      description: 'Saskatchewan\'s provincial immigration program',
      selectors: {
        content: 'main, article, .content',
        requirements: '.content, ul li',
        lastUpdated: '.date-modified, time'
      }
    },
    manitoba: {
      id: 'pnp-mb',
      name: 'Manitoba Provincial Nominee Program (MPNP)',
      category: 'Provincial Nominee Program',
      province: 'Manitoba',
      url: 'https://immigratemanitoba.com/immigrate/',
      description: 'Manitoba\'s provincial immigration program',
      selectors: {
        content: 'main, article, .content',
        requirements: '.content, ul li',
        lastUpdated: '.date-modified, time'
      }
    },
    quebec: {
      id: 'qc-skilled',
      name: 'Quebec Immigration Programs for Skilled Workers',
      category: 'Quebec Immigration',
      province: 'Quebec',
      url: 'https://www.quebec.ca/en/immigration/permanent/skilled-workers',
      description: 'Quebec\'s skilled worker immigration programs (not PNP)',
      selectors: {
        content: 'main, article, .content',
        requirements: '.content, ul li',
        lastUpdated: '.date-modified, time'
      }
    },
    newBrunswick: {
      id: 'pnp-nb',
      name: 'New Brunswick Provincial Nominee Program',
      category: 'Provincial Nominee Program',
      province: 'New Brunswick',
      url: 'https://www2.gnb.ca/content/gnb/en/corporate/promo/immigration/immigrating-to-nb/nb-immigration-program-streams.html',
      description: 'New Brunswick\'s provincial immigration program',
      selectors: {
        content: 'main, article, .content',
        requirements: '.content, ul li',
        lastUpdated: '.date-modified, time'
      }
    },
    novaScotia: {
      id: 'pnp-ns',
      name: 'Nova Scotia Nominee Program (NSNP)',
      category: 'Provincial Nominee Program',
      province: 'Nova Scotia',
      url: 'https://liveinnovascotia.com/nova-scotia-nominee-program',
      description: 'Nova Scotia\'s provincial immigration program',
      selectors: {
        content: 'main, article, .content',
        requirements: '.content, ul li',
        lastUpdated: '.date-modified, time'
      }
    },
    pei: {
      id: 'pnp-pe',
      name: 'PEI Provincial Nominee Program (PNP)',
      category: 'Provincial Nominee Program',
      province: 'Prince Edward Island',
      url: 'https://www.princeedwardisland.ca/en/information/office-of-immigration/provincial-nominee-program',
      description: 'Prince Edward Island\'s provincial immigration program',
      selectors: {
        content: 'main, article, .content',
        requirements: '.content, ul li',
        lastUpdated: '.date-modified, time'
      }
    },
    newfoundland: {
      id: 'pnp-nl',
      name: 'NL Provincial Nominee Program (NLPNP)',
      category: 'Provincial Nominee Program',
      province: 'Newfoundland and Labrador',
      url: 'https://www.gov.nl.ca/immigration/immigrating-to-newfoundland-and-labrador/provincial-nominee-program/overview/',
      description: 'Newfoundland and Labrador\'s provincial immigration program',
      selectors: {
        content: 'main, article, .content',
        requirements: '.content, ul li',
        lastUpdated: '.date-modified, time'
      }
    },
    nwt: {
      id: 'pnp-nt',
      name: 'Northwest Territories Nominee Program',
      category: 'Territorial Nominee Program',
      province: 'Northwest Territories',
      url: 'https://www.immigratenwt.ca/',
      description: 'Northwest Territories\' immigration program',
      selectors: {
        content: 'main, article, .content',
        requirements: '.content, ul li',
        lastUpdated: '.date-modified, time'
      }
    },
    yukon: {
      id: 'pnp-yt',
      name: 'Yukon Nominee Program',
      category: 'Territorial Nominee Program',
      province: 'Yukon',
      url: 'https://yukon.ca/en/immigration/apply-immigrate-yukon/immigrate-yukon',
      description: 'Yukon\'s territorial immigration program',
      selectors: {
        content: 'main, article, .content',
        requirements: '.content, ul li',
        lastUpdated: '.date-modified, time'
      }
    },
    nunavut: {
      id: 'nu-imm',
      name: 'Immigrate to Nunavut',
      category: 'Territorial Immigration',
      province: 'Nunavut',
      url: 'https://www.gov.nu.ca/en/immigration/immigrate-nunavut',
      description: 'Nunavut\'s immigration program (not PNP)',
      selectors: {
        content: 'main, article, .content',
        requirements: '.content, ul li',
        lastUpdated: '.date-modified, time'
      }
    }
  },

  // News Sources
  news: {
    cicNews: {
      id: 'news-cic',
      name: 'CIC News - Immigration News',
      category: 'News',
      url: 'https://www.cicnews.com/',
      description: 'Latest Canadian immigration news and updates',
      selectors: {
        content: 'main, article',
        articles: '.article, .post, .news-item',
        lastUpdated: '.date, time'
      }
    },
    ircNotices: {
      id: 'news-ircc',
      name: 'IRCC Official Notices',
      category: 'News',
      url: 'https://www.canada.ca/en/immigration-refugees-citizenship/news/notices.html',
      description: 'Official notices from Immigration, Refugees and Citizenship Canada',
      selectors: {
        content: 'main, article, .content-main',
        notices: '.item, .notice, ul li a',
        lastUpdated: '.date-modified, time'
      }
    }
  }
};

/**
 * Get all visa sources as a flat array
 */
function getAllSources() {
  const sources = [];

  for (const categoryKey of Object.keys(VISA_SOURCES)) {
    const category = VISA_SOURCES[categoryKey];
    for (const sourceKey of Object.keys(category)) {
      sources.push({
        ...category[sourceKey],
        categoryKey,
        sourceKey
      });
    }
  }

  return sources;
}

/**
 * Get sources by category
 */
function getSourcesByCategory(categoryName) {
  return getAllSources().filter(s => s.category === categoryName);
}

/**
 * Get source by ID
 */
function getSourceById(id) {
  return getAllSources().find(s => s.id === id);
}

/**
 * Get all PNP sources
 */
function getPNPSources() {
  return getAllSources().filter(s =>
    s.category === 'Provincial Nominee Program' ||
    s.category === 'Territorial Nominee Program' ||
    s.category === 'Quebec Immigration' ||
    s.category === 'Territorial Immigration'
  );
}

/**
 * Get all Express Entry sources
 */
function getExpressEntrySources() {
  return getAllSources().filter(s => s.category === 'Express Entry');
}

module.exports = {
  VISA_SOURCES,
  getAllSources,
  getSourcesByCategory,
  getSourceById,
  getPNPSources,
  getExpressEntrySources
};
