<script lang="ts">
    import { App } from 'obsidian';
    import { type PluginSettings } from '../settings';
    import { MapContainer } from '../mapContainer';
    import MapViewPlugin from '../main';
    import KeyboardNavList, { type NavItem } from './KeyboardNavList.svelte';

    // Fuzzy, keyboard-navigable modal for toggling boundary layers on/off for
    // this view. Digits 1-9 toggle the Nth visible layer; the modal stays open
    // so several layers can be flipped in one session. Applying a change goes
    // through `view.highLevelSetViewState`, which re-renders the map and
    // re-syncs the controls panel.

    let { app, plugin, settings, view, close } = $props<{
        app: App;
        plugin: MapViewPlugin;
        settings: PluginSettings;
        view: MapContainer;
        close: () => void;
    }>();

    // Local, reactive mirror of the enabled-ids set so the list re-renders as we
    // toggle. Reassigned (never mutated) so Svelte + areStatesEqual see a clean
    // diff — the same discipline the controls panel uses.
    let enabledIds: string[] = $state([
        ...(view.getState().enabledBoundaryLayerIds ?? []),
    ]);

    const items = $derived<NavItem[]>(
        (settings.boundaryLayers ?? []).map((bl: any) => ({
            id: bl.id,
            label: bl.name,
            active: enabledIds.includes(bl.id),
        })),
    );

    function toggle(item: NavItem) {
        const next = enabledIds.includes(item.id)
            ? enabledIds.filter((existing) => existing !== item.id)
            : [...enabledIds, item.id];
        enabledIds = next;
        view.highLevelSetViewState({ enabledBoundaryLayerIds: next });
    }
</script>

<div class="mv-kbd-title">Toggle layers</div>
<KeyboardNavList
    {items}
    placeholder="Filter layers…"
    stayOpen={true}
    showActiveState={true}
    emptyText="No layers configured"
    onSelect={(item) => toggle(item)}
    {close}
/>

<style>
    .mv-kbd-title {
        font-weight: 600;
        margin-bottom: 8px;
    }
</style>
