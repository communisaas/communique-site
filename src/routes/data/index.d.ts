interface FieldMap {
	[field: string]: string;
}

interface QueryResult {
	source: 'recipient' | 'topic' | 'email';
	id: string;
	rank: number;
	lev_distance: number;
}

interface Query {
	[table: string]: Clause;
}

interface Clause {
	where: Criteria;
	take?: number;
}

interface Criteria {
	[field: string]: Operator;
}

interface Operator {
	has?: string;
	hasSome?: string[];
	hasEvery?: string[];
	in?: string[];
	equals?: string | number;
	OR?: Criteria[];
}
