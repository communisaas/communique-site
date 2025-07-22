import { json } from '@sveltejs/kit';
import { testCommunityClustering } from '$lib/server/community-clustering';

export async function GET() {
  const result = await testCommunityClustering();
  
  if (result.success) {
    return json(result);
  } else {
    return json(result, { status: 500 });
  }
}