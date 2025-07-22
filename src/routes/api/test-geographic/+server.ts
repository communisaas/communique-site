import { json } from '@sveltejs/kit';
import { testGeographicInterpolation } from '$lib/server/geographic-interpolation';

export async function GET() {
  const result = await testGeographicInterpolation();
  
  if (result.success) {
    return json(result);
  } else {
    return json(result, { status: 500 });
  }
}