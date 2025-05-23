import { geometryTableMap } from './stores';
import { SingletonDatabase } from './DuckDBWASMClient.svelte';

export class GeometryFilterManager {
	private static instance: GeometryFilterManager;
	private maxCachedTables = 5;

	static getInstance() {
		if (!this.instance) {
			this.instance = new GeometryFilterManager();
		}
		return this.instance;
	}

	// Generate stable ID for geometry
	private getGeometryId(feature: any): string {
		// Try feature ID first
		if (feature.id) return String(feature.id);

		// Try properties ID
		if (feature.properties?.id) return String(feature.properties.id);

		// Fall back to content hash for anonymous geometries
		const geometryStr = JSON.stringify(feature.geometry);
		const hash = this.simpleHash(geometryStr);
		return `hash_${hash}`;
	}

	private simpleHash(str: string): string {
		let hash = 0;
		for (let i = 0; i < str.length; i++) {
			const char = str.charCodeAt(i);
			hash = (hash << 5) - hash + char;
			hash = hash & hash;
		}
		return Math.abs(hash).toString(36).slice(0, 8);
	}

	private geometryChanged(feature: any, existingInfo: FilterTableInfo): boolean {
		const currentGeometry = JSON.stringify(feature.geometry);
		return currentGeometry !== existingInfo.geometrySnapshot;
	}

	private async cleanupOldTables(client: any, keepGeometryId?: string) {
		// Get current map state
		let currentMap: Map<string, FilterTableInfo> = new Map();
		geometryTableMap.subscribe((map) => {
			currentMap = map;
		})();

		const entries = Array.from(currentMap.entries());

		// Sort by last used time, keep most recent ones
		entries.sort((a, b) => b[1].lastUsed - a[1].lastUsed);

		// Remove excess tables
		const entriesToRemove = entries.slice(this.maxCachedTables);

		for (const [geometryId, info] of entriesToRemove) {
			if (geometryId !== keepGeometryId) {
				try {
					await client.query(`DROP TABLE IF EXISTS ${info.tableName}`);

					// Update the store
					geometryTableMap.update((map) => {
						map.delete(geometryId);
						return new Map(map);
					});

					console.log(`Cleaned up old filter table: ${info.tableName}`);
				} catch (e) {
					console.warn(`Failed to cleanup table ${info.tableName}:`, e);
				}
			}
		}
	}

	async getOrCreateFilterTable(
		feature: any,
		client: any,
		sourceTable: string,
		columns: string[]
	): Promise<FilterTableInfo | null> {
		const geometryId = this.getGeometryId(feature);

		// Get current map state
		let currentMap: Map<string, FilterTableInfo> = new Map();
		geometryTableMap.subscribe((map) => {
			currentMap = map;
		})();

		const existingFilter = currentMap.get(geometryId);

		// Check if we can reuse existing table
		if (existingFilter && !this.geometryChanged(feature, existingFilter)) {
			console.log(`Reusing existing filter table: ${existingFilter.tableName}`);
			existingFilter.lastUsed = Date.now();

			// Update the store with new timestamp
			geometryTableMap.update((map) => {
				map.set(geometryId, existingFilter);
				return new Map(map);
			});

			return existingFilter;
		}

		// Create new table name
		const timestamp = Date.now();
		const tableName = `filter_${geometryId}_${timestamp}`;

		try {
			// Clean up old table for this geometry if it exists
			if (existingFilter) {
				try {
					await client.query(`DROP TABLE IF EXISTS ${existingFilter.tableName}`);
				} catch (e) {
					console.warn('Failed to drop old filter table:', e);
				}
			}

			// Create the new filtered table
			const columnsStr = columns.join(', ');
			const geojsonString = JSON.stringify(feature.geometry);

			const sql = `
                CREATE TABLE ${tableName} AS
                SELECT ${columnsStr} FROM ${sourceTable}
                WHERE ST_Within(
                    ST_Point(${columns[1]}, ${columns[0]}), 
                    ST_GeomFromGeoJSON('${geojsonString}')
                )
            `;

			await client.query(sql);

			// Get row count
			const rowCount = await client.queryScalar(`SELECT COUNT(*) FROM ${tableName}`);

			// Create filter info
			const filterInfo: FilterTableInfo = {
				tableName,
				geometryId,
				geometrySnapshot: JSON.stringify(feature.geometry),
				rowCount: rowCount || 0,
				columns,
				sourceTable,
				lastUsed: Date.now(),
				created: Date.now()
			};

			// Update the store
			geometryTableMap.update((map) => {
				map.set(geometryId, filterInfo);
				return new Map(map);
			});

			// Clean up old tables periodically
			await this.cleanupOldTables(client, geometryId);

			console.log(
				`Created filter table ${tableName} with ${rowCount} rows for geometry ${geometryId}`
			);
			return filterInfo;
		} catch (error) {
			console.error('Error creating filter table:', error);
			return null;
		}
	}

	// Remove specific filter
	async removeFilter(geometryId: string, client: any) {
		let currentMap: Map<string, FilterTableInfo> = new Map();
		geometryTableMap.subscribe((map) => {
			currentMap = map;
		})();

		const filter = currentMap.get(geometryId);
		if (filter) {
			try {
				await client.query(`DROP TABLE IF EXISTS ${filter.tableName}`);

				geometryTableMap.update((map) => {
					map.delete(geometryId);
					return new Map(map);
				});

				console.log(`Removed filter table: ${filter.tableName}`);
			} catch (e) {
				console.warn('Failed to remove filter table:', e);
			}
		}
	}
}

interface FilterTableInfo {
	tableName: string;
	geometryId: string;
	geometrySnapshot: string;
	rowCount: number;
	columns: string[];
	sourceTable: string;
	lastUsed: number;
	created: number;
}

export function getGeometryId(feature: any): string {
	if (feature.id) return String(feature.id);
	if (feature.properties?.id) return String(feature.properties.id);

	// Generate hash for anonymous geometries
	const geometryStr = JSON.stringify(feature.geometry);
	let hash = 0;
	for (let i = 0; i < geometryStr.length; i++) {
		const char = geometryStr.charCodeAt(i);
		hash = (hash << 5) - hash + char;
		hash = hash & hash;
	}
	return `hash_${Math.abs(hash).toString(36).slice(0, 8)}`;
}

// Utility functions to work with the geometry-table mapping
export function getTableForGeometry(geometryId: string): string | null {
	let tableName: string | null = null;

	geometryTableMap.subscribe((map) => {
		const info = map.get(geometryId);
		tableName = info?.tableName || null;
	})();

	return tableName;
}

export function getFilterInfoForGeometry(geometryId: string): FilterTableInfo | null {
	let filterInfo: FilterTableInfo | null = null;

	geometryTableMap.subscribe((map) => {
		filterInfo = map.get(geometryId) || null;
	})();

	return filterInfo;
}

export function getAllGeometryFilters(): Array<[string, FilterTableInfo]> {
	let entries: Array<[string, FilterTableInfo]> = [];

	geometryTableMap.subscribe((map) => {
		entries = Array.from(map.entries());
	})();

	return entries;
}

// Function to query data from a specific geometry's table
export async function queryGeometryData(geometryId: string, sql: string): Promise<any[]> {
	const tableName = getTableForGeometry(geometryId);

	if (!tableName) {
		throw new Error(`No filter table found for geometry: ${geometryId}`);
	}

	const db = SingletonDatabase.getInstance();
	const client = await db.init();

	// Replace 'filtered_data' placeholder in SQL with actual table name
	const actualSql = sql.replace(/\bfiltered_data\b/g, tableName);

	console.log(`Querying geometry ${geometryId} table ${tableName}: ${actualSql}`);

	return await client.query(actualSql);
}
