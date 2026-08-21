// <clew-settings-view>: a settings tab — appearance, daily notes/templates,
// and the hotkey editor (records chords straight into settings overrides).
import { ClewElement } from '../base/clew-element.js';
import { settingsStore } from '../../state/settings-store.js';
import { allCommands, chordOf } from '../../commands/registry.js';
import { debounce } from '../../lib/debounce.js';

const isMac = navigator.platform.startsWith('Mac');

export function prettyChord(chord) {
	return chord
		.replace('Mod', isMac ? '⌘' : 'Ctrl')
		.replace('Alt', isMac ? '⌥' : 'Alt')
		.replace('Shift', '⇧')
		.replace('ArrowLeft', '←')
		.replace('ArrowRight', '→')
		.replace('ArrowUp', '↑')
		.replace('ArrowDown', '↓')
		.replaceAll('-', isMac ? '' : '+');
}

class ClewSettingsView extends ClewElement {
	#recordingId = null;
	#filter = '';

	subscribe() {
		this.listen(settingsStore, 'settings-changed', () => {
			// Re-render only when not mid-edit in a text field.
			if (!this.contains(document.activeElement) || this.#recordingId) return;
		});
	}

	render() {
		this.classList.add('settings-view');
		this.innerHTML = '<div class="settings-scroll"></div>';
		const scroll = this.firstElementChild;
		scroll.append(
			this.#section('Appearance', [
				this.#selectRow('Theme', 'theme', [['dark', 'Dark'], ['light', 'Light']]),
				this.#numberRow('Editor font size (px)', 'editorFontSize', 16, 10, 28),
				this.#numberRow('Editor line width (em)', 'editorLineWidth', 44, 20, 120),
			]),
			this.#section('Daily notes', [
				this.#textRow('Folder', 'dailyNoteFolder', 'Daily'),
				this.#textRow('Filename format', 'dailyNoteFormat', 'YYYY-MM-DD'),
				this.#textRow('Template note (optional)', 'dailyNoteTemplate', ''),
			]),
			this.#section('Files', [
				this.#textRow('Attachment folder', 'attachmentFolder', 'Attachments'),
				this.#textRow('Templates folder', 'templatesFolder', 'Templates'),
			]),
			this.#hotkeysSection(),
		);
	}

	#section(title, rows) {
		const section = document.createElement('section');
		section.className = 'settings-section';
		const heading = document.createElement('h2');
		heading.textContent = title;
		section.append(heading, ...rows);
		return section;
	}

	#row(label, control) {
		const row = document.createElement('div');
		row.className = 'settings-row';
		const labelEl = document.createElement('label');
		labelEl.textContent = label;
		row.append(labelEl, control);
		return row;
	}

	#textRow(label, key, placeholder) {
		const input = document.createElement('input');
		input.type = 'text';
		input.placeholder = placeholder;
		input.value = settingsStore.get(key) ?? '';
		const save = debounce(() => settingsStore.set(key, input.value.trim()), 400);
		input.addEventListener('input', save);
		input.addEventListener('blur', () => save.flush());
		input.addEventListener('keydown', (e) => e.stopPropagation());
		return this.#row(label, input);
	}

	#numberRow(label, key, fallback, min, max) {
		const input = document.createElement('input');
		input.type = 'number';
		input.min = min;
		input.max = max;
		input.value = settingsStore.get(key) ?? fallback;
		input.addEventListener('change', () => {
			const value = Math.max(min, Math.min(max, Number(input.value) || fallback));
			input.value = value;
			settingsStore.set(key, value);
		});
		input.addEventListener('keydown', (e) => e.stopPropagation());
		return this.#row(label, input);
	}

	#selectRow(label, key, options) {
		const select = document.createElement('select');
		for (const [value, text] of options) {
			const option = document.createElement('option');
			option.value = value;
			option.textContent = text;
			select.append(option);
		}
		select.value = settingsStore.get(key) ?? options[0][0];
		select.addEventListener('change', () => settingsStore.set(key, select.value));
		return this.#row(label, select);
	}

	// ---- hotkeys ----------------------------------------------------------

	#hotkeysSection() {
		const section = document.createElement('section');
		section.className = 'settings-section';
		const heading = document.createElement('h2');
		heading.textContent = 'Hotkeys';
		const filter = document.createElement('input');
		filter.type = 'text';
		filter.className = 'hotkey-filter';
		filter.placeholder = 'Filter commands…';
		filter.value = this.#filter;
		filter.addEventListener('keydown', (e) => e.stopPropagation());
		const list = document.createElement('div');
		list.className = 'hotkey-list';
		filter.addEventListener('input', () => {
			this.#filter = filter.value;
			this.#renderHotkeyList(list);
		});
		section.append(heading, filter, list);
		this.#renderHotkeyList(list);
		return section;
	}

	#chordsFor(command, overrides) {
		return overrides[command.id] ?? command.hotkeys ?? [];
	}

	#renderHotkeyList(list) {
		const overrides = settingsStore.get('hotkeys') ?? {};
		const commands = allCommands()
			.filter((c) => !this.#filter || c.name.toLowerCase().includes(this.#filter.toLowerCase()))
			.sort((a, b) => a.name.localeCompare(b.name));

		// Conflicts: any chord claimed by more than one command's EFFECTIVE set.
		const claims = new Map();
		for (const command of allCommands()) {
			for (const chord of this.#chordsFor(command, overrides)) {
				claims.set(chord, (claims.get(chord) ?? 0) + 1);
			}
		}

		list.replaceChildren(...commands.map((command) => {
			const row = document.createElement('div');
			row.className = 'hotkey-row';

			const name = document.createElement('span');
			name.className = 'hotkey-name';
			name.textContent = command.name;

			const chords = document.createElement('span');
			chords.className = 'hotkey-chords';
			const effective = this.#chordsFor(command, overrides);
			if (this.#recordingId === command.id) {
				chords.textContent = 'Press a shortcut… (esc cancels)';
				chords.classList.add('is-recording');
			} else if (effective.length === 0) {
				chords.textContent = '—';
			} else {
				chords.replaceChildren(...effective.map((chord) => {
					const kbd = document.createElement('kbd');
					kbd.textContent = prettyChord(chord);
					if ((claims.get(chord) ?? 0) > 1) kbd.classList.add('is-conflict');
					return kbd;
				}));
			}
			if (command.id in overrides) chords.classList.add('is-custom');

			const setButton = document.createElement('button');
			setButton.className = 'hotkey-button';
			setButton.textContent = this.#recordingId === command.id ? 'Cancel' : 'Set';
			setButton.addEventListener('click', () => {
				if (this.#recordingId === command.id) this.#stopRecording(list);
				else this.#startRecording(command.id, list);
			});

			const resetButton = document.createElement('button');
			resetButton.className = 'hotkey-button';
			resetButton.textContent = 'Reset';
			resetButton.disabled = !(command.id in overrides);
			resetButton.addEventListener('click', () => {
				const next = { ...settingsStore.get('hotkeys') };
				delete next[command.id];
				settingsStore.set('hotkeys', next);
				this.#renderHotkeyList(list);
			});

			row.append(name, chords, setButton, resetButton);
			return row;
		}));
	}

	#recorderCleanup = null;

	#startRecording(commandId, list) {
		this.#stopRecording(list);
		this.#recordingId = commandId;
		const onKey = (event) => {
			event.preventDefault();
			event.stopPropagation();
			if (event.key === 'Escape') {
				this.#stopRecording(list);
				return;
			}
			const chord = chordOf(event);
			if (!chord || !chord.includes('-')) return; // wait for a full chord
			settingsStore.set('hotkeys', {
				...(settingsStore.get('hotkeys') ?? {}),
				[commandId]: [chord],
			});
			this.#stopRecording(list);
		};
		window.addEventListener('keydown', onKey, { capture: true });
		this.#recorderCleanup = () => window.removeEventListener('keydown', onKey, { capture: true });
		this.#renderHotkeyList(list);
	}

	#stopRecording(list) {
		this.#recorderCleanup?.();
		this.#recorderCleanup = null;
		this.#recordingId = null;
		this.#renderHotkeyList(list);
	}

	cleanup() {
		this.#recorderCleanup?.();
	}
}

customElements.define('clew-settings-view', ClewSettingsView);
