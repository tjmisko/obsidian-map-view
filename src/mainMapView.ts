import { WorkspaceLeaf, TAbstractFile, TFile } from 'obsidian';

import { type PluginSettings } from 'src/settings';
import MapViewPlugin from 'src/main';

import { BaseMapView } from 'src/baseMapView';
import { type ViewSettings } from 'src/mapContainer';

export class MainMapView extends BaseMapView {
    constructor(
        leaf: WorkspaceLeaf,
        settings: PluginSettings,
        plugin: MapViewPlugin,
    ) {
        const viewSettings: ViewSettings = {
            showMinimizeButton: true,
            showZoomButtons: true,
            showMapControls: true,
            showFilters: true,
            showView: true,
            viewTabType: 'regular',
            showLinks: true,
            showEmbeddedControls: false,
            showPresets: true,
            showEdit: true,
            showSearch: true,
            showRouting: true,
            showRealTimeButton: true,
            showLockButton: false,
            showOpenButton: false,
            enableModalInteraction: true,
        };

        super(leaf, settings, viewSettings, plugin);
    }

    async onOpen() {
        await super.onOpen();
        // When this pane becomes active, focus the map so modal (vim-like)
        // keystrokes land on it without requiring a click. focusForModal()
        // guards against stealing focus from an input. Registered via
        // registerEvent so it's auto-cleaned when the view closes.
        this.registerEvent(
            this.app.workspace.on(
                'active-leaf-change',
                (leaf: WorkspaceLeaf | null) => {
                    if (leaf === this.leaf) this.mapContainer.focusForModal();
                },
            ),
        );
    }

    getViewType() {
        return 'map';
    }

    getDisplayText() {
        return 'Interactive Map View';
    }
}
