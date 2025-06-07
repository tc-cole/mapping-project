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

export class LocationColumnDetector {
	private layerType?: any;
	constructor(layerType?: any) {
		this.layerType = layerType;
	}
	private patterns: LocationPattern[] = [
		// Latitude patterns
		{
			type: 'latitude',
			confidence: 0.95,
			description: 'Latitude coordinate column',
			patterns: [
				/^lat(itude)?$/i,
				/^y_?coord(inate)?$/i,
				/^geo_?lat$/i,
				/^point_?lat$/i,
				/^lat_?deg(ree)?s?$/i,
				/^latitude_?decimal$/i,
				/^lat_?dd$/i,
				/^decimallatitude$/i,
				/^lat_?coordinate$/i,
				/^y_?position$/i
			]
		},

		// Longitude patterns
		{
			type: 'longitude',
			confidence: 0.95,
			description: 'Longitude coordinate column',
			patterns: [
				/^lon(g(itude)?)?$/i,
				/^lng$/i,
				/^x_?coord(inate)?$/i,
				/^geo_?lon(g)?$/i,
				/^point_?lon(g)?$/i,
				/^lon(g)?_?deg(ree)?s?$/i,
				/^longitude_?decimal$/i,
				/^lon(g)?_?dd$/i,
				/^decimallongitude$/i,
				/^lon(g)?_?coordinate$/i,
				/^x_?position$/i
			]
		},

		// Full address patterns
		{
			type: 'address',
			confidence: 0.9,
			description: 'Complete address field',
			patterns: [
				/^(full_?)?address$/i,
				/^street_?address$/i,
				/^mailing_?address$/i,
				/^physical_?address$/i,
				/^billing_?address$/i,
				/^shipping_?address$/i,
				/^complete_?address$/i,
				/^formatted_?address$/i,
				/^addr(ess)?_?line_?1$/i,
				/^address_?1$/i,
				/^addr1$/i,
				/^location_?address$/i,
				/^full_?location$/i,
				/^geocoded_?address$/i
			]
		},

		// Street/building number patterns
		{
			type: 'street',
			confidence: 0.85,
			description: 'Street name or number',
			patterns: [
				/^street(_?name)?$/i,
				/^road(_?name)?$/i,
				/^avenue$/i,
				/^boulevard$/i,
				/^house_?number$/i,
				/^building_?number$/i,
				/^street_?number$/i,
				/^number$/i,
				/^addr(ess)?_?line_?2$/i,
				/^address_?2$/i,
				/^addr2$/i,
				/^street_?addr(ess)?$/i,
				/^thoroughfare$/i
			]
		},

		// City patterns
		{
			type: 'city',
			confidence: 0.9,
			description: 'City or municipality',
			patterns: [
				/^city$/i,
				/^town$/i,
				/^municipality$/i,
				/^locality$/i,
				/^place$/i,
				/^settlement$/i,
				/^urban_?area$/i,
				/^metro_?area$/i,
				/^metro(politan)?$/i,
				/^admin_?area_?level_?2$/i,
				/^administrative_?area_?level_?2$/i,
				/^suburb$/i,
				/^neighborhood$/i,
				/^district$/i
			]
		},

		// State/Province patterns
		{
			type: 'state',
			confidence: 0.9,
			description: 'State, province, or region',
			patterns: [
				/^state$/i,
				/^province$/i,
				/^region$/i,
				/^territory$/i,
				/^admin_?area_?level_?1$/i,
				/^administrative_?area_?level_?1$/i,
				/^state_?province$/i,
				/^state_?code$/i,
				/^province_?code$/i,
				/^region_?code$/i,
				/^sub_?region$/i,
				/^county$/i,
				/^prefecture$/i
			]
		},

		// Country patterns
		{
			type: 'country',
			confidence: 0.95,
			description: 'Country or nation',
			patterns: [
				/^country$/i,
				/^nation$/i,
				/^country_?name$/i,
				/^country_?code$/i,
				/^iso_?country$/i,
				/^iso2$/i,
				/^iso3$/i,
				/^cc$/i,
				/^nationality$/i,
				/^admin_?area_?level_?0$/i,
				/^administrative_?area_?level_?0$/i
			]
		},

		// Postal code patterns
		{
			type: 'postal_code',
			confidence: 0.9,
			description: 'Postal or ZIP code',
			patterns: [
				/^zip(_?code)?$/i,
				/^postal(_?code)?$/i,
				/^postcode$/i,
				/^post_?code$/i,
				/^zipcode$/i,
				/^zip_?postal$/i,
				/^mail_?code$/i,
				/^area_?code$/i,
				/^pin_?code$/i,
				/^pincode$/i
			]
		},

		// Coordinate pair patterns (combined lat/lng in one field)
		{
			type: 'coordinate_pair',
			confidence: 0.85,
			description: 'Combined latitude/longitude coordinates',
			patterns: [
				/^coordinates?$/i,
				/^coords?$/i,
				/^lat_?lon(g)?$/i,
				/^lon(g)?_?lat$/i,
				/^position$/i,
				/^location$/i,
				/^point$/i,
				/^geo_?point$/i,
				/^geometry$/i,
				/^spatial$/i,
				/^latlng$/i,
				/^latlon$/i,
				/^coordinate_?pair$/i,
				/^geo_?coords?$/i,
				/^gps_?coords?$/i,
				/^wgs84$/i
			]
		},

		// General place name patterns
		{
			type: 'place_name',
			confidence: 0.7,
			description: 'General place or location name',
			patterns: [
				/^place_?name$/i,
				/^location_?name$/i,
				/^venue$/i,
				/^destination$/i,
				/^landmark$/i,
				/^site$/i,
				/^facility$/i,
				/^establishment$/i,
				/^business_?name$/i,
				/^poi$/i, // Point of Interest
				/^point_?of_?interest$/i,
				/^area_?name$/i,
				/^zone$/i
			]
		},

		// Building/structure patterns
		{
			type: 'building',
			confidence: 0.8,
			description: 'Building or structure identifier',
			patterns: [
				/^building$/i,
				/^structure$/i,
				/^apartment$/i,
				/^unit$/i,
				/^suite$/i,
				/^floor$/i,
				/^level$/i,
				/^room$/i,
				/^office$/i,
				/^complex$/i,
				/^tower$/i,
				/^wing$/i
			]
		}
	];

	/**
	 * Detect location-related columns in a dataset schema
	 */
	detectLocationColumns(columns: { name: string; type: string }[]): LocationColumnDetection[] {
		const detections: LocationColumnDetection[] = [];

		for (const column of columns) {
			const detection = this.detectColumnType(column.name, column.type);
			if (detection) {
				detections.push(detection);
			}
		}

		return this.rankAndFilterDetections(detections);
	}

	/**
	 * Detect the type of a single column
	 */
	private detectColumnType(columnName: string, columnType: string): LocationColumnDetection | null {
		const cleanName = columnName.toLowerCase().trim();

		for (const pattern of this.patterns) {
			for (const regex of pattern.patterns) {
				if (regex.test(cleanName)) {
					// Adjust confidence based on data type
					let confidence = pattern.confidence;

					// Coordinate columns should be numeric
					if (
						(pattern.type === 'latitude' || pattern.type === 'longitude') &&
						!this.isNumericType(columnType)
					) {
						confidence *= 0.7;
					}

					// String-based location fields should be text
					if (
						['address', 'city', 'state', 'country', 'place_name'].includes(pattern.type) &&
						this.isNumericType(columnType)
					) {
						confidence *= 0.8;
					}

					return {
						column: columnName,
						type: pattern.type,
						confidence,
						suggestions: this.generateSuggestions(pattern.type)
					};
				}
			}
		}

		return null;
	}

	/**
	 * Sample data to improve detection accuracy
	 */
	async detectWithSampleData(
		columns: { name: string; type: string }[],
		sampleData: Record<string, any>[]
	): Promise<LocationColumnDetection[]> {
		const detections = this.detectLocationColumns(columns);

		// Enhance detections with sample data analysis
		for (const detection of detections) {
			const sampleValues = sampleData.map((row) => row[detection.column]).filter((v) => v != null);

			if (sampleValues.length > 0) {
				detection.confidence = this.adjustConfidenceWithSamples(detection, sampleValues);
			}
		}

		return this.rankAndFilterDetections(detections);
	}

	/**
	 * Adjust confidence based on sample data patterns
	 */
	private adjustConfidenceWithSamples(detection: LocationColumnDetection, samples: any[]): number {
		let confidence = detection.confidence;
		const sampleStrings = samples.map((s) => String(s)).slice(0, 10); // Analyze first 10 samples

		switch (detection.type) {
			case 'latitude':
				// Latitude should be between -90 and 90
				const latValues = sampleStrings.map(Number).filter((n) => !isNaN(n));
				const validLats = latValues.filter((n) => n >= -90 && n <= 90);
				confidence *= validLats.length / latValues.length;
				break;

			case 'longitude':
				// Longitude should be between -180 and 180
				const lngValues = sampleStrings.map(Number).filter((n) => !isNaN(n));
				const validLngs = lngValues.filter((n) => n >= -180 && n <= 180);
				confidence *= validLngs.length / lngValues.length;
				break;

			case 'postal_code':
				// Postal codes often have specific patterns
				const postalPatterns = [
					/^\d{5}$/, // US ZIP
					/^\d{5}-\d{4}$/, // US ZIP+4
					/^[A-Z]\d[A-Z] \d[A-Z]\d$/, // Canadian
					/^\d{4}$/, // Simple 4-digit
					/^[A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2}$/i // UK style
				];
				const postalMatches = sampleStrings.filter((s) => postalPatterns.some((p) => p.test(s)));
				confidence *= postalMatches.length / sampleStrings.length;
				break;

			case 'coordinate_pair':
				// Check if values look like coordinate pairs
				const coordPairs = sampleStrings.filter(
					(s) =>
						/^-?\d+\.?\d*,\s?-?\d+\.?\d*$/.test(s) || // "lat,lng"
						/^-?\d+\.?\d*\s+-?\d+\.?\d*$/.test(s) || // "lat lng"
						/^\(-?\d+\.?\d*,\s?-?\d+\.?\d*\)$/.test(s) // "(lat,lng)"
				);
				confidence *= coordPairs.length / sampleStrings.length;
				break;

			case 'address':
				// Addresses often contain numbers and common words
				const addressIndicators = sampleStrings.filter(
					(s) =>
						/\d+/.test(s) && // Contains numbers
						/\b(st|street|ave|avenue|rd|road|blvd|boulevard|dr|drive|ln|lane|ct|court|pl|place)\b/i.test(
							s
						)
				);
				confidence *= Math.min(1, addressIndicators.length / sampleStrings.length + 0.3);
				break;
		}

		return Math.max(0.1, Math.min(1, confidence));
	}

	/**
	 * Generate usage suggestions for detected location columns
	 */
	private generateSuggestions(type: LocationColumnType): string[] {
		const suggestions: Record<LocationColumnType, string[]> = {
			latitude: ['Use for scatter plot Y coordinate', 'Combine with longitude for mapping'],
			longitude: ['Use for scatter plot X coordinate', 'Combine with latitude for mapping'],
			address: ['Geocode to get coordinates', 'Use for location search'],
			city: ['Group data by city', 'Use for regional analysis'],
			state: ['Regional aggregation', 'Administrative boundaries'],
			country: ['Global analysis', 'Country-level visualization'],
			postal_code: ['Local area analysis', 'Delivery zones'],
			coordinate_pair: ['Parse into separate lat/lng columns', 'Direct mapping use'],
			place_name: ['Location labels', 'Point of interest mapping'],
			street: ['Detailed address analysis', 'Street-level mapping'],
			building: ['Indoor mapping', 'Facility management'],
			region: ['Administrative analysis', 'Regional grouping']
		};

		return suggestions[type] || ['General location analysis'];
	}

	/**
	 * Remove low-confidence detections and handle conflicts
	 */
	private rankAndFilterDetections(
		detections: LocationColumnDetection[]
	): LocationColumnDetection[] {
		// Sort by confidence (highest first)
		detections.sort((a, b) => b.confidence - a.confidence);

		// Filter out very low confidence detections
		return detections.filter((d) => d.confidence > 0.5);
	}

	/**
	 * Check if a data type indicates numeric data
	 */
	private isNumericType(type: string): boolean {
		const numericTypes = ['number', 'integer', 'bigint', 'double', 'float', 'decimal'];
		return numericTypes.includes(type.toLowerCase());
	}

	/**
	 * Auto-suggest coordinate pairs for mapping
	 */
	suggestCoordinatePairs(detections: LocationColumnDetection[]): Array<{
		latitude: string;
		longitude: string;
		confidence: number;
	}> {
		const latColumns = detections.filter((d) => d.type === 'latitude');
		const lngColumns = detections.filter((d) => d.type === 'longitude');

		const pairs = [];

		// Try to match lat/lng columns by name similarity
		for (const lat of latColumns) {
			for (const lng of lngColumns) {
				const similarity = this.calculateNameSimilarity(lat.column, lng.column);
				const confidence = ((lat.confidence + lng.confidence) / 2) * similarity;

				pairs.push({
					latitude: lat.column,
					longitude: lng.column,
					confidence
				});
			}
		}

		return pairs.sort((a, b) => b.confidence - a.confidence);
	}

	/**
	 * Calculate name similarity between columns (for pairing lat/lng)
	 */
	private calculateNameSimilarity(name1: string, name2: string): number {
		const clean1 = name1.toLowerCase().replace(/[^a-z]/g, '');
		const clean2 = name2.toLowerCase().replace(/[^a-z]/g, '');

		// Remove lat/lng specific parts to compare base names
		const base1 = clean1.replace(/(lat|latitude|y|coord|coordinate)/g, '');
		const base2 = clean2.replace(/(lon|lng|longitude|x|coord|coordinate)/g, '');

		if (base1 === base2 && base1.length > 0) {
			return 1.0; // Perfect match on base name
		}

		// Calculate Levenshtein distance for partial similarity
		const maxLen = Math.max(base1.length, base2.length);
		if (maxLen === 0) return 0.8; // Both empty, likely related

		const distance = this.levenshteinDistance(base1, base2);
		return Math.max(0.5, 1 - distance / maxLen);
	}

	/**
	 * Calculate Levenshtein distance between two strings
	 */
	private levenshteinDistance(str1: string, str2: string): number {
		const matrix = [];

		for (let i = 0; i <= str2.length; i++) {
			matrix[i] = [i];
		}

		for (let j = 0; j <= str1.length; j++) {
			matrix[0][j] = j;
		}

		for (let i = 1; i <= str2.length; i++) {
			for (let j = 1; j <= str1.length; j++) {
				if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
					matrix[i][j] = matrix[i - 1][j - 1];
				} else {
					matrix[i][j] = Math.min(
						matrix[i - 1][j - 1] + 1,
						matrix[i][j - 1] + 1,
						matrix[i - 1][j] + 1
					);
				}
			}
		}

		return matrix[str2.length][str1.length];
	}
}

// Singleton instance
export const locationDetector = new LocationColumnDetector();
