import { db } from '$lib/server/db';

export type AccessMethod = 'email' | 'api' | 'form' | 'none';

export interface ChannelInfo {
  country_code: string;
  access_method: AccessMethod;
  access_tier: number; // 1=email, 2=api/form, 3=social only
  primary_language: string;
  supported_languages: string[];
}

/**
 * Resolve delivery channel for a given country code.
 * Falls back to { access_method: 'none', access_tier: 3 } when unknown.
 */
export async function resolveChannel(country_code: string | undefined | null): Promise<ChannelInfo> {
  const code = (country_code || '').toUpperCase();
  if (!code) {
    // Unknown country → treat as Tier 3
    return {
      country_code: 'XX',
      access_method: 'none',
      access_tier: 3,
      primary_language: 'en',
      supported_languages: ['en']
    };
  }

  const channel = await db.legislative_channel.findUnique({ where: { country_code: code } });
  if (!channel) {
    return {
      country_code: code,
      access_method: 'none',
      access_tier: 3,
      primary_language: 'en',
      supported_languages: ['en']
    };
  }

  return {
    country_code: channel.country_code,
    access_method: channel.access_method as AccessMethod,
    access_tier: channel.access_tier,
    primary_language: channel.primary_language,
    supported_languages: channel.supported_languages
  };
}

/**
 * Basic country detection: prefer Cloudflare header, fallback to US.
 * Integrate IP lookup later.
 */
export function detectCountryFromHeaders(headers: Headers): string | undefined {
  // Common CDN header for country code
  const cf = headers.get('cf-ipcountry');
  if (cf) return cf.toUpperCase();

  // Try standard X-Country (if any reverse proxy sets it)
  const xc = headers.get('x-country');
  if (xc) return xc.toUpperCase();

  return undefined;
}


