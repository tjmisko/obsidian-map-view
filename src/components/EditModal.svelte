<script lang="ts">
    import { App, getIcon, TFile, type HeadingCache } from 'obsidian';
    import { type PluginSettings } from '../settings';
    import { MapContainer } from '../mapContainer';
    import MapViewPlugin from '../main';
    import { type EditModeTools } from '../viewControls';
    import { NoteSelectDialog } from '../noteSelectDialog';
    import { SimpleInputSuggest } from '../simpleInputSuggest';
    import { getAllTagNames } from '../pluginHelpers';
    import ChipsList from './ChipsList.svelte';

    // On-map editing tools presented as a keyboard-navigable modal, mirroring the
    // "Edit" section of ViewControlsPanel. It reads/writes the shared
    // `view.display.controls.editModeTools` object (whose fields duplicate the
    // local reactive state and are synced manually) and drives the view's
    // `editMode` through `view.highLevelSetViewState`.

    let { app, plugin, settings, view, close } = $props<{
        app: App;
        plugin: MapViewPlugin;
        settings: PluginSettings;
        view: MapContainer;
        close: () => void;
    }>();

    const editModeTools: EditModeTools | undefined =
        view.display?.controls?.editModeTools;

    // Local reactive mirrors, initialized from the shared tools + view state.
    let editMode = $state(!!view.getState().editMode);
    let noteToEdit: TFile = $state(editModeTools?.noteToEdit ?? null);
    let noteHeading: string | null = $state(editModeTools?.noteHeading ?? null);
    let editTags: string[] = $state([...(editModeTools?.tags ?? [])]);

    let allNoteHeadings: string[] = $state([]);
    let addTagInputElement: HTMLInputElement = $state();
    let allTags = getAllTagNames(app, plugin);

    // Sync local state back into the shared tools object.
    $effect(() => {
        if (editModeTools) {
            editModeTools.noteHeading = noteHeading;
            editModeTools.tags = editTags;
            editModeTools.noteToEdit = noteToEdit;
        }
    });

    // Recompute the heading options whenever the chosen note changes.
    $effect(() => {
        if (noteToEdit) {
            const headings = app.metadataCache.getFileCache(noteToEdit)
                ?.headings as HeadingCache[];
            allNoteHeadings = headings
                ? headings.map((heading) => heading.heading)
                : [];
        }
    });

    // Attach the tag autocomplete to the tag input once it's mounted.
    $effect(() => {
        if (addTagInputElement) {
            const suggestor = new SimpleInputSuggest(
                app,
                addTagInputElement,
                allTags,
                (selection: string) => {
                    if (!editTags.includes(selection))
                        // Pushing while reassigning the array helps reactivity here
                        editTags = [...editTags, selection];
                    suggestor.close();
                    addTagInputElement.value = '';
                    addTagInputElement.blur();
                },
            );
        }
    });

    function chooseNote() {
        const dialog = new NoteSelectDialog(
            app,
            plugin,
            settings,
            (selection: any, evt: MouseEvent | KeyboardEvent) => {
                if (selection.file) {
                    noteToEdit = selection.file;
                    if (editModeTools) editModeTools.noteToEdit = noteToEdit;
                    editMode = true;
                    view.highLevelSetViewState({ editMode: true });
                }
            },
            'Choose a note to edit or press Shift+Enter to create new',
        );
        dialog.open();
    }

    function onKeyDown(e: KeyboardEvent) {
        // Close on Escape only. Enter is left alone so the sub-dialogs and
        // inputs (note chooser, tag autocomplete) can use it.
        if (e.key === 'Escape') {
            e.preventDefault();
            close();
        }
    }
</script>

{#if !editModeTools}
    <div class="mv-kbd-title">Edit</div>
    <div class="mv-edit-unavailable">
        Editing controls unavailable. Press Escape to close.
    </div>
{:else}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="mv-edit-modal" onkeydown={onKeyDown}>
        <div class="mv-kbd-title">Edit</div>

        <div class="graph-control-edit-section">
            <div class="graph-control-edit-button">
                <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
                <div
                    class="checkbox-container"
                    class:is-enabled={editMode}
                    onclick={() => {
                        editMode = !editMode;
                        view.highLevelSetViewState({ editMode });
                    }}
                >
                    <input
                        type="checkbox"
                        checked={editMode}
                        id="edit-modal-active"
                    />
                </div>
                <label class="edit-label" for="edit-modal-active"
                    >Edit Mode</label
                >
            </div>

            <div class="note-chooser">
                <button
                    class="button"
                    class:mod-warning={editMode && noteToEdit === null}
                    title={noteToEdit
                        ? noteToEdit.basename
                        : 'Choose the note to use for adding markers and paths'}
                    onclick={() => {
                        chooseNote();
                    }}
                >
                    {noteToEdit
                        ? "Adding to '" +
                          (noteToEdit.basename.length > 10
                              ? noteToEdit.basename.substring(0, 10) + '...'
                              : noteToEdit.basename) +
                          "'"
                        : 'Choose Note...'}
                </button>
                {#if noteToEdit !== null}
                    <span title={noteToEdit.basename} style="display: flex;">
                        {@html getIcon('check').outerHTML}
                    </span>
                {/if}
            </div>

            <select
                class="dropdown mv-map-control edit-section-dropdown"
                bind:value={noteHeading}
                title="Choose where in the selected note you wish markers and paths to be added."
                disabled={noteToEdit === null}
            >
                <option value={null}>Append to end</option>
                {#each allNoteHeadings as heading}
                    <option value={heading}>{heading}</option>
                {/each}
            </select>

            <div class="mv-edit-tags">
                {@html getIcon('tag').outerHTML}
                <ChipsList bind:chips={editTags}></ChipsList>
                <input
                    type="text"
                    bind:this={addTagInputElement}
                    class="text-input-inline mv-tag-input"
                    placeholder="#tag"
                />
            </div>
        </div>
    </div>
{/if}

<style>
    .mv-kbd-title {
        font-weight: 600;
        margin-bottom: 8px;
    }

    .mv-edit-modal {
        min-width: 300px;
        display: flex;
        flex-direction: column;
        gap: 6px;
    }
</style>
