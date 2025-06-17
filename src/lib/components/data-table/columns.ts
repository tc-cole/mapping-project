import { renderComponent } from '$lib/components/ui/data-table/index.js';
import DataTableSortable from './data-table-sortable.svelte';

function formatDate(value: any): string {
	return new Date(value).toLocaleDateString();
}

function formatNumber(value: any): string {
	return value.toString();
}

function formatObject(value: any): string {
	return JSON.stringify(value);
}

function capitalize(str: string): string {
	return str.charAt(0).toUpperCase() + str.slice(1);
}

type Schema<Key extends string, T> = {
	columnName: Key;
	type: T;
};

type ColumnTypes = 'string' | 'number' | 'date' | 'object';
type DatabaseSchema = Schema<string, ColumnTypes>[];

export function createTableColumns(schema: DatabaseSchema) {
	const columns = [
		{
			id: 'select',
			enableSorting: false,
			enableHiding: false
		}
	];

	// Add dynamic data columns based on schema
	schema.forEach((column) => {
		const { columnName, type } = column;

		//if (['select', 'actions'].includes(columnName)) {
		//	return;
		//}

		let columnDef = {
			accessorKey: columnName, //@ts-expect-error
			header: ({ column }) =>
				renderComponent(DataTableSortable, {
					onclick: () => column.toggleSorting(column.getIsSorted() === 'asc'),
					innerText: capitalize(columnName), // Display the capitalized column name
					'aria-label': `Sort by ${columnName}`,
					variant: 'ghost',
					columnName
				}),
			cell: ({ row }) => {
				const value = row.getValue(columnName);

				// Customize cell rendering based on type
				switch (type) {
					case 'string':
						return value;
					case 'number':
						return formatNumber(value);
					case 'date':
						return formatDate(value);
					case 'object':
						return formatObject(value);
					default:
						return value;
				}
			}
		};

		//@ts-expect-error
		columns.push(columnDef);
	});

	// Actions column

	//columns.push({
	//	id: 'actions', //@ts-expect-error
	//	cell: ({ row }) => {
	//		return renderComponent(DataTableActions, { id: row.original.id });
	//	}
	//});

	return columns;
}
