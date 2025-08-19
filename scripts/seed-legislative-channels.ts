import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

const legislativeChannels = [
  // TIER 1: Full Email Access Countries
  {
    country_code: 'CA',
    country_name: 'Canada',
    legislature_name: 'Parliament of Canada',
    legislature_type: 'bicameral',
    access_method: 'email',
    access_tier: 1,
    email_pattern: 'firstname.lastname@parl.gc.ca',
    email_domain: 'parl.gc.ca',
    email_format_notes: 'MPs use @parl.gc.ca, Senators use @sen.parl.gc.ca',
    primary_language: 'en',
    supported_languages: ['en', 'fr'],
    requires_constituent: false,
    requires_real_address: false,
    population: BigInt(38250000),
    internet_penetration: 0.93,
    democracy_index: 8.87,
    legislative_bodies: [
      {
        body_name: 'House of Commons',
        body_type: 'lower',
        member_count: 338,
        member_title: 'MP',
        email_pattern: 'firstname.lastname@parl.gc.ca',
        term_length_years: 4
      },
      {
        body_name: 'Senate',
        body_type: 'upper',
        member_count: 105,
        member_title: 'Senator',
        email_pattern: 'firstname.lastname@sen.parl.gc.ca',
        term_length_years: 0 // Appointed until 75
      }
    ]
  },
  {
    country_code: 'GB',
    country_name: 'United Kingdom',
    legislature_name: 'Parliament of the United Kingdom',
    legislature_type: 'bicameral',
    access_method: 'email',
    access_tier: 1,
    email_pattern: 'varies by MP - check parliament.uk',
    email_domain: 'parliament.uk',
    email_format_notes: 'Each MP has individual email listed on their page',
    primary_language: 'en',
    supported_languages: ['en', 'cy', 'gd'],
    requires_constituent: true,
    requires_real_address: true,
    population: BigInt(67886000),
    internet_penetration: 0.95,
    democracy_index: 8.54,
    legislative_bodies: [
      {
        body_name: 'House of Commons',
        body_type: 'lower',
        member_count: 650,
        member_title: 'MP',
        term_length_years: 5
      },
      {
        body_name: 'House of Lords',
        body_type: 'upper',
        member_count: 786,
        member_title: 'Lord',
        term_length_years: 0 // Life appointment
      }
    ]
  },
  {
    country_code: 'FR',
    country_name: 'France',
    legislature_name: 'French Parliament',
    legislature_type: 'bicameral',
    access_method: 'email',
    access_tier: 1,
    email_pattern: 'firstname.lastname@assemblee-nationale.fr',
    email_domain: 'assemblee-nationale.fr',
    email_format_notes: 'Standardized format for all deputies',
    primary_language: 'fr',
    supported_languages: ['fr'],
    requires_constituent: false,
    requires_real_address: false,
    population: BigInt(65273000),
    internet_penetration: 0.92,
    democracy_index: 7.99,
    legislative_bodies: [
      {
        body_name: 'Assemblée Nationale',
        body_type: 'lower',
        member_count: 577,
        member_title: 'Député',
        email_pattern: 'firstname.lastname@assemblee-nationale.fr',
        term_length_years: 5
      },
      {
        body_name: 'Sénat',
        body_type: 'upper',
        member_count: 348,
        member_title: 'Sénateur',
        email_pattern: 'firstname.lastname@senat.fr',
        term_length_years: 6
      }
    ]
  },
  {
    country_code: 'IN',
    country_name: 'India',
    legislature_name: 'Parliament of India',
    legislature_type: 'bicameral',
    access_method: 'email',
    access_tier: 1,
    email_pattern: 'Available on loksabha.nic.in and rajyasabha.nic.in',
    email_domain: 'Various',
    email_format_notes: 'Individual emails listed on parliament websites',
    primary_language: 'hi',
    supported_languages: ['hi', 'en', 'bn', 'te', 'mr', 'ta', 'ur', 'gu', 'kn', 'or', 'ml', 'pa'],
    requires_constituent: false,
    requires_real_address: false,
    population: BigInt(1380004000),
    internet_penetration: 0.43,
    democracy_index: 6.91,
    legislative_bodies: [
      {
        body_name: 'Lok Sabha',
        body_type: 'lower',
        member_count: 543,
        member_title: 'MP',
        term_length_years: 5
      },
      {
        body_name: 'Rajya Sabha',
        body_type: 'upper',
        member_count: 245,
        member_title: 'MP',
        term_length_years: 6
      }
    ]
  },

  // TIER 2: API/Form Access Countries
  {
    country_code: 'US',
    country_name: 'United States',
    legislature_name: 'United States Congress',
    legislature_type: 'bicameral',
    access_method: 'api',
    access_tier: 2,
    api_endpoint: 'https://www.house.gov/htbin/formproc',
    api_auth_type: 'captcha',
    api_documentation_url: 'https://github.com/unitedstates/contact-congress',
    rate_limit_requests: 10,
    rate_limit_daily: 1000,
    form_url: 'Individual member contact forms',
    form_requires_captcha: true,
    form_max_length: 2000,
    primary_language: 'en',
    supported_languages: ['en', 'es'],
    requires_constituent: true,
    requires_real_address: true,
    forbidden_words: [],
    message_guidelines: 'Must include full address and zip code for verification',
    population: BigInt(331002000),
    internet_penetration: 0.91,
    democracy_index: 7.85,
    legislative_bodies: [
      {
        body_name: 'House of Representatives',
        body_type: 'lower',
        member_count: 435,
        member_title: 'Representative',
        term_length_years: 2
      },
      {
        body_name: 'Senate',
        body_type: 'upper',
        member_count: 100,
        member_title: 'Senator',
        term_length_years: 6
      }
    ]
  },
  {
    country_code: 'AU',
    country_name: 'Australia',
    legislature_name: 'Parliament of Australia',
    legislature_type: 'bicameral',
    access_method: 'email',
    access_tier: 2, // Emails exist but must be looked up individually
    email_pattern: 'Individual lookup required on aph.gov.au',
    email_domain: 'aph.gov.au',
    email_format_notes: 'No consolidated list, check individual member pages',
    primary_language: 'en',
    supported_languages: ['en'],
    requires_constituent: false,
    requires_real_address: false,
    population: BigInt(25500000),
    internet_penetration: 0.88,
    democracy_index: 8.90,
    legislative_bodies: [
      {
        body_name: 'House of Representatives',
        body_type: 'lower',
        member_count: 151,
        member_title: 'MP',
        term_length_years: 3
      },
      {
        body_name: 'Senate',
        body_type: 'upper',
        member_count: 76,
        member_title: 'Senator',
        term_length_years: 6
      }
    ]
  },
  {
    country_code: 'DE',
    country_name: 'Germany',
    legislature_name: 'German Parliament',
    legislature_type: 'bicameral',
    access_method: 'form',
    access_tier: 2,
    form_url: 'https://www.bundestag.de/en/service/contactform',
    form_requires_captcha: true,
    form_max_length: 5000,
    primary_language: 'de',
    supported_languages: ['de', 'en'],
    requires_constituent: false,
    requires_real_address: false,
    message_guidelines: 'Use formal language and proper titles',
    population: BigInt(83784000),
    internet_penetration: 0.94,
    democracy_index: 8.67,
    legislative_bodies: [
      {
        body_name: 'Bundestag',
        body_type: 'lower',
        member_count: 630,
        member_title: 'MdB',
        term_length_years: 4
      },
      {
        body_name: 'Bundesrat',
        body_type: 'upper',
        member_count: 69,
        member_title: 'Member',
        term_length_years: 0 // Appointed by state governments
      }
    ]
  },

  // TIER 3: Limited/No Direct Access Countries
  {
    country_code: 'JP',
    country_name: 'Japan',
    legislature_name: 'National Diet',
    legislature_type: 'bicameral',
    access_method: 'none',
    access_tier: 3,
    primary_language: 'ja',
    supported_languages: ['ja'],
    requires_constituent: false,
    requires_real_address: false,
    message_guidelines: 'Highly formal language required, use honorifics',
    population: BigInt(126476000),
    internet_penetration: 0.93,
    democracy_index: 8.13,
    legislative_bodies: [
      {
        body_name: 'House of Representatives',
        body_type: 'lower',
        member_count: 465,
        member_title: 'Member',
        term_length_years: 4
      },
      {
        body_name: 'House of Councillors',
        body_type: 'upper',
        member_count: 248,
        member_title: 'Councillor',
        term_length_years: 6
      }
    ]
  },
  {
    country_code: 'BR',
    country_name: 'Brazil',
    legislature_name: 'National Congress',
    legislature_type: 'bicameral',
    access_method: 'none',
    access_tier: 3,
    primary_language: 'pt',
    supported_languages: ['pt'],
    requires_constituent: false,
    requires_real_address: false,
    message_guidelines: 'Use formal Portuguese, avoid confrontational language',
    population: BigInt(212559000),
    internet_penetration: 0.74,
    democracy_index: 6.86,
    legislative_bodies: [
      {
        body_name: 'Chamber of Deputies',
        body_type: 'lower',
        member_count: 513,
        member_title: 'Deputy',
        term_length_years: 4
      },
      {
        body_name: 'Federal Senate',
        body_type: 'upper',
        member_count: 81,
        member_title: 'Senator',
        term_length_years: 8
      }
    ]
  },

  // EU Parliament (Supranational)
  {
    country_code: 'EU',
    country_name: 'European Union',
    legislature_name: 'European Parliament',
    legislature_type: 'unicameral',
    access_method: 'email',
    access_tier: 1,
    email_pattern: 'firstname.lastname@europarl.europa.eu',
    email_domain: 'europarl.europa.eu',
    email_format_notes: 'Standardized format for all MEPs',
    primary_language: 'en',
    supported_languages: ['bg', 'hr', 'cs', 'da', 'nl', 'en', 'et', 'fi', 'fr', 'de', 'el', 'hu', 'ga', 'it', 'lv', 'lt', 'mt', 'pl', 'pt', 'ro', 'sk', 'sl', 'es', 'sv'],
    requires_constituent: false,
    requires_real_address: false,
    population: BigInt(447000000),
    internet_penetration: 0.87,
    democracy_index: 0, // Not a country
    legislative_bodies: [
      {
        body_name: 'European Parliament',
        body_type: 'unicameral',
        member_count: 720,
        member_title: 'MEP',
        term_length_years: 5
      }
    ]
  }
];

async function seedLegislativeChannels() {
  console.log('🏛️ Seeding legislative channels for global democracies...');
  
  try {
    // Clear existing data
    await db.legislative_body.deleteMany({});
    await db.legislative_channel.deleteMany({});
    console.log('✅ Cleared existing legislative channel data');
    
    // Insert channels with their bodies
    for (const channel of legislativeChannels) {
      const { legislative_bodies, ...channelData } = channel;
      
      // Create the channel
      const createdChannel = await db.legislative_channel.create({
        data: channelData
      });
      
      console.log(`📍 Created channel: ${channel.country_name} (${channel.country_code}) - Tier ${channel.access_tier}`);
      
      // Create associated legislative bodies
      if (legislative_bodies) {
        for (const body of legislative_bodies) {
          await db.legislative_body.create({
            data: {
              ...body,
              channel_id: createdChannel.id
            }
          });
          console.log(`   └─ ${body.body_name}: ${body.member_count} ${body.member_title}s`);
        }
      }
    }
    
    // Summary statistics
    const tierStats = await db.legislative_channel.groupBy({
      by: ['access_tier'],
      _count: true
    });
    
    console.log('\n📊 Legislative Channel Summary:');
    console.log('================================');
    tierStats.forEach(stat => {
      const tierName = stat.access_tier === 1 ? 'Email Access' : 
                       stat.access_tier === 2 ? 'API/Form Access' : 
                       'Social Only';
      console.log(`Tier ${stat.access_tier} (${tierName}): ${stat._count} countries`);
    });
    
    const totalBodies = await db.legislative_body.count();
    const totalMembers = await db.legislative_body.aggregate({
      _sum: { member_count: true }
    });
    
    console.log(`\nTotal legislative bodies: ${totalBodies}`);
    console.log(`Total legislators worldwide: ${totalMembers._sum.member_count?.toLocaleString()}`);
    
    // Access method breakdown
    const accessMethods = await db.legislative_channel.groupBy({
      by: ['access_method'],
      _count: true
    });
    
    console.log('\n🔐 Access Method Breakdown:');
    accessMethods.forEach(method => {
      console.log(`   ${method.access_method}: ${method._count} countries`);
    });
    
    console.log('\n✅ Legislative channels seeded successfully!');
    
  } catch (error) {
    console.error('❌ Error seeding legislative channels:', error);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

seedLegislativeChannels();