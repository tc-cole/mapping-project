import { mapViewState } from '$lib/components/widgets/nav-sidebar/io/layer-io.svelte';
import { FlyToInterpolator } from '@deck.gl/core';

export function flyTo(lon: number, lat: number, zoom: number = 10) {
	mapViewState.set({
		longitude: lon,
		latitude: lat,
		zoom: zoom,
		pitch: 30,
		bearing: 0,
		transitionDuration: 1500,
		transitionInterpolator: new FlyToInterpolator(),
		transitionEasing: (t: any) => t
	});
}
