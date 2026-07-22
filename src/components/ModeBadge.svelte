<script lang="ts">
    let { mode = 'normal' } = $props<{
        mode: 'normal' | 'edit' | 'insert';
    }>();

    // Normalize to a known mode so styling/label never break on an
    // unexpected value; fall back to 'normal'.
    const safeMode = $derived(
        mode === 'edit' || mode === 'insert' ? mode : 'normal',
    );
    const label = $derived(safeMode.toUpperCase());
</script>

<span
    class="mv-mode-badge"
    class:mv-mode-normal={safeMode === 'normal'}
    class:mv-mode-edit={safeMode === 'edit'}
    class:mv-mode-insert={safeMode === 'insert'}
    data-mode={safeMode}
>
    {label}
</span>

<style>
    .mv-mode-badge {
        display: inline-block;
        padding: 1px 7px;
        border-radius: 4px;
        font-size: 0.7em;
        font-weight: 700;
        letter-spacing: 0.08em;
        line-height: 1.5;
        text-transform: uppercase;
        color: #fff;
        background-color: var(--mv-mode-badge-bg, #4a5568);
        border: 1px solid var(--mv-mode-badge-border, rgba(0, 0, 0, 0.2));
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
        user-select: none;
        pointer-events: none;
        white-space: nowrap;
    }

    /* vim-modeline style color coding */
    .mv-mode-normal {
        --mv-mode-badge-bg: #2f6fed; /* blue / neutral */
        --mv-mode-badge-border: #1d4ed8;
    }

    .mv-mode-edit {
        --mv-mode-badge-bg: #2f9e57; /* green */
        --mv-mode-badge-border: #1f7a41;
    }

    .mv-mode-insert {
        --mv-mode-badge-bg: #e07b1a; /* orange */
        --mv-mode-badge-border: #b45f0f;
    }
</style>
