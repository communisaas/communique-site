interface FieldMap {
	[field: string]: string;
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
	equals?: string | number;
	OR?: Criteria[];
}
