import module from 'module';
import { tick } from '../utils';
import Spaces from '../spacesLib';

let previewTokens = {};
let previewTokensCnt = 0;
let previewTokensTimer = false;
let observerItems = [];
let ctrItems = [];
let trackedViews = {};
let trackedClicks = {};
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
		rootMargin:		'0px',
		threshold:		0.0,
	});

	for (const item of observerItems)
		observer.observe(item);
}

function init() {
	// js-pvt - preview view tracker
	for (const item of document.querySelectorAll('.js-pvt')) {
		item.classList.remove('js-pvt');

		// Views
		if (observer)
			observer.observe(item);
		observerItems.push(item);

		// CTR
		item.addEventListener("click", handleClick, false);
		item.addEventListener("mousedown", handleClick, false);
		ctrItems.push(item);
	}
}

export function loadLazyItem(el) {
	if (el.tagName === "IMG") {
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
	for (const item of entries) {
		if (item.intersectionRatio > 0) {
			trackItemView(item.target);
			observer && observer.unobserve(item.target);
			observerItems = observerItems.filter((observerItem) => observerItem !== item.target);
		}
	}
}

function sendPreviewTokens() {
	if (!previewTokensCnt) {
		previewTokensTimer = false;
		return;
	}

	const apiData = previewTokens;
	apiData.CK = null;
	apiData.page = location.href;

	previewTokens = {};
	previewTokensCnt = 0;

	Spaces.api("uobj.view", apiData, function (res) {
		tick(sendPreviewTokens);
		if (res.code !== 0)
			console.error('[views tracker] ' + Spaces.apiError(res));
	}, {
		onError: function (err) {
			tick(sendPreviewTokens);
			console.error('[views tracker] ' + err);
		}
	});
}

function handleClick(e) {
	if (e.type == "click") {
		trackItemClick(e.currentTarget);
	} else if (e.type == "mousedown" && (e.button == 1 || e.buttons == 4)) {
		trackItemClick(e.currentTarget);
	}
}

function trackItemView(el) {
	const token = el.dataset.t;
	if (!token || trackedViews[token])
		return;

	const parts = token.split('!');
	const id = parts[0];
	const type = 'toKens_' + (parts[1] || "preview");

	(previewTokens[type] || (previewTokens[type] = [])).push(id);
	previewTokensCnt++;

	if (!previewTokensTimer)
		previewTokensTimer = setTimeout(sendPreviewTokens, 5000);

	trackedViews[token] = true;
}

function trackItemClick(el) {
	const token = el.dataset.t;
	if (!token || trackedClicks[token])
		return;

	const parts = token.split('!');
	const tokenId = parts[0];
	const tokenType = parts[1] || "preview";

	// Другие пока не поддерживаются
	if (tokenType != "preview")
		return;

	Spaces.api("uobj.click", { CK: null, page: location.href, [`token_${tokenType}`]: tokenId }, function (res) {
		if (res.code !== 0)
			console.error('[views tracker] ' + Spaces.apiError(res));
	}, {
		onError: function (err) {
			console.error('[views tracker] ' + err);
		}
	});

	trackedClicks[token] = true;
}

function destroy() {
	for (const item of ctrItems) {
		item.removeEventListener("click", handleClick, false);
		item.removeEventListener("mousedown", handleClick, false);
	}

	for (const item of observerItems) {
		observer && observer.unobserve(item);
		item.classList.add('js-pvt');
	}

	if (observerItems.length > 0)
		tick(() => init());

	observerItems = [];
	ctrItems = [];

	trackedViews = {};
	trackedClicks = {};

	if (observer) {
		observer.disconnect();
		observer = null;
	}
}

module.on("component", init);
module.on("componentpage", initObserver);
module.on("componentpagedone", destroy);

export { trackItemView };
