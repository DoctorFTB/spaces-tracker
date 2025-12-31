import cookie from "../../cookie";
import Device from "../../device";

const DEFAULT_QUALITY = Device.type == "desktop" ? 480 : 360;

const VP_Q_COOKIE_NAME = "vpq";

const VIDEO_CODECS = {
	// codecs можно получить через https://github.com/axiomatic-systems/Bento4
	// (mp4info его. именно его, а не тот, что в репозиториях debian/ubuntu)
	// mp4info test.mp4 | grep Codecs
	240:	"avc1.42c00d, mp4a.40.2",
	360:	"avc1.42c01e, mp4a.40.2",
	480:	"avc1.4d401e, mp4a.40.2",
	720:	"avc1.64001f, mp4a.40.2",
	1080:	"avc1.640028, mp4a.40.2",
};

let testVideoElement;
let maxPossibleQualityForMP4;
let canPlayCache = {};

export function getMimeByQuality(quality) {
	return 'video/mp4; codecs="' + VIDEO_CODECS[quality] + '"';
}

export function canPlayQuality(quality) {
	return canPlay(getMimeByQuality(quality));
}

export function getMaxSupportedQuality() {
	if (maxPossibleQualityForMP4 === undefined) {
		for (const quality in VIDEO_CODECS) {
			if (canPlay('video/mp4; codecs="' + VIDEO_CODECS[quality] + '"'))
				maxPossibleQualityForMP4 = +quality;
		}
	}
	return maxPossibleQualityForMP4;
}

export function getPreferredVideoQuality() {
	const savedVideoQuality = getSavedQuality();
	if (savedVideoQuality in VIDEO_CODECS)
		return savedVideoQuality;

	const maxPossibleQuality = getMaxSupportedQuality() || DEFAULT_QUALITY;
	const qualityByDownlink = getMaxQualityByDownlink();
	const qualityByResolution = getMaxQualityByResolution();

	return Math.min(
		qualityByDownlink, // Качество по скорости которую определил браузер
		maxPossibleQuality, // Качество по возможностям устройства
		qualityByResolution, // Качество по разрешению экрана
	);
}

export function saveSelectedQuality(quality) {
	try {
		if (window.localStorage) {
			window.localStorage[VP_Q_COOKIE_NAME] = quality;
			return;
		}
	} catch (e) { }

	// cookie fallback
	cookie.set(VP_Q_COOKIE_NAME, quality);
}

function getMaxQualityByResolution() {
	const dpr = Math.min(2, window.devicePixelRatio);
	const playerWidth = Math.min(600 * dpr, screen.width * dpr);
	for (const quality of [240, 360, 480, 720, 1080]) {
		const videoWidth = quality * (16 / 9);
		if (videoWidth >= playerWidth)
			return Math.max(quality, DEFAULT_QUALITY);
	}
	return DEFAULT_QUALITY;
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

function canPlay(type) {
	if (!(type in canPlayCache)) {
		try {
			testVideoElement = testVideoElement || document.createElement('video');
			canPlayCache[type] = testVideoElement.canPlayType && testVideoElement.canPlayType(type);
		} catch (e) {
			canPlayCache[type] = false;
		}
	}
	return canPlayCache[type];
}

function getSavedQuality() {
	try {
		if (window.localStorage && window.localStorage[VP_Q_COOKIE_NAME])
			return window.localStorage[VP_Q_COOKIE_NAME];
	} catch (e) { }

	// cookie fallback
	return cookie.get(VP_Q_COOKIE_NAME) || 0;
}
