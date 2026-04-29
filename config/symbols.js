// PSX Stock Symbols Configuration
// KMI-30 Shariah-Compliant Stocks Only

const symbols = [
  // === OIL & GAS EXPLORATION ===
  "OGDC",     // Oil & Gas Development Company
  "PPL",      // Pakistan Petroleum Limited
  "MARI",     // Mari Petroleum Company
  "POL",      // Pakistan Oilfields Limited
  
  // === FERTILIZER ===
  "FFC",      // Fauji Fertilizer Company
  "EFERT",    // Engro Fertilizers
  "FATIMA",   // Fatima Fertilizer
  
  // === CEMENT ===
  "LUCK",     // Lucky Cement
  "DGKC",     // D.G. Khan Cement
  "MLCF",     // Maple Leaf Cement
  "CHCC",     // Cherat Cement
  "PIOC",     // Pioneer Cement
  
  // === POWER GENERATION ===
  "HUBC",     // Hub Power Company
  "KAPCO",    // Kot Addu Power Company
  
  // === OIL & GAS MARKETING ===
  "APL",      // Attock Petroleum
  "SHEL",     // Shell Pakistan
  
  // === AUTOMOBILE ===
  "INDU",     // Indus Motor Company
  "HCAR",     // Honda Atlas Cars
  "ATLH",     // Atlas Honda
  "SAZEW",    // Sazgar Engineering Works
  
  // === PHARMACEUTICALS ===
  "SEARL",    // Searle Company
  "GLAXO",    // GlaxoSmithKline Pakistan
  "ABOT",     // Abbott Laboratories
  
  // === CHEMICALS ===
  "LOTCHEM",  // Lotte Chemical Pakistan
  "EPCL",     // Engro Polymer & Chemicals
  "ICI",      // ICI Pakistan
  
  // === FOOD & PERSONAL CARE ===
  "NESTLE",   // Nestle Pakistan
  "COLG",     // Colgate Palmolive
  "NATF",     // National Foods
  
  // === TECHNOLOGY ===
  "SYS",      // Systems Limited
  "TRG",      // TRG Pakistan
  "AVN",      // Avanceon Limited
  
  // === ENGINEERING & STEEL ===
  "ISL",      // International Steels
  "ASTL",     // Amreli Steels
  "MUGHAL",   // Mughal Iron & Steel
  
  // === TEXTILE ===
  "NCL",      // Nishat Chunian
  "NML",      // Nishat Mills
  "GATM",     // Gul Ahmed Textile Mills
  
  // === PAPER & PACKAGING ===
  "PKGS",     // Packages Limited
  
  // === GLASS ===
  "GHGL",     // Ghani Glass
  "TGL",      // Tariq Glass
  
  // === ELECTRONICS ===
  "PAEL",     // Pak Elektron
  
  // === TRANSPORT ===
  "PICT",     // Pakistan International Container Terminal
];

// Stock names mapping
const stockNames = {
  // Oil & Gas
  "OGDC": "Oil & Gas Development Company",
  "PPL": "Pakistan Petroleum Limited",
  "MARI": "Mari Petroleum Company",
  "POL": "Pakistan Oilfields Limited",
  
  // Fertilizer
  "FFC": "Fauji Fertilizer Company",
  "EFERT": "Engro Fertilizers",
  "FATIMA": "Fatima Fertilizer Company",
  
  // Cement
  "LUCK": "Lucky Cement",
  "DGKC": "D.G. Khan Cement",
  "MLCF": "Maple Leaf Cement Factory",
  "CHCC": "Cherat Cement Company",
  "PIOC": "Pioneer Cement",
  
  // Power
  "HUBC": "Hub Power Company",
  "KAPCO": "Kot Addu Power Company",
  
  // Oil Marketing
  "APL": "Attock Petroleum Limited",
  "SHEL": "Shell Pakistan",
  
  // Automobile
  "INDU": "Indus Motor Company",
  "HCAR": "Honda Atlas Cars",
  "ATLH": "Atlas Honda",
  "SAZEW": "Sazgar Engineering Works",
  
  // Pharmaceuticals
  "SEARL": "Searle Company",
  "GLAXO": "GlaxoSmithKline Pakistan",
  "ABOT": "Abbott Laboratories",
  
  // Chemicals
  "LOTCHEM": "Lotte Chemical Pakistan",
  "EPCL": "Engro Polymer & Chemicals",
  "ICI": "ICI Pakistan",
  
  // Food & Personal Care
  "NESTLE": "Nestle Pakistan",
  "COLG": "Colgate Palmolive",
  "NATF": "National Foods",
  
  // Technology
  "SYS": "Systems Limited",
  "TRG": "TRG Pakistan",
  "AVN": "Avanceon Limited",
  
  // Engineering & Steel
  "ISL": "International Steels",
  "ASTL": "Amreli Steels",
  "MUGHAL": "Mughal Iron & Steel",
  
  // Textile
  "NCL": "Nishat Chunian",
  "NML": "Nishat Mills",
  "GATM": "Gul Ahmed Textile Mills",
  
  // Paper & Packaging
  "PKGS": "Packages Limited",
  
  // Glass
  "GHGL": "Ghani Glass",
  "TGL": "Tariq Glass",
  
  // Electronics
  "PAEL": "Pak Elektron",
  
  // Transport
  "PICT": "Pakistan International Container Terminal",
};

// Sector mapping
const sectors = {
  // Oil & Gas
  "OGDC": "Oil & Gas",
  "PPL": "Oil & Gas",
  "MARI": "Oil & Gas",
  "POL": "Oil & Gas",
  
  // Fertilizer
  "FFC": "Fertilizer",
  "EFERT": "Fertilizer",
  "FATIMA": "Fertilizer",
  
  // Cement
  "LUCK": "Cement",
  "DGKC": "Cement",
  "MLCF": "Cement",
  "CHCC": "Cement",
  "PIOC": "Cement",
  
  // Power
  "HUBC": "Power",
  "KAPCO": "Power",
  
  // Oil Marketing
  "APL": "Oil Marketing",
  "SHEL": "Oil Marketing",
  
  // Automobile
  "INDU": "Automobile",
  "HCAR": "Automobile",
  "ATLH": "Automobile",
  "SAZEW": "Automobile",
  
  // Pharmaceuticals
  "SEARL": "Pharma",
  "GLAXO": "Pharma",
  "ABOT": "Pharma",
  
  // Chemicals
  "LOTCHEM": "Chemicals",
  "EPCL": "Chemicals",
  "ICI": "Chemicals",
  
  // Food & Personal Care
  "NESTLE": "Food",
  "COLG": "Personal Care",
  "NATF": "Food",
  
  // Technology
  "SYS": "Technology",
  "TRG": "Technology",
  "AVN": "Technology",
  
  // Steel
  "ISL": "Steel",
  "ASTL": "Steel",
  "MUGHAL": "Steel",
  
  // Textile
  "NCL": "Textile",
  "NML": "Textile",
  "GATM": "Textile",
  
  // Paper
  "PKGS": "Packaging",
  
  // Glass
  "GHGL": "Glass",
  "TGL": "Glass",
  
  // Electronics
  "PAEL": "Electronics",
  
  // Transport
  "PICT": "Port Services",
};

// Market Cap Category
const marketCap = {
  "OGDC": "Large",
  "PPL": "Large",
  "MARI": "Large",
  "POL": "Large",
  "FFC": "Large",
  "EFERT": "Large",
  "LUCK": "Large",
  "HUBC": "Large",
  "INDU": "Large",
  "NESTLE": "Large",
  "SYS": "Large",
  "TRG": "Large",
  "FATIMA": "Mid",
  "DGKC": "Mid",
  "MLCF": "Mid",
  "KAPCO": "Mid",
  "APL": "Mid",
  "SEARL": "Mid",
  "LOTCHEM": "Mid",
  "EPCL": "Mid",
  "ICI": "Mid",
  "PKGS": "Mid",
  "PAEL": "Mid",
  "CHCC": "Small",
  "PIOC": "Small",
  "SHEL": "Small",
  "HCAR": "Small",
  "ATLH": "Small",
  "SAZEW": "Small",
  "GLAXO": "Small",
  "ABOT": "Small",
  "COLG": "Small",
  "NATF": "Small",
  "AVN": "Small",
  "ISL": "Small",
  "ASTL": "Small",
  "MUGHAL": "Small",
  "NCL": "Small",
  "NML": "Small",
  "GATM": "Small",
  "GHGL": "Small",
  "TGL": "Small",
  "PICT": "Small",
};

module.exports = {
  symbols,
  stockNames,
  sectors,
  marketCap,
};