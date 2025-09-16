import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const templates = await prisma.template.findMany({
	select: {
		title: true,
		message_body: true,
		category: true
	}
});

console.log('\n🔍 TEMPLATE VARIABLE ANALYSIS FROM DATABASE\n');
console.log('='.repeat(80));

const allVars = new Set();

templates.forEach((t) => {
	console.log(`\n${t.title} (${t.category})`);
	const regex = /\[([^\]]+)\]/g;
	const vars = [];
	let m;
	while ((m = regex.exec(t.message_body)) !== null) {
		vars.push(m[1]);
		allVars.add(m[1]);
	}
	const unique = [...new Set(vars)];
	console.log('  Variables:', unique.map((v) => `[${v}]`).join(', '));
});

console.log('\n' + '='.repeat(80));
console.log('ALL UNIQUE VARIABLES:');
[...allVars].sort().forEach((v) => console.log(`  [${v}]`));

await prisma.$disconnect();
