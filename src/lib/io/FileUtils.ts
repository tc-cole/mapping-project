import type { Dataset } from '$lib/types';

export function getTableName(name: string): string {
	var f_name = stripSpaces(name);
	return f_name.substring(0, name.lastIndexOf('.'));
}

export function stripSpaces(name: string): string {
	var f_name = name.trim().replace('/s+/g', '_');
	return f_name.split(' ').join('_').replace('(|)/g', '');
}

export function checkNameForSpacesAndHyphens(column?: string | null) {
	if (!column) return ''; // Return an empty string for null or undefined values

	if (!column.match('^[a-zA-Z0-9]+$')) {
		column = ['"', column, '"'].join('');
	}

	return column;
}

export function getFileExtension(filename: string) {
	return filename.split('.').pop();
}

export function classifyInput(input: string): 'URL' | 'Filename' | 'Unknown' {
	// More comprehensive regex pattern for URL detection.
	// Covers http, https, ftp, file protocols, IP addresses, localhost, and more.
	const urlPattern = /^(https?|ftp|file):\/\/|^(localhost|(\d{1,3}\.){3}\d{1,3})(:\d+)?(\/\S*)?$/;

	// Regex pattern for filenames. Assumes filenames have characters
	// (excluding directory separators) followed by a dot and a file extension.
	const filenamePattern = /^[^\/\\]*\.([a-z0-9]+)$/i;

	if (urlPattern.test(input)) {
		return 'URL';
	} else if (filenamePattern.test(input)) {
		return 'Filename';
	} else {
		return 'Unknown';
	}
}

/**
 * Searches datasets by filename
 * @param datasets - Array of dataset objects
 * @param searchQuery - The search term to filter by
 * @param caseSensitive - Whether the search should be case sensitive (default: false)
 * @returns Filtered array of datasets matching the search query
 */
export function searchDatasetsByFilename(
	datasets: Dataset[],
	searchQuery: string,
	caseSensitive: boolean = false
): Dataset[] {
	if (!searchQuery.trim()) {
		return datasets; // Return all datasets if search query is empty
	}

	const query = caseSensitive ? searchQuery : searchQuery.toLowerCase();

	return datasets.filter((dataset) => {
		const filename = caseSensitive ? dataset.datasetName : dataset.datasetName.toLowerCase();
		return filename.includes(query);
	});
}
