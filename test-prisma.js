const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

console.log('VerificationSession exists:', typeof prisma.verificationSession !== 'undefined');
console.log('VerificationAudit exists:', typeof prisma.verificationAudit !== 'undefined');

prisma.$disconnect();
