<script lang="ts">
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props(); 
</script>

<!-- <svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head> -->

{@render children()}
