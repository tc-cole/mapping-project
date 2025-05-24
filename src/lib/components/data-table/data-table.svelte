<script lang="ts" generics="TData, TValue">
	import {
		type ColumnDef,
		type PaginationState,
		type SortingState,
		type ColumnFiltersState,
		type VisibilityState,
		type RowSelectionState,
		getCoreRowModel,
		getPaginationRowModel,
		getSortedRowModel,
		getFilteredRowModel
	} from '@tanstack/table-core';
	import { createSvelteTable, FlexRender } from '$lib/components/ui/data-table';
	import { Button, buttonVariants } from '$lib/components/ui/button/index.js';

	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import { ChevronDown } from '@lucide/svelte';
	import Input from '$lib/components/ui/input/input.svelte';
	import { page } from '$app/state';

	type DataTableProps<TData, TValue> = {
		data: TData[];
		columns: ColumnDef<TData, TValue>[];
		pageSize: number;
	};

	let { data, columns, pageSize = 5 }: DataTableProps<TData, TValue> = $props();
	let filterColumns = columns.map((x: any) => x.accessorKey);
	let filterColumn = $state(filterColumns[0] ? filterColumns[0] : 'column');

	let pagination = $state<PaginationState>({ pageIndex: 0, pageSize });
	let sorting = $state<SortingState>([]);
	let columnFilters = $state<ColumnFiltersState>([]);
	let columnVisibility = $state<VisibilityState>({});
	let rowSelection = $state<RowSelectionState>({});

	const table = createSvelteTable({
		get data() {
			return data;
		},
		columns,
		getCoreRowModel: getCoreRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		onPaginationChange: (updater) => {
			if (typeof updater === 'function') {
				pagination = updater(pagination);
			} else {
				pagination = updater;
			}
		},
		onSortingChange: (updater) => {
			if (typeof updater === 'function') {
				sorting = updater(sorting);
			} else {
				sorting = updater;
			}
		},
		onColumnFiltersChange: (updater) => {
			if (typeof updater === 'function') {
				columnFilters = updater(columnFilters);
			} else {
				columnFilters = updater;
			}
		},
		onColumnVisibilityChange: (updater) => {
			if (typeof updater === 'function') {
				columnVisibility = updater(columnVisibility);
			} else {
				columnVisibility = updater;
			}
		},
		onRowSelectionChange: (updater) => {
			if (typeof updater === 'function') {
				rowSelection = updater(rowSelection);
			} else {
				rowSelection = updater;
			}
		},
		state: {
			get pagination() {
				return pagination;
			},
			get sorting() {
				return sorting;
			},
			get columnFilters() {
				return columnFilters;
			},
			get columnVisibility() {
				return columnVisibility;
			},
			get rowSelection() {
				return rowSelection;
			}
		}
	});

	const checkCellValue = (cellValue: string | undefined | unknown | null | number): boolean => {
		var validCellValue = cellValue !== null && cellValue !== undefined;
		return validCellValue;
	};
</script>

<div>
	<div class="flex items-center py-4">
		<div class="space-between-5 flex items-center">
			<div class="flex gap-1">
				<Input
					placeholder={`Filter ${filterColumn}`}
					value={(table.getColumn(filterColumn)?.getFilterValue() as string) ?? ''}
					onchange={(e) => {
						table.getColumn(filterColumn)?.setFilterValue(e.currentTarget.value);
					}}
					oninput={(e) => {
						table.getColumn(filterColumn)?.setFilterValue(e.currentTarget.value);
					}}
					class="max-w-sm"
				/>
				<!--Filter Dropdown-->
				<DropdownMenu.Root>
					<DropdownMenu.Trigger class={buttonVariants({ variant: 'outline' })}>
						<ChevronDown />
					</DropdownMenu.Trigger>
					<DropdownMenu.Content class="w-56">
						{#if filterColumns.length > 0}
							{#each filterColumns as column}
								<DropdownMenu.Item
									onclick={() => {
										filterColumn = column;
									}}
								>
									<span>{column}</span>
								</DropdownMenu.Item>
							{/each}
						{:else}
							<DropdownMenu.Item disabled>
								<span>No columns available.</span>
							</DropdownMenu.Item>
						{/if}
					</DropdownMenu.Content>
				</DropdownMenu.Root>
			</div>
		</div>
		<DropdownMenu.Root>
			<DropdownMenu.Trigger>
				{#snippet child({ props })}
					<Button {...props} variant="outline" class="ml-auto">Visible Columns</Button>
				{/snippet}
			</DropdownMenu.Trigger>
			<DropdownMenu.Content align="end">
				{#each table.getAllColumns().filter((col) => col.getCanHide()) as column (column.id)}
					<DropdownMenu.CheckboxItem
						class="capitalize"
						controlledChecked
						checked={column.getIsVisible()}
						onCheckedChange={(value) => column.toggleVisibility(!!value)}
					>
						{column.id}
					</DropdownMenu.CheckboxItem>
				{/each}
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	</div>
	<div class="rounded-md border">
		<Table.Root>
			<Table.Header>
				{#each table.getHeaderGroups() as headerGroup (headerGroup.id)}
					<Table.Row>
						{#each headerGroup.headers as header (header.id)}
							<Table.Head>
								{#if !header.isPlaceholder}
									<FlexRender
										content={header.column.columnDef.header}
										context={header.getContext()}
									/>
								{/if}
							</Table.Head>
						{/each}
					</Table.Row>
				{/each}
			</Table.Header>
			<Table.Body>
				{#each table.getRowModel().rows as row (row.id)}
					<Table.Row data-state={row.getIsSelected() && 'selected'}>
						{#each row.getVisibleCells() as cell (cell.id)}
							<Table.Cell class="relative">
								<DropdownMenu.Root>
									<div class="flex justify-center">
										<FlexRender content={cell.column.columnDef.cell} context={cell.getContext()} />
									</div>

									<!--
									<DropdownMenu.Content>
										<DropdownMenu.Item class="h-full w-full">
											{#if checkCellValue(cell.getValue())}
												<a href="{$page.url.pathname}/{encodeURIComponent(cell.getValue())}">
													Find Alternative Parts
												</a>
											{/if}
										</DropdownMenu.Item>
									</DropdownMenu.Content>
									-->
								</DropdownMenu.Root>
							</Table.Cell>
						{/each}
					</Table.Row>
				{:else}
					<Table.Row>
						<Table.Cell colSpan={columns.length} class="h-24 text-center">No results.</Table.Cell>
					</Table.Row>
				{/each}
			</Table.Body>
		</Table.Root>
	</div>

	<div class="flex items-center justify-end space-x-2 py-4">
		<div class="flex-1 text-sm text-muted-foreground">
			{table.getFilteredSelectedRowModel().rows.length} of{' '}
			{table.getFilteredRowModel().rows.length} row(s) selected.
		</div>
		<Button
			variant="outline"
			size="sm"
			onclick={() => table.previousPage()}
			disabled={!table.getCanPreviousPage()}
		>
			Previous
		</Button>
		<Button
			variant="outline"
			size="sm"
			onclick={() => table.nextPage()}
			disabled={!table.getCanNextPage()}
		>
			Next
		</Button>
	</div>
</div>
