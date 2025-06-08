import type { TableField } from './io/DuckDBWASMClient.svelte';

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

interface FileSource {
	type: 'file';
	originalFilename: string;
	fileType: string; // 'csv', 'geojson', 'parquet', etc.
	uploadedAt: Date;
	fileHandle?: File; // For browser storage
	importOptions?: Record<string, any>;
}

type DatasetSource = FileSource | DrawnSource | ComputedSource | FilteredSource;

export interface LocationPattern {
	type: LocationColumnType;
	patterns: RegExp[];
	confidence: number;
	description: string;
}

export interface Dataset {
	// Core Identity
	datasetID: string;
	datasetLabel: string; // User-friendly display name
	datasetType: DatasetType; // 'file' | 'drawn' | 'computed' | 'filtered'
	datasetName: string; // Table name in DuckDB
	layerID: string;

	// Schema & Structure
	schema: TableField[];
	rowCount?: number;
	fileSize?: number; // bytes

	// Source Information
	source: DatasetSource;

	// Processing Status
	status: ProcessingStatus;

	// UI Metadata
	icon?: any; // Lucide icon component
	color?: string; // Theme color for UI
	tags?: string[]; // User-defined tags

	// Statistics & Preview
	statistics?: DatasetStatistics;
	previewData?: Record<string, any>[]; // First few rows for preview

	// Timestamps
	createdAt: Date;
	updatedAt: Date;
	lastAccessedAt?: Date;

	// Performance & Indexing
	indexed?: {
		spatialIndex: boolean;
		columnIndexes: string[];
		optimized: boolean;
	};

	// Relationships
	parentDatasetId?: string; // For filtered/computed datasets
	childDatasetIds?: string[]; // Datasets derived from this one

	// Validation & Quality
	quality?: DataQuality;

	// ========== SPECIALIZED METADATA ==========
	metadata?: {
		// Location-specific metadata
		location?: {
			// Auto-detected recommendations
			recommendations: {
				detectedColumns: LocationColumnDetection[];
				suggestedCoordinatePairs: Array<{
					latitude: string;
					longitude: string;
					confidence: number;
				}>;
				geographicBounds?: {
					north: number;
					south: number;
					east: number;
					west: number;
				};
				coordinateSystem?: string; // 'WGS84', 'Web Mercator', etc.
				analyzedAt: Date;
				sampleDataAnalyzed: boolean;
				fileProcessed: string;
			};

			// User-chosen/confirmed columns
			chosenColumns: {
				latitude?: string;
				longitude?: string;
				address?: string;
				postalCode?: string;
				region?: string;
				country?: string;
			};

			// Spatial coverage analysis
			spatialCoverage?: {
				country?: string[];
				region?: string[];
				city?: string[];
				estimatedScale: 'global' | 'continental' | 'national' | 'regional' | 'local';
			};

			// Validation status
			validation?: {
				coordinatesValidated: boolean;
				invalidCoordinateCount: number;
				outOfBoundsCount: number;
				lastValidatedAt?: Date;
			};
		};

		// Geometry-specific metadata
		geometry?: {
			// Geometry identification
			geometryId: string; // Unique identifier for this geometry

			// Shape information
			shape: {
				type:
					| 'Point'
					| 'LineString'
					| 'Polygon'
					| 'MultiPolygon'
					| 'MultiPoint'
					| 'MultiLineString'
					| 'GeometryCollection';
				featureCount: number;
				bounds: {
					north: number;
					south: number;
					east: number;
					west: number;
				};
				area?: number; // For polygons (square meters)
				length?: number; // For lines (meters)
				centroid?: [number, number]; // [lng, lat]
			};

			// Drawing context (for drawn geometries)
			drawingContext?: {
				tool: 'point' | 'line' | 'polygon' | 'rectangle' | 'circle';
				createdBy: 'user' | 'system' | 'import';
				editHistory?: Array<{
					timestamp: Date;
					action: 'create' | 'modify' | 'delete' | 'move';
					description?: string;
				}>;
			};

			// Geometry properties
			properties?: {
				hasZ: boolean; // 3D coordinates
				hasM: boolean; // Measure values
				coordinateCount: number;
				ringCount?: number; // For polygons
			};

			// Usage tracking
			usage?: {
				usedAsFilter: boolean;
				usedAsMask: boolean;
				linkedLayerIds: string[]; // Layers using this geometry
			};
		};
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

interface DrawnSource {
	type: 'drawn';
	features: GeoJSON.Feature[];
	drawingSession?: {
		startedAt: Date;
		completedAt?: Date;
		toolUsed: string;
	};
}

interface ComputedSource {
	type: 'computed';
	computationType: 'aggregation' | 'join' | 'transform' | 'analysis';
	sourceDatasetIds: string[];
	query: string; // SQL or computation description
	parameters?: Record<string, any>;
}

interface FilteredSource {
	type: 'filtered';
	baseDatasetId: string;
	filterGeometry?: GeoJSON.Feature;
	filterExpression?: string; // SQL WHERE clause
	spatialOperation?: 'intersects' | 'contains' | 'within';
}

// Processing status
interface ProcessingStatus {
	state: 'pending' | 'processing' | 'ready' | 'error' | 'stale';
	progress?: number; // 0-100
	message?: string;
	errors?: ProcessingError[];
	warnings?: string[];
}

interface ProcessingError {
	code: string;
	message: string;
	severity: 'error' | 'warning' | 'info';
	affectedRows?: number;
	column?: string;
}

// Dataset statistics
interface DatasetStatistics {
	rowCount: number;
	columnCount: number;
	nullCounts: Record<string, number>;
	uniqueCounts: Record<string, number>;

	// Numeric columns
	numericSummary?: Record<
		string,
		{
			min: number;
			max: number;
			mean: number;
			median: number;
			stdDev: number;
		}
	>;

	// String columns
	categoricalSummary?: Record<
		string,
		{
			topValues: Array<{ value: string; count: number }>;
			uniqueCount: number;
		}
	>;
}

// Data quality metrics
interface DataQuality {
	completeness: number; // % of non-null values
	validity: number; // % of valid values (proper format)
	consistency: number; // % consistent with expected patterns
	accuracy?: number; // If validation data available
	issues: QualityIssue[];
}

interface QualityIssue {
	type: 'missing_data' | 'invalid_format' | 'outlier' | 'duplicate' | 'inconsistent';
	column: string;
	severity: 'low' | 'medium' | 'high';
	affectedRows: number;
	description: string;
	suggestion?: string;
}

// Type definitions
type DatasetType = 'file' | 'drawn' | 'computed' | 'filtered';

// Location detection
interface LocationColumnDetection {
	column: string;
	type: 'latitude' | 'longitude' | 'address' | 'postal_code' | 'geometry';
	confidence: number;
	samples: string[];
}
