import type { TableField } from './io/DuckDBWASMClient.svelte';
export interface LocationColumnDetection {
	column: string;
	type: LocationColumnType;
	confidence: number;
	suggestions?: string[];
}

export type LocationColumnType =
	| 'latitude'
	| 'longitude'
	| 'address'
	| 'city'
	| 'state'
	| 'country'
	| 'postal_code'
	| 'coordinate_pair'
	| 'place_name'
	| 'street'
	| 'building'
	| 'region';

export interface LocationPattern {
	type: LocationColumnType;
	patterns: RegExp[];
	confidence: number;
	description: string;
}

export interface Dataset {
	datasetID: string;
	schema: TableField[];
	datasetName: string;
	locationRecommendations?: {
		detectedColumns: LocationColumnDetection[];
		suggestedCoordinatePairs: Array<{
			latitude: string;
			longitude: string;
			confidence: number;
		}>;
		analyzedAt: Date;
		sampleDataAnalyzed: boolean;
		fileProcessed: string;
	};
}

export interface FilterTableInfo {
	tableName: string;
	geometryId: string;
	geometrySnapshot: string;
	rowCount: number;
	columns: string[];
	sourceTable: string;
	lastUsed: number;
	created: number;
}
