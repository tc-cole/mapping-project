import { storeFromLocalStorage } from '$lib/components/io/storage';
import { writable } from 'svelte/store';
import type { TableField } from './DuckDBWASMClient.svelte';

type FileUpload = {
	filename: string;
	datasetID: string;
	schema: TableField[];
};

export const fileUploadStore = writable<FileUpload[]>(storeFromLocalStorage('fileUploadStore', []));
export const chosenDataset = writable<FileUpload | null>(
	storeFromLocalStorage('chosenDataset', null)
);

export const deckGL = writable<any>(null);
export const layers = writable<any[]>([]);
