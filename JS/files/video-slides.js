import module from 'module';
import { loadLazyItem } from '../core/lazy-load';

let observer;
let currentPreview;
let animationTimer;
let previewsState = {};
let globalSliderId = 1;

const STATE_NONE	= 0;
const STATE_LOADING	= 1;
const STATE_LOADED	= 2;

const tpl = {
	spinner: function () {
		return `
			<div class="tiled_item-spinner js-vap-spinner">
				<div></div>
				<div></div>
				<div></div>
			</div>
		`;
	}
};

module.on("component", () => {
	if (!window.IntersectionObserver)
		return;

	// js-vap - video animated preview
	for (let item of document.querySelectorAll('.js-vap')) {
		item.classList.remove('js-vap');
		initVideoSlides(item);
	}
});

module.on("componentpage", () => {
	observer = new IntersectionObserver((items) => {
		for (const item of items) {
			if (!item.isIntersecting && currentTeaser?.preview === item.target)
				stopSlides();
		}
	});
});

module.on("componentpagedone", () => {
	stopSlides();

	for (let id in previewsState)
		previewsState[id].callback = null;

	previewsState = {};


	if (observer) {
		observer.disconnect();
		observer = undefined;
	}
});

function initVideoSlides(item) {
	let wrap = item.parentNode;
	wrap.addEventListener("mouseenter", () => startSlides(item), { passive: true });
	wrap.addEventListener("mouseleave", () => stopSlides(), { passive: true });
	wrap.addEventListener("touchstart", () => startSlides(item), { passive: true });
}

function startSlides(preview) {
	if (currentPreview && preview.dataset.animationId && currentPreview.id === preview.dataset.animationId)
		return;

	if (currentPreview)
		stopSlides();

	import("./video-teaser").then(({ stopTeaser }) => stopTeaser());

	if (preview.dataset.s)
		loadLazyItem(preview);

	if (!previewsState[preview.dataset.animationId]) {
		preview.dataset.animationId = globalSliderId++;
		previewsState[preview.dataset.animationId] = {
			id: preview.dataset.animationId,
			preview,
			currentSlideElement: null,
			src: preview.src,
			srcset: preview.srcset,
			slide: 0,
			loadState: STATE_NONE,
			callback: null,
			slides: []
		};
	}

	currentPreview = previewsState[preview.dataset.animationId];

	loadSlides(preview, () => {
		if (!currentPreview || !currentPreview.slides.length)
			return;

		const tiledWrap = currentPreview.preview.closest('.tiled_item');
		if (tiledWrap)
			tiledWrap.classList.add('tiled_item--animation');

		renderFrame();
		animationTimer = setInterval(renderFrame, 800);
	});
}

function renderFrame() {
	let slideImage = currentPreview.slides[currentPreview.slide];
	currentPreview.preview.src = slideImage.src;
	currentPreview.preview.srcset = slideImage.srcset;
	currentPreview.slide = (currentPreview.slide + 1) % currentPreview.slides.length;
}

function loadSlides(preview, callback) {
	let state = previewsState[preview.dataset.animationId];
	if (state.loadState == STATE_LOADED) {
		callback();
		return;
	}

	state.callback = callback;

	if (state.loadState != STATE_NONE)
		return;

	state.loadState = STATE_LOADING;

	let animationSlides1x = JSON.parse(preview.dataset.a);
	let animationSlides2x = preview.dataset.a2 ? JSON.parse(preview.dataset.a2) : [];

	let slidesLoaded = 0;

	let onSlideLoaded = (e) => {
		if (!e.target.onload)
			return;
		e.target.onload = e.target.onerror = null;
		slidesLoaded++;

		if (slidesLoaded >= animationSlides1x.length) {
			state.loadState = STATE_LOADED;
			preview.parentNode.querySelector('.js-vap-spinner').remove();
			state.slides = state.slides.filter((img) => img.width && img.height && img.src != preview.src);
			state.callback && state.callback();
			state.callback = null;
		}
	};

	for (let i = 0; i < animationSlides1x.length; i++) {
		let src1x = animationSlides1x[i];
		let src2x = animationSlides2x[i];

		let img = new Image();
		img.src = src1x;
		if (src2x)
			img.srcset = `${src1x}, ${src2x} 1.5x`;

		img.onload = onSlideLoaded;
		img.onerror = onSlideLoaded;
		state.slides.push(img);
	}

	preview.insertAdjacentHTML("afterend", tpl.spinner());
}

export function stopSlides() {
	if (animationTimer) {
		clearInterval(animationTimer);
		animationTimer = null;
	}

	if (currentPreview) {
		const tiledWrap = currentPreview.preview.closest('.tiled_item');
		if (tiledWrap)
			tiledWrap.classList.remove('tiled_item--animation');

		observer.unobserve(currentPreview.preview);
		currentPreview.callback = null;
		currentPreview.preview.src = currentPreview.src;
		currentPreview.preview.srcset = currentPreview.srcset;
		currentPreview = null;
	}
}
