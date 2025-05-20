// src/lib/deck/LayerStore.ts
import { writable, get, type Writable } from 'svelte/store';
import { Layer, type MapViewState } from '@deck.gl/core';
import { storeFromLocalStorage } from '$lib/components/io/storage';
import {
	ScatterplotLayer,
	GeoJsonLayer,
	ArcLayer,
	LineLayer,
	PathLayer,
	PolygonLayer,
	TextLayer
} from '@deck.gl/layers';
import { H3HexagonLayer } from '@deck.gl/geo-layers';

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export type LayerType = 'scatter' | 'geojson' | 'arc' | 'line' | 'path' | 'polygon' | 'h3' | 'text';
//| 'trips';

export interface LayerDef {
	label: string; // human‑readable
	ctor: LayerCtor; // Deck.GL constructor
	defaultProps: Record<string, any>; // minimal safe defaults
}

//@ts-expect-error
export type LayerCtor<P = any> = new (props: P) => Layer<P>;

export interface DeckLayerEntry<P = any> {
	id: string;
	ctor: LayerCtor<P> | undefined;
	props: P;
}

type Handler<T> = (payload: T) => void;

interface Events {
	add: DeckLayerEntry;
	remove: { id: string };
	update: { id: string; props: object };
	reorder: { order: string[] };
}

type EventMap = { [K in keyof Events]?: Handler<Events[K]>[] };

export interface LayerStoreOpts {
	persistKey?: string;
	historySize?: number;
}

/* -------------------------------------------------------------------------- */
/* Store implementation                                                       */
/* -------------------------------------------------------------------------- */

export class LayerStore {
	/* ---- static helpers ---- */

	static fromStorage(key: string, opts: LayerStoreOpts = {}) {
		const parsed: DeckLayerEntry[] = storeFromLocalStorage(key, []);
		return new LayerStore(parsed, { ...opts, persistKey: key });
	}

	/* ---- ctor ---- */

	constructor(
		initial: DeckLayerEntry[] = [],
		private opts: LayerStoreOpts = {}
	) {
		this._store = writable(initial);
		if (opts.persistKey) this.persist();
	}

	/* ------------------------------------------------------------------ */
	/* PUBLIC API                                                         */
	/* ------------------------------------------------------------------ */

	/** Svelte store subscription */
	subscribe(run: (v: DeckLayerEntry[]) => void, invalidate?: () => void) {
		return this._store.subscribe(run, invalidate);
	}

	/** Non‑reactive snapshot */
	get snapshot(): DeckLayerEntry[] {
		return get(this._store);
	}

	add(entry: Omit<DeckLayerEntry, 'id'> & { id?: string }) {
		//	@ts-expect-error
		const id = entry.id ?? slug(entry.ctor.name);
		this.ensureUnique(id);
		const layer: DeckLayerEntry = { ...entry, id };
		this.commit((a) => [...a, layer], 'add', layer);
		return id;
	}

	remove(id: string) {
		this.commit((a) => a.filter((l) => l.id !== id), 'remove', { id });
	}

	updateProps(id: string, props: object) {
		this.commit(
			(a) => a.map((l) => (l.id === id ? { ...l, props: { ...l.props, ...props } } : l)),
			'update',
			{ id, props }
		);
	}

	reorder(order: string[]) {
		const map = new Map(this.snapshot.map((l) => [l.id, l]));
		const reordered = order.map((id) => map.get(id)!).filter(Boolean);
		if (reordered.length !== map.size) throw new Error('reorder(): ids mismatch');
		this.commit(() => reordered, 'reorder', { order });
	}

	undo() {
		if (this.histPtr > 0) {
			this.histPtr--;
			this._store.set(this.history[this.histPtr]);
			this.persist();
		}
	}

	redo() {
		if (this.histPtr < this.history.length - 1) {
			this.histPtr++;
			this._store.set(this.history[this.histPtr]);
			this.persist();
		}
	}

	transaction(fn: () => void) {
		this.batching = true;
		fn();
		this.batching = false;
		if (this.pending) {
			this.flush(this.pending);
			this.pending = undefined;
		}
	}

	on<K extends keyof Events>(ev: K, handler: Handler<Events[K]>) {
		//@ts-ignore
		(this.events[ev] ||= []).push(handler);
		return () => {
			const arr = this.events[ev]!;
			const idx = arr.indexOf(handler);
			if (idx > -1) arr.splice(idx, 1);
		};
	}

	/* ------------------------------------------------------------------ */
	/* INTERNALS                                                          */
	/* ------------------------------------------------------------------ */

	private _store: Writable<DeckLayerEntry[]>;
	private events: EventMap = {};

	private batching = false;
	private pending?: DeckLayerEntry[];

	/* ---- history ---- */
	private history: DeckLayerEntry[][] = [];
	private histPtr = -1;

	private commit(
		mutator: (arr: DeckLayerEntry[]) => DeckLayerEntry[],
		ev: keyof Events,
		payload: any
	) {
		const next = mutator(this.snapshot);
		this.flush(next);
		this.emit(ev, payload);
	}

	private flush(next: DeckLayerEntry[]) {
		if (this.batching) {
			this.pending = next;
			return;
		}
		this._store.set(next);
		this.persist();

		if (this.opts.historySize) {
			this.history.splice(++this.histPtr);
			this.history.push(next);
			if (this.history.length > this.opts.historySize) {
				this.history.shift();
				this.histPtr--;
			}
		}
	}

	private emit<K extends keyof Events>(ev: K, p: Events[K]) {
		this.events[ev]?.forEach((h) => h(p));
	}

	private persist() {
		if (!this.opts.persistKey || typeof window === 'undefined') return;

		window.localStorage.setItem(this.opts.persistKey, JSON.stringify(this.snapshot));
	}

	private ensureUnique(id: string) {
		if (this.snapshot.some((l) => l.id === id)) {
			throw new Error(`Layer '${id}' already exists`);
		}
	}
	switchType(id: string, newType: LayerType) {
		const entry = this.snapshot.find((l) => l.id === id);
		if (!entry) throw new Error(`Layer ${id} not found`);

		// build a fresh entry (keeps ID but uses new ctor + default props)
		const newEntry = LayerFactory.create(newType, { id });

		this.transaction(() => {
			const next = this.snapshot.map((l) => (l.id === id ? newEntry : l));
			(this as any).flush(next); // internal flush or make a public replace()
			this.emit('update', { id, props: newEntry.props });
		});
	}
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

let slugCount = 0;

function slug(base: string) {
	return `${base.toLowerCase()}-${++slugCount}`;
}

export const layerDefs: Record<LayerType, LayerDef> = {
	scatter: {
		label: 'Scatterplot',
		ctor: ScatterplotLayer,
		defaultProps: {
			data: [],
			getPosition: (d: any) => d.position ?? [0, 0],
			getRadius: 5,
			getFillColor: [255, 0, 0],
			visible: true,
			opacity: 1
		}
	},
	/**
	trips: {
		label: 'Trip',
		ctor: TripsLayer,
		defaultProps: {
			data: [],
			getPath: (d: any) => d.path ?? [],
			getTimestamps: (d: any) => d.timestamps ?? [],
			getColor: [253, 128, 93],
			getWidth: 2,
			widthMinPixels: 2,
			widthMaxPixels: 10,
			rounded: true,
			trailLength: 0.2,
			currentTime: 0,
			visible: true,
			opacity: 1
		}
	},
	*/

	geojson: {
		label: 'geojson',
		ctor: GeoJsonLayer,
		defaultProps: {
			data: {},
			filled: true,
			stroked: true,
			getFillColor: [0, 128, 255, 128],
			visible: true,
			opacity: 1
		}
	},
	arc: {
		label: 'Arc',
		ctor: ArcLayer,
		defaultProps: {
			data: [],
			getSourcePosition: (d: any) => d.source ?? [0, 0],
			getTargetPosition: (d: any) => d.target ?? [0, 0],
			getSourceColor: [255, 0, 0],
			getTargetColor: [0, 255, 0],
			getWidth: 2,
			visible: true,
			opacity: 1
		}
	},
	line: {
		label: 'Line',
		ctor: LineLayer,
		defaultProps: {
			data: [],
			getSourcePosition: (d: any) => d.source ?? [0, 0],
			getTargetPosition: (d: any) => d.target ?? [0, 0],
			getColor: [0, 0, 255],
			getWidth: 2,
			visible: true,
			opacity: 1
		}
	},
	path: {
		label: 'Path',
		ctor: PathLayer,
		defaultProps: {
			data: {},
			getPath: (d: any) => d.path ?? [],
			getColor: [128, 128, 0],
			getWidth: 3,
			widthUnits: 'pixels',
			visible: true,
			opacity: 1
		}
	},
	polygon: {
		label: 'Polygon',
		ctor: PolygonLayer,
		defaultProps: {
			data: [],
			getPolygon: (d: any) => d.contour ?? [],
			getFillColor: [64, 128, 128, 128],
			getLineColor: [80, 80, 80],
			getLineWidth: 1,
			filled: true,
			stroked: true,
			extruded: false,
			wireframe: false,
			visible: true,
			opacity: 1
		}
	},
	text: {
		label: 'Text',
		ctor: TextLayer,
		defaultProps: {
			data: [],
			getPosition: (d: any) => d.position,
			getText: (d: any) => d.name,
			getAlignmentBaseline: 'center',
			getColor: [255, 128, 0],
			getSize: 16,
			getTextAnchor: 'middle',
			pickable: true
		}
	},
	h3: {
		label: 'H3 Hexagon',
		ctor: H3HexagonLayer,
		defaultProps: {
			data: [],
			getHexagon: (d: any) => d.hex,
			getFillColor: [255, 140, 0, 128],
			getLineColor: [255, 140, 0],
			getLineWidth: 1,
			filled: true,
			stroked: true,
			extruded: false,
			wireframe: false,
			visible: true,
			opacity: 1
		}
	}
};

/** random‑ish but serialisable */
const guid = () => crypto.randomUUID?.() ?? `id-${Date.now()}`;

export const LayerFactory = {
	/**
	 * Create a fully‑formed layer entry by type.
	 * You can pass `overrides.props` or `overrides.id`.
	 */
	create(type: LayerType, overrides: Partial<DeckLayerEntry> = {}): DeckLayerEntry {
		const def = layerDefs[type];
		if (!def) throw new Error(`Unknown layer type: ${type}`);

		return {
			id: overrides.id ?? `${type}-${guid()}`,
			ctor: def.ctor,
			props: { ...def.defaultProps, ...(overrides.props ?? {}) }
		};
	},

	/** Blank placeholder (choose type later) */
	blank(): DeckLayerEntry {
		return {
			id: `layer-${guid()}`,
			ctor: undefined, // signals “not chosen yet”
			props: {}
		} as unknown as DeckLayerEntry;
	}
};

export const mapViewState = writable<MapViewState>({
	longitude: -74,
	latitude: 40.7,
	zoom: 4,
	maxZoom: 16,
	pitch: 0,
	bearing: 0
});
