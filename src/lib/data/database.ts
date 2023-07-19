import { PrismaClient } from '@prisma/client';

export const objectMapper = new PrismaClient();

export function find(table: string, options: Query, scope: 'unique' | 'many' = 'many') {
	// eslint-disable-next-line @typescript-eslint/ban-ts-comment
	// @ts-ignore indexing type error
	const currentTable = objectMapper[table];
	switch (scope) {
		case 'unique':
			return currentTable.findUnique({ ...options });
		case 'many':
			return currentTable.findMany({ ...options });
	}
}

// patch BigInt to serialize JSON as string
BigInt.prototype.toJSON = function (): string {
	return this.toString();
};
