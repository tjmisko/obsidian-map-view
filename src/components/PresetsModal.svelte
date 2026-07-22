<script lang="ts">
    import { App } from 'obsidian';
    import { type PluginSettings } from '../settings';
    import { MapContainer } from '../mapContainer';
    import MapViewPlugin from '../main';
    import { mergeStates, type MapState } from '../mapState';
    import KeyboardNavList, { type NavItem } from './KeyboardNavList.svelte';

    // Fuzzy, keyboard-navigable modal for applying a saved preset to this view.
    // Digits 1-9 (and Enter/click) choose the Nth visible preset; unlike the
    // Layers modal this closes after a choice (stayOpen=false), because applying
    // a preset is a one-shot action. The chosen preset is merged onto the current
    // state and pushed through `view.highLevelSetViewState`, which re-renders the
    // map and re-syncs the controls panel.

    let { app, plugin, settings, view, close } = $props<{
        app: App;
        plugin: MapViewPlugin;
        settings: PluginSettings;
        view: MapContainer;
        close: () => void;
    }>();

    // Index 0 is always the Default preset (view.defaultState); the rest come
    // from the user's saved states. This mirrors the presets list built by
    // ViewControlsPanel so the ordering matches.
    const presets: MapState[] = [
        view.defaultState,
        ...(settings.savedStates ?? []),
    ];

    // `item.id` carries the *original* index into `presets`, so filtering the
    // list doesn't misalign the selection (KeyboardNavList's callback index is
    // relative to the filtered view).
    const items: NavItem[] = presets.map((preset, i) => ({
        id: String(i),
        label: preset.name ?? (i === 0 ? 'Default' : `Preset ${i}`),
    }));

    function apply(index: number) {
        const preset = presets[index];
        if (!preset) return;
        const merged = mergeStates(view.getState(), preset);
        view.highLevelSetViewState(merged);
    }
</script>

<div class="mv-presets-modal">
    <div class="mv-kbd-title">Apply preset</div>
    <KeyboardNavList
        {items}
        placeholder="Filter presets…"
        stayOpen={false}
        showActiveState={false}
        emptyText="No presets"
        onSelect={(item) => apply(parseInt(item.id, 10))}
        {close}
    />
</div>

<style>
    .mv-presets-modal {
        min-width: 300px;
    }

    .mv-kbd-title {
        font-weight: 600;
        margin-bottom: 8px;
    }
</style>
