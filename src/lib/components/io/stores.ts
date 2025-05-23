import { storeFromLocalStorage } from '$lib/components/io/storage';
import { writable } from 'svelte/store';
import type { TableField } from './DuckDBWASMClient.svelte';
import { LayerStore } from './layer-management.svelte';
import { type MapViewState } from '@deck.gl/core';

type Dataset = {
	datasetName: string;
	datasetID: string;
	schema: TableField[];
};

export const datasets = writable<Dataset[]>(storeFromLocalStorage('datasets', []));
export const chosenDataset = writable<Dataset | null>(storeFromLocalStorage('chosenDataset', null));

export const layers = new LayerStore();
export const mapboxDrawInstance = writable<any>();
export const editableGeoJSON = writable<any[]>([]);
export const openDrawer = writable<boolean>(false);
export const clickedGeoJSON = writable<any | undefined>();
export const openSidebar = writable<boolean>(true);
export const geometryTableMap = writable<Map<string, string>>(new Map());

export const mapViewState = writable<MapViewState>({
	longitude: -74,
	latitude: 40.7,
	zoom: 4,
	maxZoom: 16,
	pitch: 0,
	bearing: 0
});
