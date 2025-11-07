import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

console.log('VerificationSession exists:', typeof prisma.verificationSession !== 'undefined');
console.log('VerificationAudit exists:', typeof prisma.verificationAudit !== 'undefined');

await prisma.$disconnect();
