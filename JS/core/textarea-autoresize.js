import module from 'module';
import { findParent } from '../utils/dom';

module.on('component', () => {
	for (let textarea of document.querySelectorAll('.js-resize_ta')) {
		if (!textarea.dataset.isResizable) {
			initAutoResize(textarea);
			textarea.dataset.isResizable = 1;
		}
	}
});

window.addEventListener('resize', () => recheckTextareas(false), false);
module.on('componentpage', () => recheckTextareas(true));

function recheckTextareas(onlyWithText) {
	for (let textarea of document.querySelectorAll('.js-resize_ta')) {
		if (!onlyWithText || textarea.value.length > 0)
			resizeTextarea(textarea);
	}
}

function initAutoResize(textarea) {
	let onChange = (e) => resizeTextarea(textarea);
	textarea.addEventListener('change', onChange, false);
	textarea.addEventListener('input', onChange, false);
	textarea.addEventListener('paste', onChange, false);
}

function resizeTextarea(el) {
	let min = +(el.dataset.minRows || 1);
	let max = +el.dataset.maxRows;

	if (el.dataset.minimized)
		min = el.dataset.toolbarOpened ? min : 1;

	el.rows = min;

	let style = window.getComputedStyle(el);
	let paddings = px(style.paddingTop) + px(style.paddingBottom);
	let lineHeight = px(style.lineHeight);
	let lines = Math.round((el.scrollHeight - paddings) / lineHeight);
	el.rows = Math.max(Math.min(lines, max), min);

	const parentInputGroup = findParent(el, '.js-text_input');
	if (parentInputGroup)
		parentInputGroup.dataset.rows = el.rows;
}

function px(value) {
	return +value.replace(/px$/i, '');
}
