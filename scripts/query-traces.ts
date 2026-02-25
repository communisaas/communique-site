import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
	// Get recent traces
	const traces = await prisma.agentTrace.findMany({
		where: { endpoint: 'decision-makers' },
		orderBy: { createdAt: 'desc' },
		take: 40
	});

	console.log(`=== RECENT DECISION-MAKER TRACES (${traces.length} events) ===\n`);

	// Group by trace_id
	const grouped: Record<string, typeof traces> = {};
	for (const t of traces) {
		if (!grouped[t.traceId]) grouped[t.traceId] = [];
		grouped[t.traceId].push(t);
	}

	for (const [traceId, events] of Object.entries(grouped)) {
		const sorted = events.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
		console.log(`\n--- Trace: ${traceId.slice(0, 12)}... (${sorted.length} events) ---`);
		for (const e of sorted) {
			const payloadStr = typeof e.payload === 'string' ? e.payload : JSON.stringify(e.payload);
			console.log(`  ${e.eventType} | ok=${e.success} | ${e.durationMs}ms | $${e.costUsd || 0} | ${payloadStr.length} chars | ${e.createdAt.toISOString()}`);
		}
	}

	// Get the LATEST trace's full payloads
	if (traces.length > 0) {
		const latestTraceId = traces[0].traceId;
		console.log(`\n\n=== FULL PAYLOADS FOR LATEST TRACE: ${latestTraceId} ===\n`);

		const fullEvents = await prisma.agentTrace.findMany({
			where: { traceId: latestTraceId },
			orderBy: { createdAt: 'asc' }
		});

		for (const e of fullEvents) {
			console.log(`\n--- ${e.eventType} (${e.createdAt.toISOString()}) ---`);
			const p = e.payload;
			const str = typeof p === 'string' ? p : JSON.stringify(p, null, 2);
			console.log(str.slice(0, 4000));
			if (str.length > 4000) console.log(`... (${str.length - 4000} more chars)`);
		}
	}

	await prisma.$disconnect();
}

main().catch(console.error);
