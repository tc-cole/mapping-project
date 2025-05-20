import { storeFromLocalStorage } from '$lib/components/io/storage';
import { writable } from 'svelte/store';
import type { TableField } from './DuckDBWASMClient.svelte';
import { LayerStore } from './layer-management.svelte';

type FileUpload = {
	filename: string;
	datasetID: string;
	schema: TableField[];
};

export const fileUploadStore = writable<FileUpload[]>(storeFromLocalStorage('fileUploadStore', []));
export const chosenDataset = writable<FileUpload | null>(
	storeFromLocalStorage('chosenDataset', null)
);

export const layers = new LayerStore();
export const mapboxDrawInstance = writable<any>();
export const editableGeoJSON = writable<any[]>([]);
export const openDrawer = writable<boolean>(false);
export const clickedGeoJSON = writable();
export const openSidebar = writable<boolean>(true);
