import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// POST /auth/prepare
// Sets a secure cookie with the intended return URL to avoid exposing it via query params
export const POST: RequestHandler = async ({ request, cookies }) => {
  try {
    const { returnTo } = await request.json().catch(() => ({ returnTo: '/' }));
    const safeReturnTo = typeof returnTo === 'string' && returnTo.length > 0 ? returnTo : '/';

    cookies.set('oauth_return_to', safeReturnTo, {
      path: '/',
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 60 * 10,
      sameSite: 'lax'
    });

    return json({ ok: true });
  } catch {
    return json({ ok: false }, { status: 400 });
  }
};


