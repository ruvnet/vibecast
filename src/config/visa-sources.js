/**
 * Canadian Immigration Visa Sources Configuration
 * Contains all official immigration program URLs for tracking requirements and conditions
 * Includes detailed eligibility requirements for each program
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
      eligibility: {
        minimumRequirements: [
          'Have at least 1 year of continuous full-time (or equivalent part-time) skilled work experience in the past 10 years',
          'Work experience must be in NOC TEER 0, 1, 2, or 3 occupation',
          'Meet minimum language levels of CLB 7 in all abilities for NOC TEER 0 or 1 jobs',
          'Meet minimum language levels of CLB 5 in all abilities for NOC TEER 2 or 3 jobs',
          'Have a Canadian high school credential or foreign credential with ECA showing equivalency',
          'Score at least 67 points on the FSW points grid'
        ],
        pointsGrid: {
          language: { max: 28, description: 'First official language (max 24) + Second language (max 4)' },
          education: { max: 25, description: 'Highest level of education' },
          workExperience: { max: 15, description: 'Years of skilled work experience' },
          age: { max: 12, description: 'Age at time of application' },
          arrangedEmployment: { max: 10, description: 'Valid job offer in Canada' },
          adaptability: { max: 10, description: 'Spouse factors, Canadian experience, relatives' }
        },
        passingScore: 67,
        language: {
          minimum: 'CLB 7 for TEER 0/1, CLB 5 for TEER 2/3',
          acceptedTests: ['IELTS General Training', 'CELPIP General', 'TEF Canada', 'TCF Canada']
        },
        workExperience: {
          minimum: '1 year continuous full-time or equivalent',
          recency: 'Within last 10 years',
          type: 'Skilled work in NOC TEER 0, 1, 2, or 3'
        },
        education: {
          minimum: 'Canadian secondary (high school) or foreign equivalent with ECA',
          ecaRequired: true
        },
        proofOfFunds: {
          required: true,
          exception: 'Not required if currently authorized to work in Canada and have valid job offer'
        }
      },
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
      eligibility: {
        minimumRequirements: [
          'Have at least 2 years of full-time work experience (or equivalent part-time) in a skilled trade within the last 5 years',
          'Meet the job requirements for that skilled trade as set out in the NOC',
          'Have CLB 5 for speaking and listening, CLB 4 for reading and writing',
          'Have a valid job offer of full-time employment for at least 1 year OR a certificate of qualification in your trade from a Canadian provincial/territorial authority'
        ],
        eligibleTrades: [
          'Major Group 72: Industrial, electrical and construction trades',
          'Major Group 73: Maintenance and equipment operation trades',
          'Major Group 82: Supervisors in natural resources, agriculture',
          'Major Group 92: Processing, manufacturing and utilities supervisors',
          'Minor Group 632: Chefs and cooks',
          'Minor Group 633: Butchers and bakers'
        ],
        language: {
          speaking: 'CLB 5',
          listening: 'CLB 5',
          reading: 'CLB 4',
          writing: 'CLB 4',
          acceptedTests: ['IELTS General Training', 'CELPIP General', 'TEF Canada', 'TCF Canada']
        },
        workExperience: {
          minimum: '2 years full-time or equivalent',
          recency: 'Within last 5 years',
          type: 'Skilled trade occupation'
        },
        jobOfferOrCertificate: {
          required: true,
          options: [
            'Valid job offer of full-time employment for at least 1 year',
            'Certificate of qualification issued by Canadian provincial/territorial authority'
          ]
        },
        proofOfFunds: {
          required: true,
          exception: 'Not required if currently authorized to work in Canada'
        }
      },
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
      eligibility: {
        minimumRequirements: [
          'Have at least 1 year of skilled work experience in Canada within the last 3 years',
          'Work experience must be in NOC TEER 0, 1, 2, or 3',
          'Have gained experience in Canada with proper authorization',
          'Meet required language levels for your NOC job category',
          'Plan to live outside Quebec'
        ],
        language: {
          teer0or1: 'CLB 7 in all 4 abilities',
          teer2or3: 'CLB 5 in all 4 abilities',
          acceptedTests: ['IELTS General Training', 'CELPIP General', 'TEF Canada', 'TCF Canada']
        },
        workExperience: {
          minimum: '1 year (1,560 hours total or 30 hours/week for 12 months)',
          recency: 'Within last 3 years before applying',
          type: 'Skilled work in Canada (NOC TEER 0, 1, 2, or 3)',
          requirements: [
            'Full-time at single job OR part-time equivalent',
            'Paid work experience (volunteer/unpaid not counted)',
            'While authorized to work in Canada',
            'Self-employment does not count'
          ]
        },
        notEligible: [
          'Work experience while full-time student (co-op, internship)',
          'Self-employment',
          'Volunteer or unpaid work',
          'Work not authorized in Canada'
        ],
        proofOfFunds: {
          required: false,
          note: 'Not required for CEC applicants'
        }
      },
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
      eligibility: {
        crsFactors: {
          coreHumanCapital: {
            maxWithSpouse: 460,
            maxWithoutSpouse: 500,
            factors: ['Age', 'Education', 'Language proficiency', 'Canadian work experience']
          },
          spouseFactors: {
            max: 40,
            factors: ['Education', 'Language proficiency', 'Canadian work experience']
          },
          skillTransferability: {
            max: 100,
            factors: ['Education + Language', 'Education + Canadian experience', 'Foreign experience + Language', 'Foreign experience + Canadian experience', 'Certificate of qualification + Language']
          },
          additionalPoints: {
            max: 600,
            factors: [
              'Provincial nomination (600 points)',
              'Valid job offer TEER 0 (200 points)',
              'Valid job offer TEER 1/2/3 (50 points)',
              'Canadian education (15-30 points)',
              'French language proficiency (up to 50 points)',
              'Sibling in Canada (15 points)'
            ]
          }
        },
        maximumScore: 1200,
        invitationRounds: 'IRCC conducts regular draws from pool',
        tieBreaker: 'Date and time profile submitted to pool'
      },
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
      eligibility: {
        acceptedTests: {
          english: [
            { name: 'IELTS General Training', organization: 'IELTS' },
            { name: 'CELPIP General', organization: 'Paragon Testing Enterprises' }
          ],
          french: [
            { name: 'TEF Canada', organization: 'Paris Chamber of Commerce' },
            { name: 'TCF Canada', organization: 'France Éducation international' }
          ]
        },
        validity: '2 years from test date',
        clbConversion: {
          description: 'Test scores convert to Canadian Language Benchmarks (CLB)',
          minimumCLB: 'Varies by program (CLB 4-7 depending on stream)'
        },
        requirements: [
          'Must take approved test for primary language',
          'Optional second language test for additional CRS points',
          'Results must be valid when applying and when ITA received',
          'Must include test in Express Entry profile'
        ]
      },
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
      eligibility: {
        economicStreams: [
          'Federal Skilled Worker Program',
          'Federal Skilled Trades Program',
          'Canadian Experience Class',
          'Provincial Nominee Program',
          'Quebec Skilled Workers',
          'Atlantic Immigration Program',
          'Rural and Northern Immigration Pilot',
          'Agri-Food Pilot',
          'Start-up Visa Program',
          'Self-employed Persons Program'
        ],
        commonRequirements: [
          'Meet program-specific eligibility criteria',
          'Pass medical examination',
          'Obtain police certificates',
          'Prove admissibility to Canada',
          'Show intent to reside in Canada'
        ]
      },
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
      eligibility: {
        generalRequirements: [
          'Be a citizen of a country/territory with an IEC agreement',
          'Be between 18 and 35 years old (varies by country)',
          'Have a valid passport for duration of stay',
          'Have health insurance for duration of stay',
          'Have enough money to support yourself',
          'Be admissible to Canada',
          'Pay program fees'
        ],
        categories: {
          workingHoliday: {
            description: 'Open work permit to travel and work anywhere in Canada',
            requirements: ['No pre-arranged job required', 'Cannot work for same employer more than 6 months usually'],
            duration: 'Up to 12-24 months depending on country'
          },
          youngProfessionals: {
            description: 'Employer-specific work permit for career development',
            requirements: ['Must have job offer in your field of study/career', 'Job must contribute to professional development'],
            duration: 'Up to 12-24 months depending on country'
          },
          internationalCoop: {
            description: 'Employer-specific work permit for students',
            requirements: ['Must be registered at post-secondary institution', 'Internship must be required for studies'],
            duration: 'Up to 12 months'
          }
        },
        ageRequirements: {
          standard: '18-35 years old',
          exceptions: 'Some countries have different age limits (check specific bilateral agreement)'
        },
        participatingCountries: 'Over 35 countries with bilateral youth mobility agreements'
      },
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
      eligibility: {
        types: {
          employerSpecific: {
            description: 'Work for specific employer, location, and job',
            requirements: ['Labour Market Impact Assessment (LMIA) from employer OR', 'LMIA-exempt job offer']
          },
          openWorkPermit: {
            description: 'Work for any employer in Canada',
            eligibleFor: [
              'Spouses/partners of skilled workers or students',
              'Post-graduation work permit holders',
              'Refugee claimants',
              'Certain vulnerable workers'
            ]
          }
        },
        generalRequirements: [
          'Prove you will leave Canada when permit expires',
          'Show sufficient funds for stay and return',
          'Have no criminal record',
          'Not be a danger to Canada\'s security',
          'Be in good health (medical exam may be required)',
          'Not plan to work for ineligible employer'
        ],
        lmiaExemptions: [
          'International agreements (CUSMA, CETA)',
          'Canadian interests (significant benefit)',
          'Charitable or religious work',
          'Reciprocal employment',
          'Intra-company transferees'
        ]
      },
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
      eligibility: {
        minimumRequirements: [
          'Be enrolled at a Designated Learning Institution (DLI)',
          'Prove you have enough money to pay for tuition, living expenses, and return transportation',
          'Have no criminal record and obtain police certificate',
          'Be in good health and complete medical exam if required',
          'Prove to officer you will leave Canada when permit expires',
          'Obtain Provincial Attestation Letter (PAL) if required'
        ],
        financialRequirements: {
          tuition: 'First year tuition fees',
          livingCosts: {
            outsideQuebec: '$20,635 CAD per year (as of 2024)',
            insideQuebec: '$15,832 CAD per year'
          },
          additionalFamily: '$4,000+ per family member'
        },
        palRequirement: {
          description: 'Provincial Attestation Letter required for most study permit applications',
          exceptions: ['K-12 students', 'Master\'s/Doctoral students', 'Permit renewals', 'Exchange students']
        },
        workWhileStudying: {
          onCampus: 'Unlimited hours while classes in session',
          offCampus: 'Up to 20 hours/week during sessions (24 hrs as of Nov 2024 change)',
          breaks: 'Full-time during scheduled breaks'
        }
      },
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
      eligibility: {
        requirement: {
          effective: 'January 22, 2024',
          description: 'Most study permit applicants need a PAL from the province/territory where they plan to study'
        },
        exemptions: [
          'Primary and secondary school (K-12) students',
          'Master\'s degree students',
          'Doctoral degree students',
          'Study permit extensions/renewals',
          'Applicants with work permits transitioning to study',
          'Family members of work/study permit holders',
          'Exchange or visiting students'
        ],
        howToObtain: [
          'Apply directly to the province/territory',
          'DLI may assist with application',
          'Each province has its own process and portal'
        ],
        processingVaries: 'Each province has different processing times and requirements'
      },
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
      eligibility: {
        minimumRequirements: [
          'Graduated from eligible DLI',
          'Completed program of at least 8 months',
          'Maintained full-time student status',
          'Apply within 180 days of receiving final marks/completion letter',
          'Have valid study permit or had one that expired within 180 days',
          'Meet field of study requirements (if applicable)'
        ],
        eligiblePrograms: {
          publicInstitutions: ['Universities', 'Colleges', 'CEGEPs', 'Polytechnics'],
          privateInstitutions: 'Quebec private institutions operating under same rules as public',
          minimumDuration: '8 months (not including ESL/FSL)',
          fieldOfStudyRequirement: 'Certain fields eligible for 3-year PGWP regardless of program length'
        },
        permitDuration: {
          '8monthsTo2years': 'PGWP length equals program length',
          '2yearsOrMore': 'Up to 3-year PGWP',
          'eligibleFields': '3-year PGWP for certain high-demand occupations regardless of program length'
        },
        notEligible: [
          'ESL/FSL programs only',
          'Programs less than 8 months',
          'Distance learning more than 50% of program',
          'Part-time studies',
          'Programs funded by Global Affairs Canada'
        ],
        applicationDeadline: '180 days from receiving written confirmation of completion'
      },
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
      eligibility: {
        studentRequirements: [
          'Valid study permit holder',
          'Full-time student at eligible DLI',
          'Enrolled in eligible program (graduate level or specific professional programs)'
        ],
        eligiblePrograms: {
          graduate: ['Master\'s programs', 'Doctoral programs'],
          professional: ['Law (LLB, JD, LLL)', 'Medicine (MD)', 'Other professional degrees as specified']
        },
        restrictions: {
          effective: 'March 19, 2024',
          description: 'Spouse open work permits now limited to spouses of students in graduate programs or certain professional programs'
        },
        spouseRequirements: [
          'Valid passport',
          'Proof of relationship',
          'Meet standard admissibility requirements',
          'Apply from inside or outside Canada'
        ],
        permitType: 'Open work permit (any employer)',
        validity: 'Same as student\'s study permit validity'
      },
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
      eligibility: {
        whoNeeds: [
          'Citizens of countries not visa-exempt',
          'Travelers transiting through Canada (unless transit-exempt)',
          'Former permanent residents'
        ],
        visaExempt: [
          'US citizens',
          'Citizens of visa-exempt countries (need eTA instead)',
          'Certain diplomatic passport holders'
        ],
        requirements: [
          'Valid travel document/passport',
          'Good health (may need medical exam)',
          'No criminal or immigration-related convictions',
          'Convince officer of ties to home country',
          'Prove sufficient funds for stay',
          'Prove intent to leave Canada'
        ],
        financialProof: [
          'Bank statements',
          'Employment letter',
          'Property ownership',
          'Invitation letter from Canadian host'
        ],
        types: {
          singleEntry: 'One entry to Canada',
          multipleEntry: 'Multiple entries until visa expires (max 10 years or passport expiry)'
        },
        stayDuration: 'Usually up to 6 months (officer decides at port of entry)'
      },
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
      eligibility: {
        streams: {
          employerJobOffer: {
            name: 'Employer Job Offer Category',
            streams: ['Foreign Worker', 'International Student', 'In-Demand Skills'],
            requirements: ['Valid job offer from Ontario employer', 'Meet stream-specific criteria']
          },
          humanCapital: {
            name: 'Human Capital Category',
            streams: ['French-Speaking Skilled Worker', 'Human Capital Priorities', 'Skilled Trades', 'Masters Graduate', 'PhD Graduate'],
            requirements: ['Express Entry profile for some streams', 'Meet education/language/work requirements']
          },
          business: {
            name: 'Business Category',
            streams: ['Entrepreneur'],
            requirements: ['Minimum net worth', 'Business investment requirements', 'Job creation']
          }
        },
        commonRequirements: [
          'Intent to live and work in Ontario',
          'Meet minimum language requirements (CLB varies by stream)',
          'Legal status in Canada (if applying from within)',
          'Meet education requirements for stream'
        ],
        expressEntryLinked: ['Human Capital Priorities', 'French-Speaking Skilled Worker', 'Skilled Trades'],
        processingTime: 'Varies by stream (check OINP website)',
        applicationMethod: 'OINP e-Filing Portal'
      },
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
      eligibility: {
        streams: {
          skillsImmigration: {
            name: 'Skills Immigration',
            categories: ['Skilled Worker', 'Healthcare Professional', 'International Graduate', 'International Post-Graduate', 'Entry Level and Semi-Skilled'],
            requirements: ['Job offer from BC employer (most categories)', 'Meet wage requirements', 'Language proficiency']
          },
          expressEntryBC: {
            name: 'Express Entry BC',
            categories: ['Skilled Worker', 'Healthcare Professional', 'International Graduate', 'International Post-Graduate'],
            requirements: ['Valid Express Entry profile', 'Meet category requirements', 'Higher CRS score advantage']
          },
          entrepreneurImmigration: {
            name: 'Entrepreneur Immigration',
            categories: ['Base Category', 'Regional Pilot'],
            requirements: ['Minimum net worth', 'Business investment', 'Job creation', 'Business experience']
          }
        },
        scoringSystem: {
          name: 'Skills Immigration Registration System (SIRS)',
          factors: ['Economic factors', 'Human capital factors', 'Regional requirements'],
          maxScore: 200
        },
        prioritySectors: ['Tech', 'Healthcare', 'Construction', 'Childcare'],
        commonRequirements: [
          'Eligible occupation',
          'Job offer from BC employer (most streams)',
          'Meet language requirements',
          'Intent to live and work in BC'
        ]
      },
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
      eligibility: {
        streams: {
          albertaOpportunity: {
            name: 'Alberta Opportunity Stream',
            requirements: [
              'Working in Alberta with valid work permit',
              'Minimum 12 months full-time work in Alberta',
              'Meet occupation requirements',
              'CLB 4 minimum (CLB 5 for NOC TEER 0,1,2,3)',
              'High school education minimum'
            ]
          },
          albertaExpress: {
            name: 'Alberta Express Entry Stream',
            requirements: [
              'Active Express Entry profile',
              'CRS score 300+',
              'Work experience in eligible occupation',
              'Strong ties to Alberta'
            ]
          },
          acceleratedTechPathway: {
            name: 'Accelerated Tech Pathway',
            requirements: [
              'Work in eligible tech occupation',
              'Job offer from Alberta employer',
              'Meet education and experience requirements'
            ]
          },
          tourismHospitality: {
            name: 'Tourism and Hospitality Stream',
            requirements: [
              'Work in eligible tourism/hospitality occupation',
              'Alberta work experience',
              'Job offer in sector'
            ]
          },
          ruralRenewal: {
            name: 'Rural Renewal Stream',
            requirements: [
              'Job offer from rural Alberta employer',
              'Community endorsement',
              'Meet basic requirements'
            ]
          }
        },
        commonRequirements: [
          'Intent to live and work in Alberta',
          'Valid work permit or authorization to work',
          'Meet language requirements for stream',
          'Meet education requirements'
        ],
        ineligibleOccupations: 'Certain occupations not eligible (check AAIP website)'
      },
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
      eligibility: {
        streams: {
          internationalSkilledWorker: {
            name: 'International Skilled Worker Category',
            subcategories: ['Employment Offer', 'Occupation In-Demand', 'Express Entry', 'Hard-to-Fill Skills Pilot'],
            requirements: ['Skilled work experience', 'Education credential', 'Language proficiency', 'Points assessment (60/100)']
          },
          experience: {
            name: 'Saskatchewan Experience Category',
            subcategories: ['Existing Work Permit', 'Health Professionals', 'Hospitality Sector Project', 'Long-Haul Truck Driver', 'Students'],
            requirements: ['Current work in Saskatchewan', 'Valid work permit', 'Meet subcategory requirements']
          },
          entrepreneur: {
            name: 'Entrepreneur and Farm Category',
            subcategories: ['Entrepreneur', 'Farm Owner/Operator', 'International Graduate Entrepreneur'],
            requirements: ['Minimum net worth', 'Business investment plan', 'Business experience']
          }
        },
        pointsGrid: {
          factors: ['Education', 'Work experience', 'Language', 'Age', 'Saskatchewan connections'],
          passingScore: 60,
          maxScore: 100
        },
        inDemandOccupations: 'List updated regularly - check SINP website',
        commonRequirements: [
          'Intent to live in Saskatchewan',
          'Meet stream-specific requirements',
          'Score 60+ points (for points-based streams)',
          'Language test results'
        ]
      },
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
      eligibility: {
        streams: {
          skilledWorkerOverseas: {
            name: 'Skilled Worker Overseas',
            pathways: ['Manitoba Express Entry Pathway', 'Human Capital Pathway'],
            requirements: ['Connection to Manitoba OR in-demand occupation', 'Work experience', 'Language proficiency', 'Age factor']
          },
          skilledWorkerInManitoba: {
            name: 'Skilled Worker in Manitoba',
            requirements: ['Currently working in Manitoba', 'Minimum 6 months employment', 'Long-term job offer', 'Language proficiency']
          },
          internationalEducation: {
            name: 'International Education Stream',
            pathways: ['Career Employment Pathway', 'Graduate Internship Pathway', 'International Student Entrepreneur Pilot'],
            requirements: ['Manitoba graduate', 'Employment or business plan', 'Settlement funds']
          },
          businessInvestor: {
            name: 'Business Investor Stream',
            pathways: ['Entrepreneur Pathway', 'Farm Investor Pathway'],
            requirements: ['Minimum net worth', 'Business experience', 'Investment plan']
          }
        },
        pointsAssessment: {
          factors: ['Language', 'Age', 'Work experience', 'Education', 'Adaptability', 'Risk assessment'],
          usedFor: 'Skilled Worker Overseas stream'
        },
        manitobaConnection: {
          types: ['Family', 'Previous Manitoba education', 'Previous Manitoba work', 'Community support', 'Strategic recruitment'],
          importance: 'Strong connection to Manitoba improves chances'
        }
      },
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
      eligibility: {
        programs: {
          regularSkilledWorker: {
            name: 'Regular Skilled Worker Program (RSWP)',
            requirements: [
              'Selection grid score',
              'Valid job offer or Quebec diploma preferred',
              'French language proficiency strongly weighted',
              'Work experience'
            ],
            selectionFactors: ['Education', 'Work experience', 'Age', 'Language', 'Stay in Quebec', 'Family connections', 'Validated job offer', 'Quebec diploma']
          },
          quebecExperience: {
            name: 'Quebec Experience Program (PEQ)',
            pathways: {
              foreignGraduate: ['Quebec diploma', 'French intermediate-advanced level'],
              foreignWorker: ['24 months skilled work in Quebec (last 36 months)', 'French intermediate-advanced level']
            }
          }
        },
        arrima: {
          name: 'Arrima Expression of Interest System',
          description: 'Portal for submitting immigration interest to Quebec',
          process: ['Create profile', 'Receive invitation', 'Submit application']
        },
        frenchLanguage: {
          importance: 'Critical factor in Quebec immigration',
          levels: 'Intermediate-advanced French significantly improves selection chances',
          tests: ['TEF', 'TCF', 'TEFAQ', 'TCFQ']
        },
        uniqueProcess: 'Quebec selects its own immigrants; candidates receive CSQ then apply for federal PR'
      },
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
      eligibility: {
        streams: {
          skilledWorkerExpressEntry: {
            name: 'NB Skilled Worker (Express Entry)',
            requirements: ['Express Entry profile', 'Connection to NB', 'Work experience in NOC TEER 0/1/2/3', 'CLB 7 minimum']
          },
          skilledWorkerEmployerSupport: {
            name: 'Skilled Worker with Employer Support',
            requirements: ['Full-time permanent job offer', 'Work experience', 'Language proficiency', 'Education']
          },
          postGraduate: {
            name: 'Post-Graduate Entrepreneurial Stream',
            requirements: ['NB post-secondary graduate', 'Business plan', 'Operate business for 1 year']
          },
          entrepreneurial: {
            name: 'Entrepreneurial Stream',
            requirements: ['Net worth $600,000+', 'Business experience', 'Investment $250,000+', 'Job creation']
          },
          strategicInitiative: {
            name: 'Strategic Initiative',
            requirements: ['French-speaking', 'Work experience', 'Language proficiency', 'Community connection'],
            target: 'Francophone applicants'
          },
          criticalWorker: {
            name: 'Critical Worker Pilot',
            requirements: ['Job offer in eligible occupation', 'Work experience', 'Basic language skills'],
            target: 'Addresses labour shortages'
          },
          atlanticPilot: {
            name: 'Atlantic Immigration Program (AIP)',
            requirements: ['Designated employer job offer', 'Work experience', 'Language CLB 4-5', 'Settlement plan']
          }
        },
        commonRequirements: [
          'Intent to live in New Brunswick',
          'Meet stream-specific requirements',
          'Language proficiency',
          'Education credential'
        ]
      },
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
      eligibility: {
        streams: {
          labourMarketPriorities: {
            name: 'Labour Market Priorities',
            requirements: ['Express Entry profile', 'CRS score threshold', 'Work experience in priority occupation'],
            targetOccupations: 'Healthcare, trades, and other in-demand occupations'
          },
          physicianStream: {
            name: 'Physician Stream',
            requirements: ['Job offer from NS Health Authority', 'Medical license eligibility', 'Commitment to practice in NS']
          },
          skilledWorker: {
            name: 'Skilled Worker Stream',
            requirements: ['Permanent full-time job offer', 'Relevant work experience', 'CLB 5 minimum']
          },
          occupationInDemand: {
            name: 'Occupation In-Demand',
            requirements: ['Job offer in eligible occupation', 'Minimum 1 year experience', 'High school education', 'CLB 4 minimum']
          },
          internationalGraduateEntrepreneur: {
            name: 'International Graduate Entrepreneur',
            requirements: ['NS post-secondary graduate', 'Business ownership and operation', 'Net worth requirements']
          },
          entrepreneur: {
            name: 'Entrepreneur Stream',
            requirements: ['Net worth $600,000+', 'Business experience 3+ years', 'Investment and active management']
          },
          atlanticPilot: {
            name: 'Atlantic Immigration Program (AIP)',
            requirements: ['Designated employer job offer', 'Work experience', 'Language CLB 4-5', 'Settlement plan']
          }
        },
        expressEntryLinked: ['Labour Market Priorities', 'Labour Market Priorities for Physicians'],
        commonRequirements: [
          'Intent to live in Nova Scotia',
          'Meet stream requirements',
          'Valid language test (where required)'
        ]
      },
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
      eligibility: {
        streams: {
          peiExpressEntry: {
            name: 'PEI Express Entry',
            requirements: ['Express Entry profile', 'Work experience', 'Connection to PEI', 'CLB 7 minimum'],
            connection: 'Job offer, previous PEI work/study, or family in PEI'
          },
          labourImpact: {
            name: 'Labour Impact Category',
            subcategories: ['Skilled Worker', 'Critical Worker', 'International Graduate'],
            requirements: ['Job offer from PEI employer', 'Relevant experience', 'Language proficiency']
          },
          businessImpact: {
            name: 'Business Impact Category',
            subcategories: ['Work Permit Stream', 'Entrepreneur Stream'],
            requirements: ['Net worth requirements', 'Business experience', 'Investment commitment', 'Job creation']
          }
        },
        expressionOfInterest: {
          system: 'EOI-based selection',
          factors: ['Age', 'Language', 'Education', 'Work experience', 'Employment', 'Adaptability']
        },
        commonRequirements: [
          'Intent to live in PEI',
          'Meet stream requirements',
          'Valid immigration status (if in Canada)',
          'Language test results'
        ]
      },
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
      eligibility: {
        streams: {
          expressEntry: {
            name: 'Express Entry Skilled Worker',
            requirements: ['Express Entry profile', 'Job offer from NL employer', 'Skilled work experience', 'CLB 7 minimum']
          },
          skilledWorker: {
            name: 'Skilled Worker Category',
            requirements: ['Full-time job offer', 'Relevant work experience', 'Post-secondary education', 'CLB 5 minimum']
          },
          internationalGraduate: {
            name: 'International Graduate Category',
            requirements: ['Graduated from Canadian post-secondary', 'Job offer from NL employer', 'CLB 5 minimum']
          },
          internationalEntrepreneur: {
            name: 'International Entrepreneur Category',
            requirements: ['Net worth $600,000+', 'Business experience', 'Business plan', 'Investment commitment']
          },
          internationalGraduateEntrepreneur: {
            name: 'International Graduate Entrepreneur Category',
            requirements: ['NL post-secondary graduate', 'Business experience', 'Business plan for NL']
          },
          prioritySkills: {
            name: 'Priority Skills NL',
            requirements: ['In-demand occupation', 'Work experience', 'Language proficiency'],
            targetSectors: 'Healthcare, aquaculture, agriculture, tech'
          },
          atlanticPilot: {
            name: 'Atlantic Immigration Program (AIP)',
            requirements: ['Designated employer job offer', 'Work experience', 'Language CLB 4-5', 'Settlement plan']
          }
        },
        commonRequirements: [
          'Intent to live in Newfoundland and Labrador',
          'Meet category requirements',
          'Have valid immigration status',
          'Language proficiency'
        ]
      },
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
      eligibility: {
        streams: {
          employerDriven: {
            name: 'Employer Driven Stream',
            requirements: ['Job offer from NWT employer', 'Work experience', 'Language CLB 4-5 minimum', 'High school education'],
            subcategories: ['Skilled Worker', 'Entry Level/Semi-Skilled Worker']
          },
          businessDriven: {
            name: 'Business Driven Stream',
            requirements: ['Business experience', 'Net worth $500,000+', 'Investment $300,000+', 'Job creation'],
            process: 'Business visit, application, work permit, then nomination'
          },
          expressEntry: {
            name: 'Express Entry Stream',
            requirements: ['Express Entry profile', 'Connection to NWT', 'Work experience', 'Language proficiency']
          },
          francophone: {
            name: 'Francophone Stream',
            requirements: ['French as first official language', 'Work experience', 'Job offer or connection'],
            target: 'French-speaking applicants'
          }
        },
        commonRequirements: [
          'Intent to live in NWT',
          'Valid immigration status',
          'Meet stream requirements',
          'Settlement funds'
        ]
      },
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
      eligibility: {
        streams: {
          skilledWorker: {
            name: 'Yukon Skilled Worker',
            requirements: ['Job offer from Yukon employer', 'Relevant work experience', 'Education', 'Language proficiency'],
            employerRequirements: 'Employer must demonstrate recruitment efforts'
          },
          criticalImpactWorker: {
            name: 'Critical Impact Worker',
            requirements: ['Job offer in critical occupation', 'Language CLB 4', 'Work experience'],
            targetOccupations: 'Entry-level and semi-skilled occupations'
          },
          businessNominee: {
            name: 'Yukon Business Nominee',
            requirements: ['Net worth $500,000+', 'Business experience', 'Investment', 'Job creation', 'Exploratory visit'],
            process: 'EOI, interview, work permit, then nomination'
          },
          yukonExpressEntry: {
            name: 'Yukon Express Entry',
            requirements: ['Express Entry profile', 'Job offer from Yukon employer', 'Skilled work experience'],
            occupation: 'NOC TEER 0, 1, 2, or 3'
          },
          yukonCommunityPilot: {
            name: 'Yukon Community Pilot',
            requirements: ['Job offer from participating community', 'Community endorsement', 'Language proficiency'],
            communities: 'Specific Yukon communities'
          }
        },
        commonRequirements: [
          'Intent to live in Yukon',
          'Meet stream requirements',
          'Valid work authorization (if in Canada)',
          'Settlement funds'
        ]
      },
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
      eligibility: {
        note: 'Nunavut does not have a Provincial Nominee Program',
        pathways: [
          'Federal immigration programs (Express Entry, etc.)',
          'Employer-sponsored work permits',
          'Family sponsorship'
        ],
        workOpportunities: {
          sectors: ['Mining', 'Government', 'Healthcare', 'Education', 'Construction'],
          employers: 'Contact Nunavut employers directly for job opportunities'
        },
        federalPrograms: [
          'Express Entry',
          'Atlantic Immigration Program (limited)',
          'Rural and Northern Immigration Pilot (if applicable)'
        ],
        considerations: [
          'Remote northern location',
          'High cost of living',
          'Limited services compared to southern Canada',
          'Unique cultural environment'
        ]
      },
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
      eligibility: null, // News source, no eligibility requirements
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
      eligibility: null, // News source, no eligibility requirements
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

/**
 * Get eligibility requirements for a specific program
 */
function getEligibility(id) {
  const source = getSourceById(id);
  return source?.eligibility || null;
}

/**
 * Get all programs with their eligibility summaries
 */
function getAllEligibilitySummaries() {
  return getAllSources()
    .filter(s => s.eligibility)
    .map(s => ({
      id: s.id,
      name: s.name,
      category: s.category,
      province: s.province || null,
      eligibility: s.eligibility
    }));
}

module.exports = {
  VISA_SOURCES,
  getAllSources,
  getSourcesByCategory,
  getSourceById,
  getPNPSources,
  getExpressEntrySources,
  getEligibility,
  getAllEligibilitySummaries
};
