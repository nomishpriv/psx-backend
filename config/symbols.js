// PSX Stock Symbols Configuration
// Shariah-Compliant Stocks Only (KMI-30 + others)

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
  "PSO",      // Pakistan State Oil

  // === AUTOMOBILE ===
  "INDU",     // Indus Motor Company
  "HCAR",     // Honda Atlas Cars
  "ATLH",     // Atlas Honda
  "SAZEW",    // Sazgar Engineering Works

  // === PHARMACEUTICALS ===
  "SEARL",    // Searle Company
  "GLAXO",    // GlaxoSmithKline Pakistan
  "ABOT",     // Abbott Laboratories
  "AGP",      // AGP Limited

  // === CHEMICALS ===
  "LOTCHEM",  // Lotte Chemical Pakistan
  "EPCL",     // Engro Polymer & Chemicals
  "ICI",      // ICI Pakistan
  "COLG",     // Colgate Palmolive

  // === FOOD & PERSONAL CARE ===
  "NESTLE",   // Nestle Pakistan
  "NATF",     // National Foods

  // === TECHNOLOGY ===
  "SYS",      // Systems Limited
  "TRG",      // TRG Pakistan
  "AVN",      // Avanceon Limited

  // === BANKING (Islamic) ===
  "MEBL",     // Meezan Bank Limited
  "BIPL",     // Bank Islami Pakistan

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

const stockNames = {
  "OGDC": "Oil & Gas Development Company",
  "PPL": "Pakistan Petroleum Limited",
  "MARI": "Mari Petroleum Company",
  "POL": "Pakistan Oilfields Limited",
  "FFC": "Fauji Fertilizer Company",
  "EFERT": "Engro Fertilizers",
  "FATIMA": "Fatima Fertilizer Company",
  "LUCK": "Lucky Cement",
  "DGKC": "D.G. Khan Cement",
  "MLCF": "Maple Leaf Cement Factory",
  "CHCC": "Cherat Cement Company",
  "PIOC": "Pioneer Cement",
  "HUBC": "Hub Power Company",
  "KAPCO": "Kot Addu Power Company",
  "APL": "Attock Petroleum Limited",
  "SHEL": "Shell Pakistan",
  "PSO": "Pakistan State Oil",
  "INDU": "Indus Motor Company",
  "HCAR": "Honda Atlas Cars",
  "ATLH": "Atlas Honda",
  "SAZEW": "Sazgar Engineering Works",
  "SEARL": "Searle Company",
  "GLAXO": "GlaxoSmithKline Pakistan",
  "ABOT": "Abbott Laboratories",
  "AGP": "AGP Limited",
  "LOTCHEM": "Lotte Chemical Pakistan",
  "EPCL": "Engro Polymer & Chemicals",
  "ICI": "ICI Pakistan",
  "COLG": "Colgate Palmolive",
  "NESTLE": "Nestle Pakistan",
  "NATF": "National Foods",
  "SYS": "Systems Limited",
  "TRG": "TRG Pakistan",
  "AVN": "Avanceon Limited",
  "MEBL": "Meezan Bank Limited",
  "BIPL": "Bank Islami Pakistan",
  "ISL": "International Steels",
  "ASTL": "Amreli Steels",
  "MUGHAL": "Mughal Iron & Steel",
  "NCL": "Nishat Chunian",
  "NML": "Nishat Mills",
  "GATM": "Gul Ahmed Textile Mills",
  "PKGS": "Packages Limited",
  "GHGL": "Ghani Glass",
  "TGL": "Tariq Glass",
  "PAEL": "Pak Elektron",
  "PICT": "Pakistan International Container Terminal",
};

const sectors = {
  "OGDC": "Oil & Gas",
  "PPL": "Oil & Gas",
  "MARI": "Oil & Gas",
  "POL": "Oil & Gas",
  "FFC": "Fertilizer",
  "EFERT": "Fertilizer",
  "FATIMA": "Fertilizer",
  "LUCK": "Cement",
  "DGKC": "Cement",
  "MLCF": "Cement",
  "CHCC": "Cement",
  "PIOC": "Cement",
  "HUBC": "Power",
  "KAPCO": "Power",
  "APL": "Oil Marketing",
  "SHEL": "Oil Marketing",
  "PSO": "Oil Marketing",
  "INDU": "Automobile",
  "HCAR": "Automobile",
  "ATLH": "Automobile",
  "SAZEW": "Automobile",
  "SEARL": "Pharma",
  "GLAXO": "Pharma",
  "ABOT": "Pharma",
  "AGP": "Pharma",
  "LOTCHEM": "Chemicals",
  "EPCL": "Chemicals",
  "ICI": "Chemicals",
  "COLG": "Personal Care",
  "NESTLE": "Food",
  "NATF": "Food",
  "SYS": "Technology",
  "TRG": "Technology",
  "AVN": "Technology",
  "MEBL": "Banking",
  "BIPL": "Banking",
  "ISL": "Steel",
  "ASTL": "Steel",
  "MUGHAL": "Steel",
  "NCL": "Textile",
  "NML": "Textile",
  "GATM": "Textile",
  "PKGS": "Packaging",
  "GHGL": "Glass",
  "TGL": "Glass",
  "PAEL": "Electronics",
  "PICT": "Port Services",
};

const marketCap = {
  "OGDC": "Large", "PPL": "Large", "MARI": "Large", "POL": "Large",
  "FFC": "Large", "EFERT": "Large", "LUCK": "Large", "HUBC": "Large",
  "INDU": "Large", "NESTLE": "Large", "SYS": "Large", "TRG": "Large",
  "MEBL": "Large", "PSO": "Large",
  "FATIMA": "Mid", "DGKC": "Mid", "MLCF": "Mid", "KAPCO": "Mid",
  "APL": "Mid", "SEARL": "Mid", "LOTCHEM": "Mid", "EPCL": "Mid",
  "ICI": "Mid", "PKGS": "Mid", "PAEL": "Mid", "AGP": "Mid",
  "BIPL": "Mid",
  "CHCC": "Small", "PIOC": "Small", "SHEL": "Small", "HCAR": "Small",
  "ATLH": "Small", "SAZEW": "Small", "GLAXO": "Small", "ABOT": "Small",
  "COLG": "Small", "NATF": "Small", "AVN": "Small", "ISL": "Small",
  "ASTL": "Small", "MUGHAL": "Small", "NCL": "Small", "NML": "Small",
  "GATM": "Small", "GHGL": "Small", "TGL": "Small", "PICT": "Small",
};

module.exports = {
  symbols,
  stockNames,
  sectors,
  marketCap,
};