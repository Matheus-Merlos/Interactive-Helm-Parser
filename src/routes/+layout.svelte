<script lang="ts">
	import type { LayoutProps } from './$types';
	import '@shoelace-style/shoelace/dist/themes/dark.css'

	let { children }: LayoutProps = $props(); 
</script>

<!-- <svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head> -->

<div class="sl-theme-dark app-shell">
    {@render children()}
</div>

<style>
	.app-shell {
        min-height: 100vh;
        background-color: var(--sl-color-neutral-950);
        color: var(--sl-color-neutral-50);
        font-family: var(--sl-font-sans);
    }
</style>
