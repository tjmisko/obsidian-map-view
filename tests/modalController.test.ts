import { describe, it, expect, vi } from 'vitest';

// The controller module statically imports the ModeBadge Svelte component (for
// the badge mount). vitest has no Svelte transform, so stub it — the pure
// helpers under test never touch it.
vi.mock('src/components/ModeBadge.svelte', () => ({ default: class {} }));

import {
    lookupBinding,
    decideEscapeAction,
    KEYMAP,
    type ModalActionContext,
} from 'src/modalController';

/** A recording {@link ModalActionContext} so we can assert what an action did. */
function makeCtx(overrides: Partial<ModalActionContext> = {}) {
    const calls = {
        zoomBy: [] as number[],
        pan: [] as Array<[number, number, boolean]>,
        fit: 0,
        toggleEdit: 0,
        focusQuery: 0,
    };
    const ctx: ModalActionContext = {
        zoomStep: 0.5,
        shift: false,
        zoomBy: (delta) => calls.zoomBy.push(delta),
        pan: (dx, dy, big) => calls.pan.push([dx, dy, big]),
        fit: () => {
            calls.fit++;
        },
        toggleEdit: () => {
            calls.toggleEdit++;
        },
        focusQuery: () => {
            calls.focusQuery++;
        },
        ...overrides,
    };
    return { ctx, calls };
}

describe('lookupBinding', () => {
    it('should zoom in when + is pressed in normal mode', () => {
        const binding = lookupBinding('normal', '+', true);
        expect(binding).toBeDefined();
        const { ctx, calls } = makeCtx();
        binding!.action(ctx);
        expect(calls.zoomBy).toEqual([0.5]);
    });

    it('should zoom in when = is pressed in normal mode', () => {
        const binding = lookupBinding('normal', '=', false);
        expect(binding).toBeDefined();
        const { ctx, calls } = makeCtx();
        binding!.action(ctx);
        expect(calls.zoomBy).toEqual([0.5]);
    });

    it('should zoom out when - is pressed in normal mode', () => {
        const binding = lookupBinding('normal', '-', false);
        expect(binding).toBeDefined();
        const { ctx, calls } = makeCtx();
        binding!.action(ctx);
        expect(calls.zoomBy).toEqual([-0.5]);
    });

    it('should pan left for h and ArrowLeft in normal mode', () => {
        for (const key of ['h', 'ArrowLeft']) {
            const binding = lookupBinding('normal', key, false);
            expect(binding, key).toBeDefined();
            const { ctx, calls } = makeCtx();
            binding!.action(ctx);
            expect(calls.pan).toEqual([[-1, 0, false]]);
        }
    });

    it('should pan down for j and ArrowDown in normal mode', () => {
        for (const key of ['j', 'ArrowDown']) {
            const binding = lookupBinding('normal', key, false);
            expect(binding, key).toBeDefined();
            const { ctx, calls } = makeCtx();
            binding!.action(ctx);
            expect(calls.pan).toEqual([[0, 1, false]]);
        }
    });

    it('should pan up for k and ArrowUp in normal mode', () => {
        for (const key of ['k', 'ArrowUp']) {
            const binding = lookupBinding('normal', key, false);
            expect(binding, key).toBeDefined();
            const { ctx, calls } = makeCtx();
            binding!.action(ctx);
            expect(calls.pan).toEqual([[0, -1, false]]);
        }
    });

    it('should pan right for l and ArrowRight in normal mode', () => {
        for (const key of ['l', 'ArrowRight']) {
            const binding = lookupBinding('normal', key, false);
            expect(binding, key).toBeDefined();
            const { ctx, calls } = makeCtx();
            binding!.action(ctx);
            expect(calls.pan).toEqual([[1, 0, false]]);
        }
    });

    it('should pass a larger step (big=true) when Shift is held', () => {
        const binding = lookupBinding('normal', 'ArrowUp', true);
        expect(binding).toBeDefined();
        const { ctx, calls } = makeCtx({ shift: true });
        binding!.action(ctx);
        expect(calls.pan).toEqual([[0, -1, true]]);
    });

    it('should map f to fit in normal mode', () => {
        const binding = lookupBinding('normal', 'f', false);
        expect(binding).toBeDefined();
        const { ctx, calls } = makeCtx();
        binding!.action(ctx);
        expect(calls.fit).toBe(1);
    });

    it('should map e to toggle edit in normal mode', () => {
        const binding = lookupBinding('normal', 'e', false);
        expect(binding).toBeDefined();
        const { ctx, calls } = makeCtx();
        binding!.action(ctx);
        expect(calls.toggleEdit).toBe(1);
    });

    it('should map / to focus query in normal mode', () => {
        const binding = lookupBinding('normal', '/', false);
        expect(binding).toBeDefined();
        const { ctx, calls } = makeCtx();
        binding!.action(ctx);
        expect(calls.focusQuery).toBe(1);
    });

    it('should return undefined for an unbound key', () => {
        expect(lookupBinding('normal', 'z', false)).toBeUndefined();
        expect(lookupBinding('normal', 'Escape', false)).toBeUndefined();
    });

    it('should return undefined for a normal-only key when in insert mode', () => {
        expect(lookupBinding('insert', 'h', false)).toBeUndefined();
        expect(lookupBinding('insert', 'f', false)).toBeUndefined();
        expect(lookupBinding('insert', '+', true)).toBeUndefined();
    });

    it('should return undefined for a normal-only key when in edit mode', () => {
        expect(lookupBinding('edit', 'k', false)).toBeUndefined();
        expect(lookupBinding('edit', '/', false)).toBeUndefined();
    });

    it('should only contain normal-mode bindings', () => {
        expect(KEYMAP.length).toBeGreaterThan(0);
        expect(KEYMAP.every((b) => b.mode === 'normal')).toBe(true);
    });
});

describe('decideEscapeAction', () => {
    it('should blur when a view input is focused', () => {
        expect(
            decideEscapeAction({
                activeElementIsEditableInView: true,
                editMode: false,
                popupOpen: false,
            }),
        ).toBe('blur');
    });

    it('should exit edit when in edit mode and no input focused', () => {
        expect(
            decideEscapeAction({
                activeElementIsEditableInView: false,
                editMode: true,
                popupOpen: false,
            }),
        ).toBe('exitEdit');
    });

    it('should close the popup when one is open and nothing higher applies', () => {
        expect(
            decideEscapeAction({
                activeElementIsEditableInView: false,
                editMode: false,
                popupOpen: true,
            }),
        ).toBe('closePopup');
    });

    it('should do nothing when already in normal mode', () => {
        expect(
            decideEscapeAction({
                activeElementIsEditableInView: false,
                editMode: false,
                popupOpen: false,
            }),
        ).toBe('none');
    });

    it('should prioritize blur over exiting edit', () => {
        expect(
            decideEscapeAction({
                activeElementIsEditableInView: true,
                editMode: true,
                popupOpen: true,
            }),
        ).toBe('blur');
    });

    it('should prioritize exiting edit over closing a popup', () => {
        expect(
            decideEscapeAction({
                activeElementIsEditableInView: false,
                editMode: true,
                popupOpen: true,
            }),
        ).toBe('exitEdit');
    });
});
