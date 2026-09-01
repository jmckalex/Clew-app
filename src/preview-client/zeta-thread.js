// Clew — an Obsidian-style note app built on the jmarkdown engine.
// Copyright © 2026 J. McKenzie Alexander <jmckalex@gmail.com> · https://jmckalex.org
//
// This file is part of Clew, free software released under the GNU General
// Public License, version 3 or later. Clew is distributed in the hope that it
// will be useful, but WITHOUT ANY WARRANTY. See LICENSE at the repository
// root, or <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

// The ZetaOffice office-thread script (spike rig): runs inside the LOWA
// worker (listed in Module.uno_scripts after zeta.js), where the zetajs
// UNO bridge lives. Loads and stores documents on orders from zeta-page.js
// over zetajs.mainPort. NOT a module — the worker loads it verbatim.
//
// Debugging note: in devtools this is the "em-pthread" worker with the
// most memory, the one where `zetajs` is defined.

'use strict';

let zetajs, css, context, desktop, xModel;

function tell(msg) { zetajs.mainPort.postMessage(msg); }

function tryUno(what, fn) {
	try {
		fn();
	} catch (e) {
		let detail;
		try { detail = zetajs.fromAny(zetajs.catchUnoException(e)).Message; }
		catch { detail = String(e); }
		tell({ cmd: 'error', message: `${what}: ${detail}` });
	}
}

// LibreOffice's own Save on a .docx/.xlsx/.pptx pops a "keep current
// format?" dialog by default. The format is not in question — the file
// keeps its own — so turn the warning off before any document loads.
function disableAlienFormatWarning() {
	tryUno('config', () => {
		const config = css.configuration.ReadWriteAccess.create(context, 'en-US');
		const save = config.getByHierarchicalName('/org.openoffice.Office.Common/Save/Document');
		save.setPropertyValue('WarnAlienFormat', false);
		config.commitChanges();
	});
}

function loadFile(fileUrl) {
	tryUno('load', () => {
		xModel = desktop.loadComponentFromURL(fileUrl, '_default', 0, []);
		const ctrl = xModel.getCurrentController();
		ctrl.getFrame().getContainerWindow().FullScreen = true;
		// Dirty-state tracking: every store (ours, the toolbar's, Ctrl+S)
		// resets the modified flag, so the page can treat modified→false as
		// "the Emscripten FS now matches the model — push it to the vault".
		const listener = zetajs.unoObject([css.util.XModifyListener], {
			modified: () => tell({ cmd: 'modified', state: xModel.isModified() }),
			disposing: () => {},
		});
		xModel.addModifyListener(listener);
		tell({ cmd: 'ui_ready' });
	});
}

// Explicit save from the host page: same location, same format, no UI.
function storeInPlace() {
	tryUno('save', () => {
		if (xModel.isModified()) xModel.store();
		else tell({ cmd: 'modified', state: false });
	});
}

// Smoke-harness hook: a real edit through UNO, so the save pipeline can be
// verified end-to-end without keyboard synthesis. Writer gets a marker
// string; other document types just get their modified flag raised.
function testEdit() {
	tryUno('testedit', () => {
		const xTextDoc = xModel.queryInterface(zetajs.type.interface(css.text.XTextDocument));
		if (xTextDoc) {
			const text = xTextDoc.getText();
			text.insertString(text.createTextCursor(), 'ZETA-SPIKE-EDIT ', false);
		} else {
			xModel.setModified(true);
		}
		tell({ cmd: 'edited' });
	});
}

function saveFile(fileUrl, filterName) {
	tryUno('save', () => {
		const props = [new css.beans.PropertyValue({ Name: 'Overwrite', Value: true })];
		if (filterName) {
			props.push(new css.beans.PropertyValue({ Name: 'FilterName', Value: filterName }));
		}
		xModel.storeToURL(fileUrl, props);
		tell({ cmd: 'saved' });
	});
}

Module.zetajs.then((pZetajs) => {
	zetajs = pZetajs;
	css = zetajs.uno.com.sun.star;
	context = zetajs.getUnoComponentContext();
	desktop = css.frame.Desktop.create(context);

	zetajs.mainPort.onmessage = (e) => {
		switch (e.data.cmd) {
		case 'load': loadFile(e.data.fileUrl); break;
		case 'save': storeInPlace(); break;
		case 'testedit': testEdit(); break;
		case 'savetest': saveFile(e.data.fileUrl, e.data.filterName); break;
		default: tell({ cmd: 'error', message: 'unknown command ' + e.data.cmd });
		}
	};
	disableAlienFormatWarning();
	tell({ cmd: 'thr_running' });
});
