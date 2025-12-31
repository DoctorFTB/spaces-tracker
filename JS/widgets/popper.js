import $ from '../jquery';
import module from "module";
import require from "require";
import { createPopper } from '@popperjs/core/lib/popper-lite';
import popperFlip from '@popperjs/core/lib/modifiers/flip';
import popperPreventOverflow from '@popperjs/core/lib/modifiers/preventOverflow';
import popperComputeStyles from '@popperjs/core/lib/modifiers/computeStyles';
import popperOffset from '@popperjs/core/lib/modifiers/offset';
import popperEventListeners from '@popperjs/core/lib/modifiers/eventListeners';
import { parseDataset, scrollIntoViewIfNotVisible } from "../utils/dom";
import { throttleRaf } from "../utils";
import fixPageHeight from "../min_height";

const popperInstances = new Map();
let popperOpenInstances = [];
let resizeObserver;

const popperTypes = {
	toolbar: {
		placement: "bottom-start",
		autoScroll: true,
		fixed: true,
		flip: false,
	},
	dropdown: {
		placement: "bottom-start",
		clickedClass: "js-clicked",
		autoScroll: true,
		fullWidth: true,
		padding: 0,
		offsetTop: 20,
		arrow: true,
		flip: false,
		exclusive: true,
	}
};

export class Popper {
	popperElement;
	referenceElement;
	popper;
	options;
	ignoreBodyClick = false;
	clickedClass;

	constructor(popperElement, options = {}) {
		this.popperElement = popperElement;
		this.setOptions(options);
		popperInstances.set(popperElement, this);

		this.popperElement.addEventListener('click', () => this._startIgnoreBodyClick());
	}

	isOpen() {
		return !!this.popper;
	}

	element() {
		return this.popperElement;
	}

	opener() {
		return this.referenceElement;
	}

	update() {
		if (!this.isOpen())
			return;
		this.popper.update();
	}

	setOptions(options) {
		const baseOptions = options.type ? popperTypes[options.type] ?? {} : {};
		this.options = {
			clickedClass: "",
			placement: "auto",
			offsetLeft: 0,
			offsetTop: 0,
			autoScroll: false,
			fixed: false,
			padding: 5,
			fullWidth: false,
			arrow: false,
			flip: false,
			exclusive: false,
			group: undefined,
			...baseOptions,
			...options
		};
	}

	mergeOptions(referenceElement, options = {}) {
		this.setOptions({
			...parsePopperOptions(this.element()),
			...parsePopperOptions(referenceElement),
			...options
		});
	}

	openWith(referenceElement) {
		if (this.isOpen())
			this.close();

		if (!this._triggerEvent("beforeOpen"))
			return;

		if (this.options.exclusive) {
			for (const popperInstance of popperOpenInstances) {
				if (popperInstance.options.group == null || popperInstance.options.group !== this.options.group)
					popperInstance.close();
			}
		}

		this.referenceElement = referenceElement;
		this.popperElement.dataset.popperOpen = "true";

		// FIXME: ДИЧЬ
		const fixPageHeightThrottled = throttleRaf(() => fixPageHeight($(this.popperElement)));

		const popperOptions = {
			modifiers: [
				{
					name: 'fixedOffset',
					phase: 'main',
					requires: ['popperOffsets'],
					fn({ state }) {
						state.modifiersData.popperOffsets.y = state.rects.reference.y;
					},
				},
				{
					name: 'fullWidth',
					enabled: this.options.fullWidth,
					phase: 'beforeWrite',
					fn({ state }) {
						const content = document.querySelector('#main');
						state.styles.popper.minWidth = `${content.getBoundingClientRect().width}px`;
					},
					effect({ state }) {
						const content = document.querySelector('#main');
						state.elements.popper.style.minWidth = `${content.getBoundingClientRect().width}px`;
					}
				},
				popperFlip,
				popperComputeStyles,
				popperPreventOverflow,
				popperOffset,
				popperEventListeners,
				{
					name: 'computeStyles',
					options: {
						adaptive: true,
					},
				},
				{
					name: 'preventOverflow',
					options: {
						padding: this.options.padding,
					},
				},
				{
					name: 'offset',
					options: {
						offset: [this.options.offsetLeft, this.options.offsetTop],
					}
				},
				{
					name: 'eventListeners',
					options: {
						scroll: true,
						resize: true,
					},
				},
				{
					name: 'fixedOffset',
					enabled: this.options.fixed,
				},
				{
					name: 'flip',
					enabled: this.options.flip,
				},
				{
					name: 'FixPageHeight',
					enabled: true,
					phase: 'afterWrite',
					fn() {
						fixPageHeightThrottled();
					}
				},
				{
					name: "arrow",
					enabled: this.options.arrow,
					phase: 'main',
					requires: ['computeStyles'],
					fn({ state }) {
						const basePlacement = state.placement.split('-')[0];
						const axis = ['top', 'bottom'].indexOf(basePlacement) >= 0 ? 'left' : 'top';
						const len = axis == 'left' ? 'width' : 'height';

						const border = axis == 'left' ?
							(state.elements.popper.offsetWidth - state.elements.popper.clientWidth) / 2 :
							(state.elements.popper.offsetHeight - state.elements.popper.clientHeight) / 2;
						const popperRect = state.elements.popper.getBoundingClientRect();
						const refRect = state.elements.reference.getBoundingClientRect();
						const offset = (refRect[axis] + refRect[len] / 2) - popperRect[axis] - border;

						state.elements.popper.style.setProperty('--popper-arrow-offset', `${offset}px`);
					}
				},
			],
			placement: this.options.placement
		};

		this.popper = createPopper(referenceElement, this.popperElement, popperOptions);

		if (this.options.autoScroll) {
			this.popper.forceUpdate();
			scrollIntoViewIfNotVisible(this.popperElement, { start: "nearest", end: "nearest" });
		}

		if (this.options.clickedClass)
			this.referenceElement.classList.add(this.options.clickedClass);

		this._triggerEvent("afterOpen");
		popperOpenInstances.push(this);

		this._startIgnoreBodyClick();

		if (resizeObserver)
			resizeObserver.observe(this.popperElement);
	}

	toggleWith(referenceElement) {
		if (this.isOpen()) {
			this.close();
		} else {
			this.openWith(referenceElement);
		}
	}

	open(options = {}, referenceElement = undefined) {
		if (!referenceElement)
			referenceElement = document.querySelector(`[data-popper-id="${this.element().id}"]`);
		if (!referenceElement)
			throw new Error(`No referenceElement!`);
		this.mergeOptions(referenceElement, options);
		this.openWith(referenceElement);
	}

	toggle(options = {}, referenceElement = undefined) {
		if (!referenceElement)
			referenceElement = document.querySelector(`[data-popper-id="${this.element().id}"]`);
		if (!referenceElement)
			throw new Error(`No referenceElement!`);
		this.mergeOptions(referenceElement, options);
		this.toggleWith(referenceElement);
	}

	close() {
		if (!this.isOpen())
			return;

		if (!this._triggerEvent("beforeClose"))
			return;

		if (this.options.clickedClass)
			this.referenceElement.classList.remove(this.options.clickedClass);

		this.referenceElement = undefined;

		this.popperElement.dataset.popperOpen = "false";
		this.popper.destroy();
		this.popper = undefined;

		this._triggerEvent("afterClose");
		popperOpenInstances = popperOpenInstances.filter((instance) => instance !== this);

		fixPageHeight();

		if (resizeObserver)
			resizeObserver.unobserve(this.popperElement);
	}

	handleBodyClick(e) {
		if (this.ignoreBodyClick || !this.isOpen())
			return;

		const clickedPopper = getNearestPopper(e.target);
		if (clickedPopper?.options.group && clickedPopper.options.group === this.options.group)
			return;
		this.close();
	}

	handleResize() {
		if (this.popper) {
			if (this.options.autoScroll) {
				this.popper.forceUpdate();
				scrollIntoViewIfNotVisible(this.popperElement, { start: "nearest", end: "nearest" });
			} else {
				this.popper.update();
			}
		}
	}

	_startIgnoreBodyClick() {
		this.ignoreBodyClick = true;
		setTimeout(() => this.ignoreBodyClick = false, 0);
	}

	_triggerEvent(eventName) {
		const event = new CustomEvent(`popper:${eventName}`, { detail: { popper: this }, bubbles: true });
		this.popperElement.dispatchEvent(event);
		return !event.defaultPrevented;
	}

	destroy() {
		popperInstances.delete(this.popperElement);
		this.close();
	}
}

function handleResize() {
	for (const popperInstance of popperOpenInstances)
		popperInstance.handleResize();
}

export function getPopperByOpener(opener) {
	for (const popperInstance of popperOpenInstances) {
		if (popperInstance.opener() == opener)
			return popperInstance;
	}
	return undefined;
}

export function getPopperById(popperId) {
	const popperElement = document.querySelector(`#${popperId}`);
	if (!popperElement)
		throw new Error(`Popper not found: ${popperId}`);
	let popperInstance = popperInstances.get(popperElement);
	if (!popperInstance) {
		popperInstance = new Popper(popperElement, {});
		require.component("widgets/popper");
	}
	return popperInstance;
}

export function getNearestPopper(element) {
	let cursor = element;
	while (cursor) {
		if (cursor.id) {
			for (const [_, popperInstance] of popperInstances) {
				if (popperInstance.element() === cursor)
					return popperInstance;
			}
		}
		cursor = cursor.parentNode;
	}
	return undefined;
}

export function closeAllPoppers() {
	for (const popperInstance of popperOpenInstances)
		popperInstance.close();
}

function handleBodyClick(e) {
	for (const popperInstance of popperOpenInstances)
		popperInstance.handleBodyClick(e);
}

function parsePopperOptions(element) {
	return parseDataset(element, {
		type: "string",
		placement: "string",
		clickedClass: "string",
		group: "string",
		offsetLeft: "number",
		offsetTop: "number",
		padding: "number",
		autoScroll: "bool",
		fixed: "bool",
		arrow: "bool",
		fullWidth: "bool",
		flip: "bool",
		exclusive: "bool",
	}, 'popper');
}

module.on("componentpage", () => {
	if (window.ResizeObserver)
		resizeObserver = new ResizeObserver(throttleRaf(handleResize));

	document.body.addEventListener("click", handleBodyClick, { passive: true });
	$('#main')
		.on('click', '.js-popper_open', function (e) {
			e.preventDefault();

			const popperByOpener = getPopperByOpener(this);
			const popperById = getPopperById(this.dataset.popperId);

			if (popperByOpener && popperByOpener != popperById) {
				popperByOpener.close();
				return;
			}

			popperById.toggle(this);
		})
		.on('click', '.js-popper_close', function (e) {
			e.preventDefault();
			if (this.dataset.popperId) {
				const popper = getPopperById(this.dataset.popperId);
				if (popper)
					popper.close();
			} else {
				const popper = getNearestPopper(this);
				popper?.close();
			}
		});
});

module.on("componentpagedone", () => {
	document.body.removeEventListener("click", handleBodyClick, false);

	for (const [_, popperInstance] of popperInstances)
		popperInstance.destroy();

	if (resizeObserver)
		resizeObserver.disconnect();
});
