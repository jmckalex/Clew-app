// Clew — an Obsidian-style note app built on the jmarkdown engine.
// Copyright © 2026 J. McKenzie Alexander <jmckalex@gmail.com> · https://jmckalex.org
//
// This file is part of Clew, free software released under the GNU General
// Public License, version 3 or later. Clew is distributed in the hope that it
// will be useful, but WITHOUT ANY WARRANTY. See LICENSE at the repository
// root, or <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

// Clew's style for a LaTeX export and a PDF via LaTeX (the owner's choice,
// 2026-10-19: "a properly-formatted LaTeX document using a font like
// Garamond") — EB Garamond with Garamond-Math, 12pt on A4 (Letter where the
// machine's region uses it), microtype, the language's hyphenation, smart
// quotes, quieter lists and headings, smaller long quotations, a colour emoji
// fallback, links unboxed. Setting `latexExportStyle` (Settings → Export):
// `clew`, the default, or `none` — the user's jmarkdown configuration alone,
// as every export was before.
//
// Applied as CONFIGURATION, the engine's own keys, set by the export worker
// after the engine has read the user's config files and before the build:
//   - a layout key (`Class options`, `Geometry`, `LaTeX engine`) only where
//     the user's config leaves it as the engine's default (`LaTeX engine`'s
//     is pdflatex, which the style cannot live with: fontspec);
//   - `Packages` and `LaTeX preamble` ADDED to the user's — the packages load
//     before hyperref, the preamble lines after the user's own, so the
//     style's fonts win over a config's `\setmainfont` (the owner's: Garamond
//     over his global Optima);
//   - a note's own HEADER wins over all of it, as over any config: the engine
//     reads a header key before the config's, so a note whose header sets
//     `LaTeX preamble` or `Packages` replaces the style's along with the
//     user's, and every style command is guarded so that leaves a document
//     that compiles.
// The fonts are named by FILE, which LuaLaTeX and XeLaTeX both find in
// TeX Live, and guarded by \IfFontExistsTF: a TeX installation without them
// keeps its default face rather than failing. Imports nothing; tested by
// tests/latex-style.test.js.

/** The values `latexExportStyle` takes, its default first. */
export const LATEX_EXPORT_STYLES = ['clew', 'none'];

/** Packages the style loads (by name, so before hyperref), in order. */
const PACKAGES = ['unicode-math', 'microtype', 'enumitem', 'titlesec', 'titling', 'etoolbox'];

/** Regions whose paper is Letter, not A4. */
const LETTER_REGIONS = new Set(['US', 'CA', 'MX', 'PH', 'CL', 'CO', 'VE', 'GT', 'PR']);

/** A colour emoji face each platform ships, for the main font's fallback. */
const EMOJI = { darwin: 'AppleColorEmoji', win32: 'SegoeUIEmoji', linux: 'NotoColorEmoji' };

const asList = (v) => (v == null || v === '' ? [] : Array.isArray(v) ? v : [v]);
const regionOf = (locale) => /[-_]([A-Za-z]{2})\b/.exec(String(locale ?? ''))?.[1]?.toUpperCase() ?? '';

/**
 * The configuration keys the style sets, as [key, value] pairs.
 *
 * @param {(key: string) => unknown} get - the engine's configuration as the
 *   user's config files left it (configManager.get)
 * @param {{ locale?: string, platform?: string, defaults?: object }} [where] -
 *   the machine's locale (`en-GB`) and platform, for the paper, the
 *   hyphenation and the emoji face; and the engine's DEFAULT_CONFIG, so a
 *   key still at its default counts as unset
 * @returns {[string, unknown][]}
 */
export function latexStyleConfig(get, { locale = '', platform = 'darwin', defaults = {} } = {}) {
	const out = [];
	const unset = (key) => get(key) == null || get(key) === '' || get(key) === defaults[key];
	const region = regionOf(get('Lang')) || regionOf(locale);
	const letter = LETTER_REGIONS.has(region);

	if (unset('LaTeX engine')) out.push(['LaTeX engine', 'lualatex']);
	if (unset('Class options')) out.push(['Class options', `12pt,${letter ? 'letterpaper' : 'a4paper'}`]);
	if (unset('Geometry')) out.push(['Geometry', 'textwidth=31pc,top=30mm,bottom=32mm']);
	if (get('Smart typography') !== true) out.push(['Smart typography', true]);

	const userPreamble = asList(get('LaTeX preamble'));
	const userText = userPreamble.join('\n');
	// English hyphenation by the region, unless the user's config already
	// chooses a language: babel and polyglossia do not mix.
	const english = /^en\b/i.test(String(get('Lang') ?? 'en')) && !/\{(babel|polyglossia)\}/.test(userText);
	const packages = [...(english ? ['polyglossia'] : []), ...PACKAGES];
	const userPackages = asList(get('Packages'));
	out.push(['Packages', [...userPackages, ...packages.filter((p) => !userPackages.includes(p))]]);
	out.push(['LaTeX preamble', [...userPreamble, ...preamble({ english, region, platform })]]);
	return out;
}

/** The style's preamble lines: every one guarded by the package it needs. */
function preamble({ english, region, platform }) {
	const emoji = EMOJI[platform] ?? EMOJI.linux;
	const garamond = 'EBGaramond-Regular.otf';
	const faces = '[Extension=.otf,UprightFont=*-Regular,ItalicFont=*-Italic,BoldFont=*-Bold,BoldItalicFont=*-BoldItalic';
	return [
		'% Clew\'s export style (Settings → Export; `latexExportStyle: none` leaves it out).',
		...(english ? [`\\IfPackageLoadedTF{polyglossia}{\\setdefaultlanguage[variant=${region === 'US' ? 'american' : 'british'}]{english}}{}`] : []),
		// fontspec's, so only where it is loaded (a config forcing pdfLaTeX has
		// none). The emoji fallback is LuaTeX's (luaotfload), and only for a face
		// that is there: a fallback naming a missing one leaves the MAIN font
		// null, every character dropped (measured). XeTeX gets the face alone.
		'\\IfPackageLoadedTF{fontspec}{\\IfFontExistsTF{' + garamond + '}{%',
		'  \\ifdefined\\directlua',
		`    \\IfFontExistsTF{${emoji}}{%`,
		`      \\directlua{luaotfload.add_fallback("clewemoji", {"${emoji}:mode=harf;"})}%`,
		`      \\setmainfont{EBGaramond}${faces},RawFeature={fallback=clewemoji}]%`,
		`    }{\\setmainfont{EBGaramond}${faces}]}`,
		'  \\else',
		`    \\setmainfont{EBGaramond}${faces}]`,
		'  \\fi',
		'}{}}{}',
		'\\IfPackageLoadedTF{unicode-math}{\\IfFontExistsTF{Garamond-Math.otf}{\\setmathfont{Garamond-Math.otf}[StylisticSet={7,8,9}]}{}}{}',
		'\\IfPackageLoadedTF{enumitem}{\\setlist{itemsep=0.35\\baselineskip,topsep=0.5\\baselineskip}\\setlist[itemize,2]{label=–,itemsep=0.15\\baselineskip}}{}',
		'\\IfPackageLoadedTF{titlesec}{%',
		'  \\titleformat{\\section}{\\normalfont\\Large\\bfseries}{\\thesection}{0.8em}{}%',
		'  \\titleformat{\\subsection}{\\normalfont\\large\\itshape}{\\thesubsection}{0.8em}{}%',
		'  \\titlespacing*{\\section}{0pt}{3ex plus 1ex minus .2ex}{1.2ex plus .2ex}%',
		'  \\titlespacing*{\\subsection}{0pt}{2ex plus .5ex minus .2ex}{0.8ex plus .2ex}%',
		'}{}',
		'\\IfPackageLoadedTF{etoolbox}{\\AtBeginEnvironment{quote}{\\small}\\AtBeginEnvironment{quotation}{\\small}}{}',
		'\\IfPackageLoadedTF{titling}{%',
		'  \\pretitle{\\begin{center}\\LARGE}\\posttitle{\\par\\end{center}\\vskip 1.2em}%',
		'  \\preauthor{\\begin{center}\\large\\scshape}\\postauthor{\\par\\end{center}}%',
		'  \\predate{\\begin{center}\\normalsize}\\postdate{\\par\\end{center}\\vskip 1.5em}%',
		'}{}',
		'\\IfPackageLoadedTF{hyperref}{\\hypersetup{hidelinks}}{}',
	];
}
