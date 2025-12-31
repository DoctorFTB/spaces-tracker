import module from 'module';

let currentTeaser;
let observer;

const tpl = {
	spinner: function () {
		return `
			<div class="tiled_item-spinner js-vapt-spinner">
				<div></div>
				<div></div>
				<div></div>
			</div>
		`;
	}
};

module.on("component", () => {
	// js-vap - video animated preview (teaser)
	for (const item of document.querySelectorAll('.js-vapt')) {
		item.classList.remove('js-vapt');
		initVideoTeaser(item);
	}
});

module.on("componentpage", () => {
	observer = new IntersectionObserver((items) => {
		for (const item of items) {
			if (!item.isIntersecting && currentTeaser?.preview === item.target)
				stopTeaser();
		}
	});
});

module.on("componentpagedone", () => {
	stopTeaser();

	if (observer) {
		observer.disconnect();
		observer = undefined;
	}
});

function initVideoTeaser(item) {
	if (!window.IntersectionObserver)
		return;

	const wrap = item.parentNode;
	wrap.addEventListener("mouseenter", () => startTeaser(item), { passive: true });
	wrap.addEventListener("mouseleave", () => stopTeaser(), { passive: true });
	wrap.addEventListener("touchstart", () => startTeaser(item), { passive: true });
}

function startTeaser(preview) {
	if (currentTeaser && currentTeaser.preview === preview)
		return;

	stopTeaser();

	import("./video-slides").then(({ stopSlides }) => stopSlides());

	const sources = JSON.parse(preview.dataset.vt);
	const source = getBestVideoSource(preview, sources);
	const video = renderVideoTeaser(preview, source);
	observer.observe(preview);
	currentTeaser = { preview, video };
}

export function stopTeaser() {
	if (!currentTeaser)
		return;

	currentTeaser.video.pause();
	currentTeaser.video.src = "";
	currentTeaser.video.load();
	currentTeaser.video.remove();

	currentTeaser.preview.parentNode.querySelector('.js-vapt-spinner')?.remove();

	toggleSpinner(currentTeaser.preview, false);
	toggleAnimation(currentTeaser.preview, false);

	observer.unobserve(currentTeaser.preview);
	currentTeaser = undefined;
}

function toggleSpinner(preview, flag) {
	preview.parentNode.querySelector('.js-vapt-spinner')?.remove();
	if (flag)
		preview.insertAdjacentHTML("afterend", tpl.spinner());
}

function toggleAnimation(preview, flag) {
	const tiledWrap = preview.closest('.tiled_item');
	if (tiledWrap)
		tiledWrap.classList.toggle('tiled_item--animation', flag);
}

function renderVideoTeaser(preview, source) {
	const video = document.createElement('video');
	video.src = source.src;
	video.muted = true;
	video.autoplay = true;
	video.loop = true;
	video.controls = false;
	video.playsInline = true;
	video.preload = 'auto';
	video.className = 'video-teaser video-teaser--is-loading';
	video.setAttribute('webkit-playsinline', '');
	video.addEventListener("click", () => preview.click(), false);

	if (isAspect16x9(source.width, source.height)) {
		video.classList.add('video-teaser--cover');
	} else {
		video.classList.add('video-teaser--contain');
	}
	preview.parentNode.appendChild(video);

	const handleCanPlay = () => {
		toggleSpinner(preview, false);
		toggleAnimation(preview, true);
		video.classList.remove('video-teaser--is-loading');
		video.removeEventListener('play', handleCanPlay, false);
		video.removeEventListener('canplay', handleCanPlay, false);
	};
	video.addEventListener('play', handleCanPlay, false);
	video.addEventListener('canplay', handleCanPlay, false);

	toggleSpinner(preview, true);

	return video;
}

function getBestVideoSource(preview, sources) {
	const dpr = Math.min(2, window.devicePixelRatio);
	const rect = preview.getBoundingClientRect();
	const width = rect.width * dpr;
	const height = rect.height * dpr;
	const limitQuality = getMaxQualityByDownlink();
	let lastSource;
	for (const source of sources) {
		if (source.quality > limitQuality)
			continue;
		lastSource = source;
		if (isAspect16x9(source.width, source.height)) { // cover
			if (source.height >= height)
				return source;
		} else {
			if (source.width > source.height) { // contain
				if (source.width >= width)
					return source;
			} else {
				if (source.height >= height)
					return source;
			}
		}
	}
	return lastSource;
}

function getMaxQualityByDownlink() {
	const qualityToDownlink = [
		{ quality: 1080, downlink: 5.0 },
		{ quality: 720,  downlink: 2.5 },
		{ quality: 480,  downlink: 1.0 },
		{ quality: 360,  downlink: 0.6 },
		{ quality: 240,  downlink: 0.3 },
	];
	const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
	const effectiveDownlink = typeof connection?.downlink === 'number' ? connection.downlink : 1.0;
	for (const preset of qualityToDownlink) {
		if (effectiveDownlink >= preset.downlink)
			return preset.quality;
	}
	return 240;
}

function isAspect16x9(width, height, tolerance = 0.03) {
	const aspect = width / height;
	const target = 16 / 9;
	return Math.abs(aspect / target - 1) <= tolerance;
}
