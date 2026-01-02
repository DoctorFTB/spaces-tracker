import $ from '../jquery';
import interact from 'interactjs';
import module from "module";
import require from "require";
import { parseDataset, waitTransitionEnd } from "../utils/dom";

const NS = '.dialogs';
const dialogInstances = new Map();
let dialogOpenInstances = [];

const tpl = {
	header({ title, isCollapsed }) {
		return `
			<div class="dialog__header-button js-dialog_close">
				<svg viewBox="0 0 1024 1026.5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor">
					<path d="M738 226q12-13 30-13t30 13q13 12 13 30t-13 30L572 512l226 226q13 12 13 30t-13 30q-12 13-30 13t-30-13L512 572 286 798q-12 13-30 13t-30-13q-13-12-13-30t13-30l226-226-226-226q-13-12-13-30t13-30q12-13 30-13t30 13l226 226 226-226z"/>
				</svg>
			</div>

			<div class="dialog__header-title js-dialog_header_title">
				${title}
			</div>

			<div class="dialog__header-button js-dialog_expand_collapse">
				${isCollapsed ? tpl.iconExpand() : tpl.iconCollapse()}
			</div>
		`;
	},
	iconExpand() {
		return `
			<svg viewBox="0 0 1024 1026.5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor">
				<path d="M256 213q-18 0-30.5 12.5T213 256v299q0 17 12.5 29.5T256 597t30.5-12.5T299 555V299h256q17 0 29.5-12.5T597 256t-12.5-30.5T555 213H256zm512 598q18 0 30.5-12.5T811 768V469q0-17-12.5-29.5T768 427t-30.5 12.5T725 469v256H469q-17 0-29.5 12.5T427 768t12.5 30.5T469 811h299z"/>
			</svg>
		`;
	},
	iconCollapse() {
		return `
			<svg viewBox="0 0 1024 1026.5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor">
				<path d="M448 491q18 0 30.5-12.5T491 448V149q0-17-12.5-29.5T448 107t-30.5 12.5T405 149v256H149q-17 0-29.5 12.5T107 448t12.5 30.5T149 491h299zm128 42q-18 0-30.5 12.5T533 576v299q0 17 12.5 29.5T576 917t30.5-12.5T619 875V619h256q17 0 29.5-12.5T917 576t-12.5-30.5T875 533H576z"/>
			</svg>
		`;
	}
};

export class Dialog {
	dialogElement;
	referenceElement;
	defaultOptions = {};
	openerOptions = {};
	options;
	interactInstance;
	x;
	y;
	w;
	h;

	constructor(dialogElement, options = {}) {
		this.dialogElement = dialogElement;
		this.setOptions({
			minWidth: 320,
			width: 360,
			height: 640,
			title: "",
			...parseDialogOptions(this.element()),
			...options,
		});
		dialogInstances.set(dialogElement, this);
		document.body.appendChild(this.dialogElement);

		for (const direction of ['top', 'left', 'bottom', 'right']) {
			const resizeElement = document.createElement('div');
			resizeElement.className = `js-dialog_resizer dialog__resize-border dialog__resize-border--dir-${direction}`;
			this.dialogElement.appendChild(resizeElement);
		}
	}

	isOpen() {
		return this.dialogElement.dataset.dialogOpen === "true";
	}

	isCollapsed() {
		return this.dialogElement.dataset.dialogCollapsed === "true";
	}

	isMoved() {
		return this.dialogElement.dataset.dialogIsMoved === "true";
	}

	isResized() {
		return this.dialogElement.dataset.dialogIsResized === "true";
	}

	element() {
		return this.dialogElement;
	}

	opener() {
		return this.referenceElement;
	}

	setOptions(options) {
		this.defaultOptions = {
			...this.defaultOptions,
			...options,
		};
		this.options = { ...this.defaultOptions, ...this.openerOptions };
	}

	async open(openerOptions = {}, referenceElement = undefined) {
		if (!referenceElement)
			referenceElement = document.querySelector(`[data-dialog-id="${this.element().id}"]`);
		if (!referenceElement)
			throw new Error(`No referenceElement!`);

		if (this.isOpen())
			await this.close();

		if (!this._triggerEvent("beforeOpen"))
			return;

		this.openerOptions = {
			...parseDialogOptions(referenceElement),
			...openerOptions
		};
		this.options = { ...this.defaultOptions, ...this.openerOptions };

		this.referenceElement = referenceElement;

		this.w = this.options.width;
		this.h = this.options.height;
		this.updateMode();
		this.calcWindowSizeAndLocation();

		this.dialogElement.dataset.dialogOpen = "false";
		this.dialogElement.dataset.dialogCollapsed = "false";
		this.dialogElement.dataset.dialogIsMoved = "false";
		this.dialogElement.dataset.dialogIsResized = "false";
		this.dialogElement.getBoundingClientRect();
		this.dialogElement.classList.add('dialog--transition-out');
		this.dialogElement.dataset.dialogOpen = "true";

		if (this.options.clickedClass)
			this.referenceElement.classList.add(this.options.clickedClass);

		this.update();

		this._triggerEvent("afterOpen");
		dialogOpenInstances.push(this);

		await waitTransitionEnd(this.dialogElement);
		this.dialogElement.classList.remove('dialog--transition-out');
		this.handleResize();
	}

	async toggle(openerOptions = {}, referenceElement = undefined) {
		if (this.isOpen()) {
			await this.close();
		} else {
			await this.open(openerOptions, referenceElement);
		}
	}

	async close() {
		if (!this.isOpen())
			return;

		if (!this._triggerEvent("beforeClose"))
			return;

		if (dialogInstances.has(this)) {
			this.dialogElement.classList.add('dialog--transition-in');
			this.dialogElement.dataset.dialogOpen = "false";
			await waitTransitionEnd(this.dialogElement);
			this.dialogElement.classList.remove('dialog--transition-in');
		} else {
			this.dialogElement.dataset.dialogOpen = "false";
		}

		if (this.options.clickedClass)
			this.referenceElement.classList.remove(this.options.clickedClass);
		this.referenceElement = undefined;
		this._triggerEvent("afterClose");
		dialogOpenInstances = dialogOpenInstances.filter((instance) => instance !== this);
	}

	async collapse() {
		if (this.isCollapsed())
			return;

		this.dialogElement.classList.add('dialog--transition-in');
		this.dialogElement.dataset.dialogCollapsed = "true";
		this.stopWindowMode();
		await waitTransitionEnd(this.dialogElement);
		this.dialogElement.classList.remove('dialog--transition-in');
		this.update();
		this.handleResize();
	}

	async expand() {
		if (!this.isCollapsed())
			return;

		this.dialogElement.classList.add('dialog--transition-out');
		this.dialogElement.dataset.dialogCollapsed = "false";
		this.calcWindowSizeAndLocation();
		await waitTransitionEnd(this.dialogElement);
		this.dialogElement.classList.remove('dialog--transition-out');
		this.update();
		this.handleResize();
	}

	update() {
		const dialogHeader = this.dialogElement.querySelector('.js-dialog_header');
		dialogHeader.innerHTML = tpl.header({
			title: this.options.title,
			isCollapsed: this.isCollapsed(),
		});
	}

	startWindowMode() {
		if (this.interactInstance)
			return;

		this.calcWindowSizeAndLocation();

		let dragStarted = false;
		this.interactInstance = interact(this.dialogElement);

		this.interactInstance.draggable({
			inertia: false,
			allowFrom: '.js-dialog_header_title',
			cursorChecker: (action) => {
				return action.axis == 'xy' && dragStarted ? 'grabbing' : 'default';
			},
			modifiers: [
				interact.modifiers.restrictRect({
					restriction: 'parent'
				}),
			],
			listeners: {
				start: () => {
					this.dialogElement.classList.add('dialog--is-interacting');
					document.body.style.userSelect = 'none';
					this.dialogElement.dataset.dialogIsMoved = "true";
					dragStarted = true;
				},
				end: () => {
					document.body.style.userSelect = '';
					dragStarted = false;
					this.dialogElement.classList.remove('dialog--is-interacting');
				},
				move: (event) => {
					this.x += event.dx;
					this.y += event.dy;
					this.updatePosition();
				},
			}
		});

		this.interactInstance.resizable({
			inertia: false,
			edges: { top: true, left: true, bottom: true, right: true },
			margin: 8,
			modifiers: [
				interact.modifiers.aspectRatio({
					ratio: 'preserve',
					modifiers: [
						interact.modifiers.restrictEdges({
							inner: (_x, _y, self) => {
								const rect = self.element.getBoundingClientRect();
								return {
									left: rect.right - this.options.minWidth,
									right: rect.left + this.options.minWidth,
								};
							},
							outer: () => {
								return {
									left: 0,
									right: window.innerWidth,
									top: 0,
									bottom: window.innerHeight,
								};
							}
						}),
					]
				}),
			],
			listeners: {
				start: () => {
					this.dialogElement.classList.add('dialog--is-interacting');
					document.body.style.userSelect = 'none';
					this.dialogElement.dataset.dialogIsResized = "true";
				},
				end: () => {
					document.body.style.userSelect = '';
					this.dialogElement.style.pointerEvents = '';
					this.dialogElement.classList.remove('dialog--is-interacting');
				},
				move: (event) => {
					this.x += event.deltaRect.left;
					this.y += event.deltaRect.top;
					this.w = event.rect.width;
					this.h = event.rect.height;
					this.updatePosition();
				}
			}
		});
	}

	stopWindowMode() {
		if (!this.interactInstance)
			return;
		this.interactInstance.unset();
		this.interactInstance = undefined;
	}

	calcWindowSizeAndLocation() {
		if (this.isResized()) {
			[this.w, this.h] = resize(this.w, this.h, window.innerWidth, window.innerHeight);
		} else {
			[this.w, this.h] = resize(this.options.width, this.options.height, window.innerWidth, window.innerHeight);
		}

		if (this.isMoved()) {
			if (this.x + this.w > window.innerWidth)
				this.x = window.innerWidth - this.w;
			if (this.y + this.h > window.innerHeight)
				this.y = window.innerHeight - this.h;
		} else {
			this.x = (window.innerWidth - this.w) / 2;
			this.y = (window.innerHeight - this.h) / 2;
		}

		this.updatePosition();
	}

	updatePosition() {
		this.dialogElement.style.setProperty('--w', Math.round(this.w) + 'px');
		this.dialogElement.style.setProperty('--h', Math.round(this.h) + 'px');
		this.dialogElement.style.setProperty('--x', Math.round(this.x) + 'px');
		this.dialogElement.style.setProperty('--y', Math.round(this.y) + 'px');
	}

	updateMode() {
		this.dialogElement.classList.toggle('dialog--mode-window', isWideScreen());
		this.dialogElement.classList.toggle('dialog--mode-fullscreen', !isWideScreen());
	}

	async handleResize() {
		this.updateMode();
		if (isWideScreen() && !this.isCollapsed()) {
			this.startWindowMode();
		} else {
			this.stopWindowMode();
		}
		this.calcWindowSizeAndLocation();
	}

	_triggerEvent(eventName) {
		const event = new CustomEvent(`dialog:${eventName}`, { detail: { dialog: this }, bubbles: true });
		this.dialogElement.dispatchEvent(event);
		return !event.defaultPrevented;
	}

	destroy() {
		dialogInstances.delete(this.dialogElement);
		this.close();
		$(this.dialogElement).remove();
	}
}

function handleResize() {
	for (const dialogInstance of dialogOpenInstances)
		dialogInstance.handleResize();
}

export function getDialogByOpener(opener) {
	for (const dialogInstance of dialogOpenInstances) {
		if (dialogInstance.opener() == opener)
			return dialogInstance;
	}
	return undefined;
}

export function getDialogById(id) {
	const dialogElement = document.querySelector(`#${id}`);
	if (!dialogElement)
		throw new Error(`Dialog not found: ${id}`);
	let dialogInstance = dialogInstances.get(dialogElement);
	if (!dialogInstance) {
		dialogInstance = new Dialog(dialogElement, {});
		require.component("widgets/dialog");
	}
	return dialogInstance;
}

export function getNearestDialog(element) {
	let cursor = element;
	while (cursor) {
		if (cursor.id) {
			for (const [_, dialogInstance] of dialogInstances) {
				if (dialogInstance.element() === cursor)
					return dialogInstance;
			}
		}
		cursor = cursor.parentNode;
	}
	return undefined;
}

function parseDialogOptions(element) {
	return parseDataset(element, {
		minWidth: "number",
		minHeight: "number",
		width: "number",
		height: "number",
		clickedClass: "string",
		title: "string",
	}, 'dialog');
}

module.on("componentpage", () => {
	if (dialogOpenInstances.length > 0)
		return;

	window.addEventListener('resize', handleResize);

	$('body')
		.on('click' + NS, '.js-dialog_open, .js-action_link[data-action="dialog_open"]', function (e) {
			e.preventDefault();

			const dialogByOpener = getDialogByOpener(this);
			const dialogById = getDialogById(this.dataset.dialogId);

			if (dialogByOpener && dialogByOpener != dialogById) {
				dialogByOpener.close();
				return;
			}

			if (dialogByOpener) {
				if (dialogByOpener.isCollapsed()) {
					dialogByOpener.expand();
				} else {
					dialogByOpener.collapse();
				}
				return;
			}

			dialogById.toggle();
		})
		.on('click' + NS, '.js-dialog_close', function (e) {
			e.preventDefault();
			const dialog = this.dataset.dialogId ? getDialogById(this.dataset.dialogId) : getNearestDialog(this);
			dialog?.close();
		})
		.on('click' + NS, '.js-dialog_expand_collapse', function (e) {
			e.preventDefault();
			const dialog = this.dataset.dialogId ? getDialogById(this.dataset.dialogId) : getNearestDialog(this);
			if (dialog) {
				if (dialog.isCollapsed()) {
					dialog.expand();
				} else {
					dialog.collapse();
				}
			}
		})
		.on('click' + NS, '.js-dialog_header_title', function (e) {
			e.preventDefault();
			const dialog = this.dataset.dialogId ? getDialogById(this.dataset.dialogId) : getNearestDialog(this);
			if (dialog) {
				if (dialog.isCollapsed())
					dialog.expand();
			}
		});

	console.log('dialogs inited');
});

module.on("componentpagedone", () => {
	if (dialogOpenInstances.length > 0) {
		setTimeout(() => require.component("widgets/dialog"), 1); // КОСТЫЛЬ
		return;
	}

	window.removeEventListener('resize', handleResize);

	for (const [_, dialogInstance] of dialogInstances)
		dialogInstance.destroy();

	$('body').off(NS);
});

function isWideScreen() {
	return window.innerWidth >= 600 && window.innerHeight >= 500;
}

function resize(w, h, limitW, limitH) {
	const aspectRatio = w / h;
	if (h > limitH) {
		w = limitH * aspectRatio;
		h = limitH;
	}
	if (w > limitW) {
		w = limitW;
		h = limitW / aspectRatio;
	}
	return [Math.round(w), Math.round(h)];
}
