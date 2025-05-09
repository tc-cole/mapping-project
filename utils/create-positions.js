// create-csv.js
import { writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

/* --------------- tweakables --------------- */
const ROWS = 10_000; // how many rows to create
const OUT_FILE = 'positions.csv'; // path to write
const BBOX = {
	// bounding box (SF as example)
	minLat: 37.7,
	maxLat: 37.83,
	minLon: -122.53,
	maxLon: -122.35
};
/* ------------------------------------------ */

const rnd = (a, b) => Math.random() * (b - a) + a;

// header
let csv = 'entity_id,timestamp,latitude,longitude\n';

for (let i = 0; i < ROWS; i++) {
	const id = 'E-' + randomUUID().slice(0, 4);
	const time = new Date(Date.now() - Math.random() * 86_400_000).toISOString(); // past 24 h
	const lat = rnd(BBOX.minLat, BBOX.maxLat).toFixed(6);
	const lon = rnd(BBOX.minLon, BBOX.maxLon).toFixed(6);
	csv += `${id},${time},${lat},${lon}\n`;
}

await writeFile(OUT_FILE, csv, 'utf8');
console.log(`✅  wrote ${ROWS.toLocaleString()} rows to ${OUT_FILE}`);
