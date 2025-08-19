/**
 * Viral Pattern Generator
 * 
 * Transforms political templates into viral-ready patterns that:
 * - Use devastating numerical contrasts
 * - Adapt to local currency and context
 * - Generate platform-specific formats
 * - Maximize sharing while passing filters
 */

import type { Template } from '$lib/types/template';

// Core viral patterns that transcend borders
const VIRAL_PATTERNS = {
  MATH_DOESNT_WORK: {
    opener: "The math doesn't work anymore.",
    structure: "[Entity A] gets [massive amount].\n[Entity B] gets [tiny amount].\nThe [outcome]: [devastating comparison]."
  },
  VS_COMPARISON: {
    opener: "[X] vs [Y]: The Numbers",
    structure: "[Thing 1]: $[huge number]\n[Thing 2]: $[tiny number]\nThe gap: [stark reality]"
  },
  WHICH_DEFEND: {
    opener: "Which do you defend?",
    structure: "Option A: [morally clear choice]\nOption B: [obviously wrong choice]\n\nWhich do you defend?"
  },
  COST_PER: {
    opener: "The real cost:",
    structure: "[Bad thing] costs $[X] per [unit].\n[Good thing] gets $[Y] per [unit].\nWe're paying for the wrong things."
  }
};

// Currency symbols by country code
const CURRENCY_MAP: Record<string, string> = {
  US: '$',
  CA: 'C$',
  GB: '£',
  EU: '€',
  FR: '€',
  DE: '€',
  IN: '₹',
  JP: '¥',
  BR: 'R$',
  AU: 'A$',
  CN: '¥',
  KR: '₩',
  MX: '$',
  ZA: 'R'
};

// Number formatting by locale
const NUMBER_FORMATS: Record<string, { decimal: string; thousands: string }> = {
  US: { decimal: '.', thousands: ',' },
  GB: { decimal: '.', thousands: ',' },
  EU: { decimal: ',', thousands: '.' },
  FR: { decimal: ',', thousands: ' ' },
  DE: { decimal: ',', thousands: '.' },
  IN: { decimal: '.', thousands: ',' }
};

export interface ViralPattern {
  pattern_type: string;
  raw_text: string;
  shareable_text: string;
  hashtags: string[];
  emotional_triggers: string[];
  numerical_contrasts: Array<{
    entity_a: string;
    amount_a: number;
    entity_b: string;
    amount_b: number;
    ratio: number;
  }>;
  platform_variants: {
    twitter?: string;
    facebook?: string;
    whatsapp?: string;
    telegram?: string;
    instagram?: string;
  };
  share_probability: number; // 0-1
  controversy_score: number; // 0-1
}

export interface LocalizationOptions {
  country_code: string;
  language: string;
  currency_symbol?: string;
  local_examples?: Record<string, string>;
  cultural_adjustments?: {
    formality: 'casual' | 'formal' | 'very_formal';
    directness: 'direct' | 'indirect' | 'subtle';
  };
}

/**
 * Extract numerical contrasts from message body
 */
function extractNumericalContrasts(text: string): ViralPattern['numerical_contrasts'] {
  const contrasts: ViralPattern['numerical_contrasts'] = [];
  
  // Pattern: "$X billion vs $Y"
  const billionPattern = /\$?([\d,]+(?:\.\d+)?)\s*(?:billion|million).*?vs.*?\$?([\d,]+(?:\.\d+)?)/gi;
  const matches = text.matchAll(billionPattern);
  
  for (const match of matches) {
    const amount_a = parseFloat(match[1].replace(/,/g, ''));
    const amount_b = parseFloat(match[2].replace(/,/g, ''));
    
    // Extract entities around the numbers
    const beforeMatch = text.substring(Math.max(0, match.index! - 50), match.index);
    const entity_a = beforeMatch.split(/[:.]\s*/).pop()?.trim() || 'Entity A';
    
    contrasts.push({
      entity_a,
      amount_a,
      entity_b: 'Entity B',
      amount_b,
      ratio: amount_a / amount_b
    });
  }
  
  // Pattern: "X costs $Y, Z gets $W"
  const costPattern = /(\w+(?:\s+\w+)*)\s+(?:costs?|gets?|pays?|receives?)\s+\$?([\d,]+(?:\.\d+)?)/gi;
  const costMatches = Array.from(text.matchAll(costPattern));
  
  if (costMatches.length >= 2) {
    for (let i = 0; i < costMatches.length - 1; i += 2) {
      contrasts.push({
        entity_a: costMatches[i][1],
        amount_a: parseFloat(costMatches[i][2].replace(/,/g, '')),
        entity_b: costMatches[i + 1][1],
        amount_b: parseFloat(costMatches[i + 1][2].replace(/,/g, '')),
        ratio: parseFloat(costMatches[i][2].replace(/,/g, '')) / parseFloat(costMatches[i + 1][2].replace(/,/g, ''))
      });
    }
  }
  
  return contrasts;
}

/**
 * Identify emotional triggers in the text
 */
function identifyEmotionalTriggers(text: string): string[] {
  const triggers: string[] = [];
  
  // Loss aversion triggers
  if (text.match(/lost?|losing|taken|stolen|robbed/i)) {
    triggers.push('loss_aversion');
  }
  
  // Unfairness detection
  if (text.match(/unfair|unjust|rigged|corrupt|cheat/i)) {
    triggers.push('unfairness');
  }
  
  // Identity threat
  if (text.match(/our\s+\w+|your\s+\w+|families|children|community/i)) {
    triggers.push('identity_threat');
  }
  
  // Moral outrage
  if (text.match(/wrong|immoral|evil|disgusting|shameful/i)) {
    triggers.push('moral_outrage');
  }
  
  // Numerical shock
  if (text.match(/billion|million|thousand.*?vs.*?\d+/i)) {
    triggers.push('numerical_shock');
  }
  
  return triggers;
}

/**
 * Generate hashtags that trend while passing filters
 */
function generateHashtags(template: Pick<Template, 'title' | 'category' | 'message_body'>): string[] {
  const hashtags: string[] = [];
  
  // Category-based hashtags
  const categoryTags: Record<string, string[]> = {
    'Housing': ['#HousingCrisis', '#RentIsTheft', '#HomesForPeople'],
    'Healthcare': ['#HealthcareIsARight', '#InsulinPrices', '#MedicareForAll'],
    'Economy': ['#TaxTheRich', '#WealthGap', '#EconomicJustice'],
    'Environment': ['#ClimateEmergency', '#FossilFuelSubsidies', '#GreenNewDeal'],
    'Education': ['#TeacherPay', '#StudentDebt', '#PublicEducation'],
    'Democracy': ['#SaveDemocracy', '#VotingRights', '#DarkMoney'],
    'Justice': ['#CriminalJustice', '#PrisonReform', '#EndMassIncarceration']
  };
  
  if (categoryTags[template.category]) {
    hashtags.push(...categoryTags[template.category]);
  }
  
  // Extract "math doesn't work" variations
  if (template.message_body.includes("math doesn't work")) {
    hashtags.push('#TheMathDoesntWork');
  }
  
  // Entity-specific hashtags
  if (template.message_body.match(/blackstone|blackrock/i)) {
    hashtags.push('#BlackstoneOwnsEverything');
  }
  
  if (template.message_body.match(/billion.*?vs.*?0/i)) {
    hashtags.push('#BillionsVsZero');
  }
  
  return [...new Set(hashtags)].slice(0, 3); // Max 3 hashtags
}

/**
 * Format number for locale
 */
function formatNumber(num: number, country_code: string): string {
  const format = NUMBER_FORMATS[country_code] || NUMBER_FORMATS.US;
  
  // Convert to string with appropriate separators
  const parts = num.toFixed(0).split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, format.thousands);
  
  return parts.join(format.decimal);
}

/**
 * Localize currency amounts
 */
function localizeCurrency(amount: number, country_code: string): string {
  const symbol = CURRENCY_MAP[country_code] || '$';
  const formatted = formatNumber(amount, country_code);
  
  // Some currencies go after the number
  if (['FR', 'DE'].includes(country_code)) {
    return `${formatted} ${symbol}`;
  }
  
  return `${symbol}${formatted}`;
}

/**
 * Generate platform-specific variants
 */
function generatePlatformVariants(
  pattern: string,
  hashtags: string[],
  contrasts: ViralPattern['numerical_contrasts']
): ViralPattern['platform_variants'] {
  const variants: ViralPattern['platform_variants'] = {};
  
  // Twitter/X - 280 chars, punchy
  const twitterText = pattern.split('\n')[0] + '\n\n' + 
    (contrasts[0] ? `${contrasts[0].entity_a}: $${contrasts[0].amount_a}B\n${contrasts[0].entity_b}: $${contrasts[0].amount_b}\n\nWhich do you defend?` : '') +
    '\n\n' + hashtags.join(' ');
  variants.twitter = twitterText.substring(0, 280);
  
  // WhatsApp - Emoji-heavy, shareable
  variants.whatsapp = `⚠️ ${pattern.split('\n')[0]} ⚠️\n\n` +
    `💰 ${contrasts[0]?.entity_a}: ${contrasts[0]?.amount_a}B\n` +
    `😢 ${contrasts[0]?.entity_b}: ${contrasts[0]?.amount_b}\n\n` +
    `📢 Share this with everyone!`;
  
  // Facebook - Longer form, call to action
  variants.facebook = pattern + '\n\n' +
    'This is happening in YOUR community. Share if you think this is wrong.\n\n' +
    hashtags.join(' ');
  
  // Telegram - Links and forwarding focused
  variants.telegram = `📊 ${pattern}\n\n` +
    `Forward to expose the truth about ${contrasts[0]?.entity_a || 'this injustice'}`;
  
  // Instagram - Visual text overlay format
  variants.instagram = contrasts[0] ? 
    `${contrasts[0].amount_a}B\nvs\n${contrasts[0].amount_b}\n\n${pattern.split('\n')[0]}` :
    pattern.split('\n').slice(0, 3).join('\n');
  
  return variants;
}

/**
 * Calculate share probability based on pattern characteristics
 */
function calculateShareProbability(
  triggers: string[],
  contrasts: ViralPattern['numerical_contrasts'],
  hashtags: string[]
): number {
  let probability = 0.3; // Base probability
  
  // Emotional triggers boost sharing
  probability += triggers.length * 0.1;
  
  // Stark numerical contrasts are viral gold
  if (contrasts.length > 0) {
    const maxRatio = Math.max(...contrasts.map(c => c.ratio));
    if (maxRatio > 1000) probability += 0.3;
    else if (maxRatio > 100) probability += 0.2;
    else if (maxRatio > 10) probability += 0.1;
  }
  
  // Trending hashtags help
  probability += Math.min(hashtags.length * 0.05, 0.15);
  
  return Math.min(probability, 0.95); // Cap at 95%
}

/**
 * Main function: Generate viral pattern from template
 */
export function generateViralPattern(
  template: Pick<Template, 'title' | 'category' | 'message_body'>,
  options?: LocalizationOptions
): ViralPattern {
  const { message_body } = template;
  
  // Extract components
  const contrasts = extractNumericalContrasts(message_body);
  const triggers = identifyEmotionalTriggers(message_body);
  const hashtags = generateHashtags(template);
  
  // Determine pattern type
  let pattern_type = 'GENERIC';
  if (message_body.includes("math doesn't work")) {
    pattern_type = 'MATH_DOESNT_WORK';
  } else if (message_body.includes(" vs ")) {
    pattern_type = 'VS_COMPARISON';
  } else if (message_body.includes("Which") && message_body.includes("defend")) {
    pattern_type = 'WHICH_DEFEND';
  }
  
  // Create shareable version
  let shareable_text = message_body
    .replace(/Dear .+?,?\n*/g, '') // Remove salutation
    .replace(/Sincerely,?\n*.*/s, '') // Remove signature
    .replace(/\[.*?\]/g, '') // Remove template variables
    .trim();
  
  // Localize if options provided
  if (options?.country_code) {
    // Replace dollar amounts with local currency
    shareable_text = shareable_text.replace(/\$(\d+(?:,\d{3})*(?:\.\d+)?)/g, (match, amount) => {
      const num = parseFloat(amount.replace(/,/g, ''));
      return localizeCurrency(num, options.country_code);
    });
  }
  
  // Generate platform variants
  const platform_variants = generatePlatformVariants(shareable_text, hashtags, contrasts);
  
  // Calculate metrics
  const share_probability = calculateShareProbability(triggers, contrasts, hashtags);
  const controversy_score = triggers.includes('moral_outrage') || contrasts.some(c => c.ratio > 1000) ? 0.8 : 0.4;
  
  return {
    pattern_type,
    raw_text: message_body,
    shareable_text,
    hashtags,
    emotional_triggers: triggers,
    numerical_contrasts: contrasts,
    platform_variants,
    share_probability,
    controversy_score
  };
}

/**
 * Generate image-ready text for social media graphics
 */
export function generateImageText(pattern: ViralPattern): string {
  if (pattern.numerical_contrasts.length > 0) {
    const contrast = pattern.numerical_contrasts[0];
    return `${contrast.amount_a}\nvs\n${contrast.amount_b}\n\n${pattern.pattern_type === 'MATH_DOESNT_WORK' ? "The math doesn't\nwork anymore" : "Which do you defend?"}`;
  }
  
  // Fallback to first few lines
  return pattern.shareable_text.split('\n').slice(0, 3).join('\n');
}

/**
 * Adapt pattern for specific country/culture
 */
export async function adaptPatternForCountry(
  pattern: ViralPattern,
  country_code: string,
  db: any // PrismaClient type
): Promise<ViralPattern> {
  // Fetch legislative channel info
  const channel = await db.legislative_channel.findUnique({
    where: { country_code }
  });
  
  if (!channel) {
    return pattern; // No adaptation possible
  }
  
  // Create localized version
  const localized = { ...pattern };
  
  // Adapt currency
  localized.shareable_text = localized.shareable_text.replace(/\$(\d+)/g, (match, amount) => {
    return localizeCurrency(parseInt(amount), country_code);
  });
  
  // Adapt formality based on culture
  if (channel.primary_language === 'ja' || channel.primary_language === 'de') {
    // More formal cultures
    localized.shareable_text = localized.shareable_text
      .replace(/doesn't/g, 'does not')
      .replace(/can't/g, 'cannot')
      .replace(/won't/g, 'will not');
  }
  
  // Add local hashtags
  const localHashtags: Record<string, string[]> = {
    FR: ['#AssembléeNationale', '#Politique'],
    DE: ['#Bundestag', '#Politik'],
    IN: ['#LokSabha', '#IndianPolitics'],
    BR: ['#CongressoNacional', '#PolíticaBR']
  };
  
  if (localHashtags[country_code]) {
    localized.hashtags = [...localized.hashtags, ...localHashtags[country_code]].slice(0, 4);
  }
  
  return localized;
}