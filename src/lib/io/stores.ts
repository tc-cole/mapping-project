//import { storeFromLocalStorage } from '$lib/io/storage';
import { writable } from 'svelte/store';
import { LayerStore } from './layer-management.svelte';
import { type MapViewState } from '@deck.gl/core';
import type { Dataset, FilterTableInfo } from '$lib/types';

export const datasets = writable<Dataset[]>([]);
export const currentDataset = writable<Dataset>();

export const layers = new LayerStore();
export const mapboxDrawInstance = writable<any>();
export const editableGeoJSON = writable<any[]>([]);
export const openDrawer = writable<boolean>(false);
export const clickedGeoJSON = writable<any | undefined>();
export const openSidebar = writable<boolean>(true);
export const geometryTableMap = writable<Map<string, FilterTableInfo>>(new Map());

export const dataTableDialogOpen = writable<boolean>(false);

// Currently selected geometry (for easy access)
export const selectedGeometryId = writable<string | null>(null);

export const mapViewState = writable<MapViewState>({
	longitude: -74,
	latitude: 40.7,
	zoom: 4,
	maxZoom: 16,
	pitch: 0,
	bearing: 0
});
