<script lang="ts">
    import { onMount, tick } from 'svelte';

    // A reusable keyboard-navigable, fuzzy-filtered list for the map's modal
    // keyboard commands (Layers, Presets, ...). It renders a filter input over a
    // numbered list of rows. Digits 1-9 are *shortcuts* to the Nth visible row
    // (they never enter the filter text); arrows move the highlight; Enter
    // chooses the highlighted row; Escape closes. When `stayOpen` is false the
    // list closes after a choice (selection); when true it stays open (toggling).

    export type NavItem = {
        /** Stable identity (used for the {#each} key). */
        id: string;
        /** Primary text, also what the fuzzy filter matches against. */
        label: string;
        /** Optional secondary text shown right-aligned. */
        sublabel?: string;
        /** When `showActiveState`, renders an on/off indicator from this. */
        active?: boolean;
    };

    let {
        items,
        placeholder = 'Type to filter…',
        stayOpen = false,
        showActiveState = false,
        emptyText = 'No matches',
        onSelect,
        close,
    } = $props<{
        items: NavItem[];
        placeholder?: string;
        stayOpen?: boolean;
        showActiveState?: boolean;
        emptyText?: string;
        onSelect: (item: NavItem, index: number) => void;
        close: () => void;
    }>();

    let query = $state('');
    let highlight = $state(0);
    let inputEl: HTMLInputElement = $state();

    // Case-insensitive subsequence ("fuzzy") match — the same lightweight
    // approach used by the codebase's other suggesters.
    function fuzzyMatch(needle: string, haystack: string): boolean {
        if (needle.length === 0) return true;
        let i = 0;
        for (const ch of haystack) {
            if (ch === needle[i]) i++;
            if (i === needle.length) return true;
        }
        return false;
    }

    const filtered = $derived(
        query.trim().length === 0
            ? items
            : items.filter((it) =>
                  fuzzyMatch(
                      query.trim().toLowerCase(),
                      it.label.toLowerCase(),
                  ),
              ),
    );

    // Keep the highlight index in range as the filtered list shrinks/grows.
    $effect(() => {
        if (highlight > filtered.length - 1)
            highlight = Math.max(0, filtered.length - 1);
    });

    onMount(async () => {
        await tick();
        inputEl?.focus();
    });

    function choose(index: number) {
        const item = filtered[index];
        if (!item) return;
        onSelect(item, index);
        if (!stayOpen) close();
    }

    function onKeydown(e: KeyboardEvent) {
        if (e.key === 'Escape') {
            e.preventDefault();
            close();
            return;
        }
        if (e.key === 'Enter') {
            e.preventDefault();
            choose(highlight);
            return;
        }
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            highlight = Math.min(highlight + 1, filtered.length - 1);
            return;
        }
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            highlight = Math.max(highlight - 1, 0);
            return;
        }
        // Digit shortcuts: 1-9 choose the Nth *visible* row. Digits are always
        // shortcuts, never filter text (this is the requested behavior).
        if (/^[1-9]$/.test(e.key)) {
            e.preventDefault();
            const idx = parseInt(e.key, 10) - 1;
            if (idx < filtered.length) {
                highlight = idx;
                choose(idx);
            }
            return;
        }
    }
</script>

<div class="mv-kbd-list">
    <input
        class="mv-kbd-filter"
        type="text"
        bind:this={inputEl}
        bind:value={query}
        {placeholder}
        onkeydown={onKeydown}
        spellcheck="false"
        autocomplete="off"
    />
    <div class="mv-kbd-rows">
        {#if filtered.length === 0}
            <div class="mv-kbd-empty">{emptyText}</div>
        {/if}
        {#each filtered as item, i (item.id)}
            <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
            <div
                class="mv-kbd-row"
                class:is-highlight={i === highlight}
                class:is-active={showActiveState && item.active}
                onclick={() => choose(i)}
                onmousemove={() => (highlight = i)}
            >
                <span class="mv-kbd-row-num">{i < 9 ? i + 1 : ''}</span>
                {#if showActiveState}
                    <span class="mv-kbd-row-check"
                        >{item.active ? '✓' : ''}</span
                    >
                {/if}
                <span class="mv-kbd-row-label">{item.label}</span>
                {#if item.sublabel}
                    <span class="mv-kbd-row-sub">{item.sublabel}</span>
                {/if}
            </div>
        {/each}
    </div>
</div>

<style>
    .mv-kbd-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
        min-width: 280px;
    }

    .mv-kbd-filter {
        width: 100%;
        box-sizing: border-box;
    }

    .mv-kbd-rows {
        display: flex;
        flex-direction: column;
        max-height: 50vh;
        overflow-y: auto;
    }

    .mv-kbd-empty {
        color: var(--text-muted);
        padding: 8px 6px;
        font-size: var(--font-ui-small);
    }

    .mv-kbd-row {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 5px 8px;
        border-radius: 6px;
        cursor: pointer;
        user-select: none;
    }

    .mv-kbd-row.is-highlight {
        background-color: var(--background-modifier-hover);
    }

    .mv-kbd-row.is-active .mv-kbd-row-label {
        font-weight: 600;
        color: var(--text-normal);
    }

    .mv-kbd-row-num {
        flex: 0 0 auto;
        width: 1.4em;
        text-align: center;
        font-size: var(--font-ui-smaller);
        color: var(--text-faint);
        border: 1px solid var(--background-modifier-border);
        border-radius: 4px;
        line-height: 1.4;
    }

    .mv-kbd-row-check {
        flex: 0 0 auto;
        width: 1em;
        text-align: center;
        color: var(--interactive-accent);
    }

    .mv-kbd-row-label {
        flex: 1 1 auto;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .mv-kbd-row-sub {
        flex: 0 0 auto;
        color: var(--text-muted);
        font-size: var(--font-ui-smaller);
    }
</style>
