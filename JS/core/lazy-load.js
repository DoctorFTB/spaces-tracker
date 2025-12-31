import module from 'module';
import { tick } from '../utils';

let observerItems = [];
let observer;

async function initObserver() {
	if (observer)
		return;

	if (!window.IntersectionObserver) {
		await import("intersection-observer");
		IntersectionObserver.prototype.USE_MUTATION_OBSERVER = false;
	}

	observer = new IntersectionObserver(intersectionCallback, {
		root:			null,
		rootMargin:		'0px 0px 400px 0px',
		threshold:		0.0,
	});

	for (let observerItem of observerItems)
		observer.observe(observerItem);
}

function init() {
	// js-pdl - picture defer loading
	for (let item of document.querySelectorAll('.js-pdl')) {
		item.classList.remove('js-pdl');
		if (observer)
			observer.observe(item);
		observerItems.push(item);
	}

	nextSerialLoad();
}

function nextSerialLoad() {
	// js-psl - picture serial loading
	const img = document.querySelector('.js-psl');
	if (img) {
		img.classList.remove('js-psl');
		const callback = () => {
			img.removeEventListener('load', callback, false);
			img.removeEventListener('error', callback, false);
			nextSerialLoad();
		};
		img.addEventListener('load', callback, false);
		img.addEventListener('error', callback, false);
		loadLazyItem(img);
	}
}

export function loadLazyItem(el) {
	if (el.tagName == "IMG") {
		if (el.dataset.s) {
			if (el.dataset.s2)
				el.srcset = el.dataset.s + ', ' + el.dataset.s2 + ' 1.5x';
			el.src = el.dataset.s;
			delete el.dataset.s;
			delete el.dataset.s2;
		}
	}
}

function intersectionCallback(entries) {
	for (let item of entries) {
		if (item.intersectionRatio > 0) {
			loadLazyItem(item.target);
			observer.unobserve(item.target);
			observerItems = observerItems.filter((observerItem) => observerItem !== item.target);
		}
	}
}

function destroy() {
	for (let observerItem of observerItems) {
		observer && observer.unobserve(observerItem);
		observerItem.classList.add('js-pdl');
	}

	if (observerItems.length > 0) {
		tick(() => init());
		observerItems = [];
	}

	if (observer) {
		observer.disconnect();
		observer = null;
	}
}

module.on("component", init);
module.on("componentpage", initObserver);
module.on("componentpagedone", destroy);
