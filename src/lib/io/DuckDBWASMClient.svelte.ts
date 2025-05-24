import duckdb_mvp_worker from '@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url';
import duckdb_eh_worker from '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url';
import duckdb_mvp_wasm from '@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url';
import duckdb_eh_wasm from '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url';
import * as duckdb from '@duckdb/duckdb-wasm';

import type { AsyncDuckDB, AsyncDuckDBConnection, DuckDBBundles } from '@duckdb/duckdb-wasm';
import { DuckDBDataProtocol, LogLevel } from '@duckdb/duckdb-wasm';

type InsertCSVOptions = Parameters<AsyncDuckDBConnection['insertCSVFromPath']>[1];
type InsertJSONOptions = Parameters<AsyncDuckDBConnection['insertJSONFromPath']>[1];

export type TableField = {
	name: string;
	type:
		| 'integer'
		| 'bigint'
		| 'number'
		| 'buffer'
		| 'string'
		| 'boolean'
		| 'date'
		| 'array'
		| 'object'
		| 'other';
	databaseType: string;
	nullable: boolean;
};

export type QueryResult<T = Record<string, unknown>> = Array<T> & {
	schema: TableField[];
};

export interface QueryStream<T = Record<string, unknown>> {
	schema: TableField[];
	readRows: () => AsyncGenerator<T[], void, void>;
}

export interface DuckDBOpenOptions extends duckdb.DuckDBConfig {
	logQueries?: boolean;
	persistConnections?: boolean;
}

export type SourceMap = Record<string, Source>;

export type FileHandleSource = {
	name?: string;
	file: File;
	options?: Partial<InsertCSVOptions & InsertJSONOptions>;
};

export type UrlSource = {
	url: string;
	name?: string;
};

export type Source = File | FileHandleSource | UrlSource;

export class DuckDBQueryError extends Error {
	constructor(
		message: string,
		public readonly sql: string,
		public readonly params: unknown[]
	) {
		super(`Query error: ${message}\nSQL: ${sql}\nParams: ${JSON.stringify(params)}`);
		this.name = 'DuckDBQueryError';
	}
}

export class DuckDBClient {
	private readonly db: AsyncDuckDB;
	private readonly options: DuckDBOpenOptions;
	private connectionPool: AsyncDuckDBConnection[] = [];
	private closed = false;

	private constructor(db: AsyncDuckDB, options: DuckDBOpenOptions) {
		this.db = db;
		this.options = options;
	}

	static async create(
		sources: SourceMap = {},
		options: DuckDBOpenOptions = {}
	): Promise<DuckDBClient> {
		const db = await makeWasmDB();
		const mergedOptions = mergeWithDefaults(options);

		try {
			await db.open(mergedOptions);

			if (Object.keys(sources).length > 0) {
				await ingestSources(db, sources);
			}

			return new DuckDBClient(db, mergedOptions);
		} catch (error) {
			try {
			} catch (closeError) {
				console.error('Failed to close database after initialization error:', closeError);
			}
			throw error;
		}
	}

	private async getConnection(): Promise<AsyncDuckDBConnection> {
		if (this.closed) {
			throw new Error('Database is closed');
		}

		if (this.connectionPool.length > 0 && this.options.persistConnections) {
			return this.connectionPool.pop()!;
		}

		try {
			return await this.db.connect();
		} catch (error) {
			throw new Error(
				`Failed to create database connection: ${error instanceof Error ? error.message : String(error)}`
			);
		}
	}

	private async releaseConnection(conn: AsyncDuckDBConnection): Promise<void> {
		if (this.closed || !this.options.persistConnections) {
			await conn.close();
		} else {
			this.connectionPool.push(conn);
		}
	}

	async queryStream<T = Record<string, unknown>>(
		sql: string,
		params: unknown[] = []
	): Promise<QueryStream<T>> {
		const conn = await this.getConnection();
		let reader = params.length
			? await (await conn.prepare(sql)).send(...params)
			: await conn.send(sql);

		let batch = await (await reader).next();
		if (batch.done) {
			await conn.close();
			throw new Error('Missing first batch');
		}

		return {
			schema: toArrowSchema(batch.value),
			async *readRows() {
				try {
					while (!batch.done) {
						yield batch.value.toArray() as T[];
						batch = await (await reader).next(); // ← fixed
					}
				} finally {
					await conn.close();
				}
			}
		} satisfies QueryStream<T>;
	}

	async query<T = Record<string, unknown>>(
		sql: string,
		params: unknown[] = []
	): Promise<QueryResult<T>> {
		const stream = await this.queryStream<T>(sql, params);
		const rows: T[] = [];

		try {
			for await (const chunk of stream.readRows()) {
				rows.push(...chunk);
			}
		} catch (error) {
			throw new DuckDBQueryError(
				error instanceof Error ? error.message : String(error),
				sql,
				params
			);
		}

		(rows as QueryResult<T>).schema = stream.schema;
		return rows as QueryResult<T>;
	}

	async queryRow<T = Record<string, unknown>>(
		sql: string,
		params: unknown[] = []
	): Promise<T | null> {
		const stream = await this.queryStream<T>(sql, params);
		const it = stream.readRows();

		try {
			const { value, done } = await it.next();
			return done || !value.length ? null : value[0];
		} catch (error) {
			throw new DuckDBQueryError(
				error instanceof Error ? error.message : String(error),
				sql,
				params
			);
		} finally {
			await it.return?.();
		}
	}

	async queryScalar<T = unknown>(sql: string, params: unknown[] = []): Promise<T | null> {
		const row = await this.queryRow(sql, params);
		if (row === null) return null;

		const keys = Object.keys(row);
		if (keys.length === 0) return null;

		return row[keys[0]] as T;
	}

	async listTables(): Promise<{ name: string; type: string }[]> {
		const res = await this.query('SHOW TABLES');
		return res.map((r) => ({
			name: r.name as string,
			type: r.type as string
		}));
	}

	async describeColumns(table: string): Promise<TableField[]> {
		const res = await this.query(`DESCRIBE ${escapeIdent(table)}`);
		return res.map(({ column_name, column_type, null: nullable }) => ({
			name: column_name as string,
			type: mapDuckDBType(column_type as string),
			nullable: nullable !== 'NO',
			databaseType: column_type as string
		})) as TableField[];
	}

	async tableStats(table: string): Promise<{ rowCount: number }> {
		const count = await this.queryScalar<number>(`SELECT COUNT(*) FROM ${escapeIdent(table)}`);
		return { rowCount: count ?? 0 };
	}

	async sampleTable<T = Record<string, unknown>>(
		table: string,
		limit: number = 10
	): Promise<QueryResult<T>> {
		return this.query<T>(`SELECT * FROM ${escapeIdent(table)} LIMIT ?`, [limit]);
	}

	async importFile(source: Source): Promise<string> {
		if (this.closed) {
			throw new Error('Database is closed');
		}

		if (source instanceof File) {
			await registerFileHandle(this.db, source);
			return source.name;
		} else if ('file' in source) {
			await insertFile(this.db, source);
			return source.name ?? source.file.name;
		} else if ('url' in source) {
			const filename = source.url.split('/').pop()!;
			await registerUrl(this.db, source.url, source.name);
			return source.name ?? filename;
		}

		throw new Error(`Unsupported source type: ${JSON.stringify(source)}`);
	}

	sql<T = Record<string, unknown>>(
		strings: TemplateStringsArray,
		...values: unknown[]
	): Promise<QueryResult<T>> {
		return this.query(strings.join('?'), values);
	}

	build(strings: TemplateStringsArray, ...values: unknown[]): readonly [string, unknown[]] {
		return [strings.join('?'), values] as const;
	}

	async executeBatch(statements: string[]): Promise<void> {
		const conn = await this.getConnection();

		try {
			for (const statement of statements) {
				if (this.options.logQueries) {
					console.log(`DuckDB batch statement: ${statement}`);
				}
				await conn.query(statement);
			}
		} catch (error) {
			throw new DuckDBQueryError(
				error instanceof Error ? error.message : String(error),
				statements.join(';\n'),
				[]
			);
		} finally {
			await this.releaseConnection(conn);
		}
	}

	async createTable<T extends Record<string, unknown>>(name: string, data: T[]): Promise<void> {
		if (!data.length) {
			throw new Error('Cannot create table with empty data array');
		}

		const conn = await this.getConnection();

		try {
			const firstRow = data[0];
			const columns = Object.keys(firstRow).map((key) => {
				const value = firstRow[key];
				const type = inferSqlType(value);
				return `"${key}" ${type}`;
			});

			const createTableSQL = `CREATE TABLE "${name}" (${columns.join(', ')})`;
			if (this.options.logQueries) {
				console.log(`DuckDB create table: ${createTableSQL}`);
			}
			await conn.query(createTableSQL);

			for (const row of data) {
				const columns = Object.keys(row);
				const placeholders = columns.map(() => '?').join(', ');
				const insertSQL = `INSERT INTO "${name}" (${columns.map((c) => `"${c}"`).join(', ')}) VALUES (${placeholders})`;
				const values = columns.map((c) => row[c]);

				if (this.options.logQueries) {
					console.log(`DuckDB insert: ${insertSQL}`, values);
				}

				const stmt = await conn.prepare(insertSQL);
				await stmt.send(...values);
			}
		} catch (error) {
			throw new DuckDBQueryError(
				error instanceof Error ? error.message : String(error),
				`Create table ${name}`,
				[]
			);
		} finally {
			await this.releaseConnection(conn);
		}
	}

	async close(): Promise<void> {
		if (this.closed) return;

		this.closed = true;

		await Promise.all(this.connectionPool.map((conn) => conn.close().catch(console.error)));
		this.connectionPool = [];
	}
}

function inferSqlType(value: unknown): string {
	if (value === null || value === undefined) return 'VARCHAR';

	switch (typeof value) {
		case 'number':
			return Number.isInteger(value) ? 'INTEGER' : 'DOUBLE';
		case 'boolean':
			return 'BOOLEAN';
		case 'string':
			return 'VARCHAR';
		case 'object':
			if (value instanceof Date) return 'TIMESTAMP';
			if (Array.isArray(value)) return 'JSON';
			return 'JSON';
		default:
			return 'VARCHAR';
	}
}

function mergeWithDefaults(opts: DuckDBOpenOptions): DuckDBOpenOptions {
	const def: DuckDBOpenOptions = {
		query: {
			castBigIntToDouble: true,
			castTimestampToDate: true
		},
		logQueries: false,
		persistConnections: true
	};

	// `satisfies` lets TS verify but still infer narrower result
	return {
		...def,
		...opts,
		query: { ...def.query, ...opts.query }
	} satisfies DuckDBOpenOptions;
}

function escapeIdent(id: string | number): string {
	return `"${String(id).replace(/"/g, '""')}"`;
}

function toArrowSchema(tbl: any): TableField[] {
	return tbl.schema.fields.map((f: any) => ({
		name: f.name,
		type: mapArrowType(f.type),
		nullable: f.nullable,
		databaseType: String(f.type)
	}));
}

function mapArrowType(type: { typeId: number }): TableField['type'] {
	switch (type.typeId) {
		case 2:
			return 'integer';
		case 3:
		case 7:
			return 'number';
		case 4:
		case 15:
			return 'buffer';
		case 5:
			return 'string';
		case 6:
			return 'boolean';
		case 8:
		case 9:
		case 10:
			return 'date';
		case 12:
		case 16:
			return 'array';
		case 13:
		case 14:
			return 'object';
		default:
			return 'other';
	}
}

function mapDuckDBType(type: string): TableField['type'] {
	switch (type.toUpperCase()) {
		case 'BIGINT':
		case 'HUGEINT':
		case 'UBIGINT':
			return 'bigint';
		case 'DOUBLE':
		case 'REAL':
		case 'FLOAT':
		case 'DECIMAL':
			return 'number';
		case 'INTEGER':
		case 'SMALLINT':
		case 'TINYINT':
		case 'USMALLINT':
		case 'UINTEGER':
		case 'UTINYINT':
			return 'integer';
		case 'BOOLEAN':
			return 'boolean';
		case 'DATE':
		case 'TIMESTAMP':
		case 'TIMESTAMP WITH TIME ZONE':
		case 'TIME':
			return 'date';
		case 'VARCHAR':
		case 'CHAR':
		case 'TEXT':
		case 'UUID':
			return 'string';
		case 'BLOB':
			return 'buffer';
		case 'LIST':
			return 'array';
		case 'STRUCT':
		case 'MAP':
			return 'object';
		default:
			return /^DECIMAL\(/.test(type) ? 'number' : 'other';
	}
}

async function makeWasmDB(): Promise<AsyncDuckDB> {
	try {
		const bundles: DuckDBBundles = {
			mvp: { mainModule: duckdb_mvp_wasm, mainWorker: duckdb_mvp_worker },
			eh: { mainModule: duckdb_eh_wasm, mainWorker: duckdb_eh_worker }
		};

		const sel = await duckdb.selectBundle(bundles);
		const worker = new Worker(sel.mainWorker!);
		const db = new duckdb.AsyncDuckDB(new duckdb.ConsoleLogger(LogLevel.NONE), worker);

		await db.instantiate(sel.mainModule, sel.pthreadWorker);
		return db;
	} catch (error) {
		throw new Error(
			`Failed to create DuckDB WASM instance: ${error instanceof Error ? error.message : String(error)}`
		);
	}
}

async function ingestSources(db: AsyncDuckDB, sources: SourceMap): Promise<void> {
	const errors: Error[] = [];

	await Promise.all(
		Object.entries(sources).map(async ([key, src]) => {
			try {
				if (src instanceof File) {
					await registerFileHandle(db, src);
				} else if ('file' in src) {
					await insertFile(db, src);
				} else if ('url' in src) {
					await registerUrl(db, src.url, src.name);
				} else {
					throw new Error(`Unsupported source type for ${key}: ${JSON.stringify(src)}`);
				}
			} catch (error) {
				errors.push(
					new Error(
						`Failed to ingest source ${key}: ${error instanceof Error ? error.message : String(error)}`
					)
				);
			}
		})
	);

	if (errors.length > 0) {
		throw new Error(`Failed to ingest sources: ${errors.map((e) => e.message).join('; ')}`);
	}
}

async function registerFileHandle(db: AsyncDuckDB, file: File): Promise<void> {
	try {
		await db.registerFileHandle(file.name, file, DuckDBDataProtocol.BROWSER_FILEREADER, true);
	} catch (error) {
		throw new Error(
			`Failed to register file handle ${file.name}: ${error instanceof Error ? error.message : String(error)}`
		);
	}
}

async function insertUntypedCsv(
	conn: AsyncDuckDBConnection,
	file: File,
	name: string
): Promise<void> {
	try {
		const stmt = await conn.prepare(
			`CREATE TABLE "${name}" AS SELECT * FROM read_csv_auto(?, ALL_VARCHAR=TRUE, AUTO_DETECT=FALSE)`
		);
		await stmt.send(file.name);
	} catch (error) {
		throw new Error(
			`Failed to insert CSV file ${file.name} as untyped: ${error instanceof Error ? error.message : String(error)}`
		);
	}
}

async function registerUrl(db: AsyncDuckDB, url: string, name?: string): Promise<void> {
	try {
		const filename = url.split('/').pop()!;
		await db.registerFileURL(filename, url, DuckDBDataProtocol.HTTP, false);

		if (name && name !== filename) {
			const conn = await db.connect();
			try {
				if (/\.csv$/i.test(filename)) {
					await conn.query(`CREATE VIEW "${name}" AS SELECT * FROM read_csv_auto('${filename}')`);
				} else if (/\.json$/i.test(filename)) {
					await conn.query(`CREATE VIEW "${name}" AS SELECT * FROM read_json_auto('${filename}')`);
				} else if (/\.parquet$/i.test(filename)) {
					await conn.query(`CREATE VIEW "${name}" AS SELECT * FROM parquet_scan('${filename}')`);
				} else {
					throw new Error(`Unsupported file extension for ${filename}`);
				}
			} finally {
				await conn.close();
			}
		}
	} catch (error) {
		throw new Error(
			`Failed to register URL ${url}: ${error instanceof Error ? error.message : String(error)}`
		);
	}
}

async function insertFile(
	db: AsyncDuckDB,
	{ file, name = file.name, options = {} }: FileHandleSource
): Promise<void> {
	await registerFileHandle(db, file);
	const conn = await db.connect();

	try {
		switch (file.type) {
			case 'text/csv':
			case 'text/tab-separated-values':
				await insertCsvFile(conn, file, name, options);
				break;
			case 'application/json':
				await insertJsonFile(conn, file, name, options);
				break;
			default:
				if (/\.parquet$/i.test(file.name)) {
					await conn.query(`CREATE VIEW "${name}" AS SELECT * FROM parquet_scan('${file.name}')`);
				} else if (/\.xlsx$/i.test(file.name) || /\.xls$/i.test(file.name)) {
					await conn.query(`CREATE VIEW "${name}" AS SELECT * FROM read_excel('${file.name}')`);
				} else {
					throw new Error(`Unsupported file type: ${file.type || 'unknown'} for ${file.name}`);
				}
		}
	} finally {
		await conn.close();
	}
}

async function insertCsvFile(
	conn: AsyncDuckDBConnection,
	file: File,
	name: string,
	options: Partial<InsertCSVOptions> = {}
): Promise<void> {
	try {
		await conn.insertCSVFromPath(file.name, {
			name,
			schema: 'main',
			detect: true,
			header: true,
			...options
		});
	} catch (e) {
		if ((e as Error).message.includes('Could Not Convert')) {
			await insertUntypedCsv(conn, file, name);
		} else {
			throw e;
		}
	}
}

async function insertJsonFile(
	conn: AsyncDuckDBConnection,
	file: File,
	name: string,
	options: Partial<InsertJSONOptions> = {}
): Promise<void> {
	try {
		await conn.insertJSONFromPath(file.name, {
			name,
			schema: 'main',
			...options
		});
	} catch (e) {
		await conn.query(`CREATE VIEW "${name}" AS SELECT * FROM read_json_auto('${file.name}')`);
	}
}

export const DuckDBUtils = {
	escape(value: unknown): string {
		if (value === null || value === undefined) {
			return 'NULL';
		} else if (typeof value === 'string') {
			return `'${value.replace(/'/g, "''")}'`;
		} else if (typeof value === 'number' || typeof value === 'boolean') {
			return String(value);
		} else if (value instanceof Date) {
			return `'${value.toISOString()}'`;
		} else if (Array.isArray(value)) {
			return `[${value.map(DuckDBUtils.escape).join(', ')}]`;
		} else if (typeof value === 'object') {
			return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
		}
		return String(value);
	},

	where(conditions: Record<string, unknown>): string {
		const clauses = Object.entries(conditions).map(([key, value]) => {
			if (value === null || value === undefined) {
				return `"${key}" IS NULL`;
			} else {
				return `"${key}" = ${DuckDBUtils.escape(value)}`;
			}
		});

		return clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
	},

	detectCsvDelimiter(content: string): string {
		const lines = content.split('\n', 5).filter(Boolean);
		if (lines.length === 0) return ',';

		const possibleDelimiters = [',', ';', '\t', '|'];
		const counts = new Map<string, number>();

		for (const delimiter of possibleDelimiters) {
			counts.set(delimiter, (lines[0].match(new RegExp(`\\${delimiter}`, 'g')) || []).length);
		}

		for (let i = 1; i < lines.length; i++) {
			for (const delimiter of possibleDelimiters) {
				const count = (lines[i].match(new RegExp(`\\${delimiter}`, 'g')) || []).length;
				if (count !== counts.get(delimiter)) {
					counts.set(delimiter, -1);
				}
			}
		}

		let bestDelimiter = ',';
		let bestCount = -1;

		for (const [delimiter, count] of counts.entries()) {
			if (count > bestCount) {
				bestCount = count;
				bestDelimiter = delimiter;
			}
		}

		return bestDelimiter;
	},

	toLiteral(value: unknown): string {
		if (value === null || value === undefined) {
			return 'NULL';
		} else if (typeof value === 'string') {
			return `'${value.replace(/'/g, "''")}'`;
		} else if (typeof value === 'number') {
			return String(value);
		} else if (typeof value === 'boolean') {
			return value ? 'TRUE' : 'FALSE';
		} else if (value instanceof Date) {
			return `TIMESTAMP '${value.toISOString()}'`;
		} else if (Array.isArray(value)) {
			return `[${value.map(DuckDBUtils.toLiteral).join(', ')}]`;
		} else if (typeof value === 'object') {
			return `'${JSON.stringify(value).replace(/'/g, "''")}'::JSON`;
		}
		return String(value);
	}
};

export class SingletonDatabase {
	/* 🟢 1) ——— singleton handle ——— */
	private static _instance: SingletonDatabase | null = null;

	/* existing fields */
	private client: DuckDBClient | null = null;
	private sources: SourceMap = {};
	private options: DuckDBOpenOptions = {};
	private extensionsLoaded = false;

	/* 🟢 2) ——— make ctor private ——— */
	private constructor(opts: DuckDBOpenOptions = {}) {
		this.options = opts;
	}

	/* 🟢 3) ——— public accessor ——— */
	static getInstance(opts: DuckDBOpenOptions = {}) {
		// First request wins: subsequent callers get the same object
		return (SingletonDatabase._instance ??= new SingletonDatabase(opts));
	}

	/* ▸  Register sources *before* the first init() call  */
	registerSource(name: string, src: Source) {
		if (this.client) throw new Error('Sources must be added before init()');
		this.sources[name] = src;
		return this;
	}

	/* unchanged ↓ but trimmed for brevity … */
	async init(): Promise<DuckDBClient> {
		if (!this.client) {
			this.client = await DuckDBClient.create(this.sources, this.options);

			await this.loadCoreExtensions();
		}
		return this.client;
	}

	static async close() {
		await SingletonDatabase._instance?.client?.close(); // tidy up old client
	}
	/* add an optional reset helper */
	static async reset(opts: DuckDBOpenOptions = {}) {
		await SingletonDatabase._instance?.client?.close(); // tidy up old client
		SingletonDatabase._instance = new SingletonDatabase(opts);
		return SingletonDatabase._instance;
	}

	private async loadCoreExtensions() {
		if (this.extensionsLoaded || !this.client) return;

		await this.client.query(`INSTALL spatial;`);
		await this.client.query(`LOAD spatial;`);
		this.extensionsLoaded = true;
	}

	async addExtension(extension: string): Promise<void> {
		if (!this.client) {
			throw new Error('Database must be initialized before adding extensions');
		}
		try {
			await this.client?.query(`
				INSTALL ${extension};
				LOAD ${extension};
				`);
		} catch (error) {
			throw new Error(
				`Failed to Install or Load extension ${extension}: ${error instanceof Error ? error.message : String(error)}`
			);
		}
	}

	/* Check if specific extension is available */
	async hasExtension(extensionName: string): Promise<boolean> {
		if (!this.client) return false;

		try {
			const result = await this.client.query(
				`
					SELECT extension_name 
					FROM duckdb_extensions() 
					WHERE extension_name = ? AND loaded = true
				`,
				[extensionName]
			);

			return result.length > 0;
		} catch (error) {
			return false;
		}
	}
}

// Example usage
async function example() {
	// Create a database

	// Create a table with data
	const userData = [
		{ id: 1, name: 'Alice', age: 30, active: true },
		{ id: 2, name: 'Bob', age: 25, active: false },
		{ id: 3, name: 'Charlie', age: 35, active: true }
	];

	try {
		// Initialize client
		const db = await SingletonDatabase.getInstance();
		const client = await db.init();
		// Create table
		await client.createTable('users', userData);

		// Run a query
		const results = await client.query('SELECT * FROM users WHERE age > ?', [28]);
		console.log('Query results:', results);

		// Run a scalar query
		const count = await client.queryScalar<number>('SELECT COUNT(*) FROM users WHERE active = ?', [
			true
		]);
		console.log('Active users count:', count);

		// Sample table
		const sample = await client.sampleTable('users', 2);
		console.log('Sample data:', sample);

		// Get table stats
		const stats = await client.tableStats('users');
		console.log('Table stats:', stats);

		// Using template literal syntax
		const activeUsers = await client.sql`SELECT * FROM users WHERE active = ${true}`;
		console.log('Active users:', activeUsers);
	} catch (error) {
		console.error('Error:', error);
	} finally {
		// Close the database
		await SingletonDatabase.close();
	}
}
