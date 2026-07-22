<script lang="ts">
    import { App } from 'obsidian';
    import { type PluginSettings } from '../settings';
    import { MapContainer } from '../mapContainer';
    import MapViewPlugin from '../main';
    import { mergeStates } from '../mapState';
    import KeyboardNavList, { type NavItem } from './KeyboardNavList.svelte';

    // Fuzzy, keyboard-navigable modal that mirrors the "View" section of the
    // controls panel. Digits 1-9 (or Enter) run the Nth option; the list stays
    // open so the freshly-updated value is visible in each row's sublabel.
    // One-shot actions (Fit, Reset) close the modal after running. Every change
    // is applied through the same `view` methods the panel uses, so all views
    // stay in sync.

    let { app, plugin, settings, view, close } = $props<{
        app: App;
        plugin: MapViewPlugin;
        settings: PluginSettings;
        view: MapContainer;
        close: () => void;
    }>();

    // Local, reactive mirrors of the displayed values so sublabels refresh the
    // instant an action runs — we don't wait on re-reading view.getState().
    let chosenMapSource = $state(view.getState().chosenMapSource ?? 0);
    let mapMode = $state(settings.chosenMapMode ?? 'auto');
    let markerLabels = $state(view.getState().markerLabels ?? 'off');
    let followMyLocation = $state(!!view.getState().followMyLocation);
    let followActiveNote = $state(!!view.getState().followActiveNote);

    const MAP_MODES = ['auto', 'light', 'dark'];
    const MARKER_LABEL_MODES = ['off', 'left', 'right'];

    const items = $derived<NavItem[]>([
        {
            id: 'source',
            label: 'Map source',
            sublabel: settings.mapSources[chosenMapSource]?.name ?? '',
        },
        {
            id: 'mode',
            label: 'Map mode',
            sublabel: mapMode,
        },
        {
            id: 'labels',
            label: 'Marker labels',
            sublabel: markerLabels,
        },
        {
            id: 'followLoc',
            label: 'Follow my location',
            sublabel: followMyLocation ? 'on' : 'off',
        },
        {
            id: 'followNote',
            label: 'Follow active note',
            sublabel: followActiveNote ? 'on' : 'off',
        },
        {
            id: 'fit',
            label: 'Fit to markers',
            sublabel: '',
        },
        {
            id: 'reset',
            label: 'Reset to default',
            sublabel: '',
        },
    ]);

    function cycleMapSource() {
        const next = (chosenMapSource + 1) % settings.mapSources.length;
        chosenMapSource = next;
        view.highLevelSetViewState({ chosenMapSource: next });
    }

    function cycleMapMode() {
        const next =
            MAP_MODES[(MAP_MODES.indexOf(mapMode) + 1) % MAP_MODES.length];
        mapMode = next;
        // settings is a reactive proxy; saveSettings persists it and refreshMap
        // re-picks light/dark tiles for the new mode.
        settings.chosenMapMode = next;
        plugin.saveSettings();
        view.refreshMap();
    }

    function cycleMarkerLabels() {
        const next =
            MARKER_LABEL_MODES[
                (MARKER_LABEL_MODES.indexOf(markerLabels) + 1) %
                    MARKER_LABEL_MODES.length
            ];
        markerLabels = next;
        view.highLevelSetViewState({ markerLabels: next });
    }

    function toggleFollowMyLocation() {
        followMyLocation = !followMyLocation;
        view.highLevelSetViewState({ followMyLocation });
    }

    function toggleFollowActiveNote() {
        const next = !followActiveNote;
        followActiveNote = next;
        // Mirrors the panel: clearing "follow active note" also resets the query
        // to prevent user confusion.
        const partial: any = { followActiveNote: next };
        if (!next) partial.query = '';
        view.highLevelSetViewState(partial);
    }

    function fitToMarkers() {
        view.autoFitMapToMarkers();
        close();
    }

    function resetToDefault() {
        const merged = mergeStates(view.getState(), view.defaultState);
        view.highLevelSetViewState(merged);
        close();
    }

    function onSelect(item: NavItem) {
        switch (item.id) {
            case 'source':
                cycleMapSource();
                break;
            case 'mode':
                cycleMapMode();
                break;
            case 'labels':
                cycleMarkerLabels();
                break;
            case 'followLoc':
                toggleFollowMyLocation();
                break;
            case 'followNote':
                toggleFollowActiveNote();
                break;
            case 'fit':
                fitToMarkers();
                break;
            case 'reset':
                resetToDefault();
                break;
        }
    }
</script>

<div class="mv-view-modal">
    <div class="mv-kbd-title">View</div>
    <KeyboardNavList
        {items}
        placeholder="Filter options…"
        stayOpen={true}
        showActiveState={false}
        emptyText="No options"
        onSelect={(item) => onSelect(item)}
        {close}
    />
</div>

<style>
    .mv-view-modal {
        min-width: 300px;
    }

    .mv-kbd-title {
        font-weight: 600;
        margin-bottom: 8px;
    }
</style>
