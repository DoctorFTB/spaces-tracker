import {loadScript} from 'loader';
import {tick, windowReady} from '../utils';
import cookie from '../cookie';

const GOOGLE_ANALYTICS		= SPACES_PARAMS.GA;
const YANDEX_METRIC_ID		= SPACES_PARAMS.YM;
const LIVEINTERNET_ENABLED	= SPACES_PARAMS.LI;

window.ga = window.ga || function () {
	if (!GOOGLE_ANALYTICS?.id)
		return;
	(window.ga.q = window.ga.q || []).push(arguments);
	window.ga.l = Date.now();
};

window.dataLayer = window.dataLayer || [];
window.gtag = window.gtag || function () {
	if (!GOOGLE_ANALYTICS?.tag)
		return;
	dataLayer.push(arguments);
};

if (GOOGLE_ANALYTICS) {
	// Google Analytics
	if (GOOGLE_ANALYTICS.id) {
		ga('create', GOOGLE_ANALYTICS.id, {
			
		});
		
		windowReady(() => loadScript("//www.google-analytics.com/analytics.js"));
	}
	
	// Google Analytics 6
	if (GOOGLE_ANALYTICS.tag) {
		windowReady(() => loadScript('https://www.googletagmanager.com/gtag/js?id=' + GOOGLE_ANALYTICS.tag));
		
		gtag('js', new Date());
		gtag('config', GOOGLE_ANALYTICS.tag, {send_page_view: false});
	}
}

window.ym = window.ym || function () {
	if (!YANDEX_METRIC_ID)
		return;
	(window.ym.a = window.ym.a || []).push(arguments);
	window.ym.l = Date.now();
};

window.ymab = window.ymab || function () {
	if (!YANDEX_METRIC_ID)
		return;
	(window.ymab.a = window.ymab.a || []).push(arguments);
};

// Загружаем Yandex метрику
if (YANDEX_METRIC_ID) {
	ym(YANDEX_METRIC_ID, "init", {
		clickmap:				true,
		trackLinks:				true,
		accurateTrackBounce:	true,
		defer:					true,
		webvisor:				!!SPACES_PARAMS.YM_WV
	});
	
	windowReady(() => {
		loadScript("https://cdn.jsdelivr.net/npm/yandex-metrica-watch/tag.js");
		loadScript("https://abt.s3.yandex.net/expjs/latest/exp.js");
	});

	ymab(`metrika.${YANDEX_METRIC_ID}`, 'getFlags', (flags) => {
		const oldFlags = getOldYMAB();
		cookie.set("ymab", JSON.stringify({ ...oldFlags, ...flags }), { expires: 3600 * 24 });
	});
}

trackHit(document.location.href, document.title, document.referrer);

// Единая функция отправки метрики
function trackHit(url, title, referer, firstInit) {
	tick(() => {
		// Google Analytics
		if (GOOGLE_ANALYTICS && GOOGLE_ANALYTICS.id) {
			ga('set', 'referrer', referer);
			ga('send', 'pageview', {
				'page': url.replace(/^https?:\/\/([^#?\/]+)/i, ''),
				'title': title
			});
		}
		
		// Google Analytics 6
		if (GOOGLE_ANALYTICS && GOOGLE_ANALYTICS.tag) {
			gtag('event', 'page_view', {
				page_title:		title,
				page_location:	url,
				page_path:		url.replace(/^https?:\/\/([^#?\/]+)/i, ''),
				page_referrer:	referer,
				send_to:		GOOGLE_ANALYTICS.tag
			});
		}
		
		// Yandex
		if (YANDEX_METRIC_ID) {
			ym(YANDEX_METRIC_ID, 'hit', url, {
				title:		title,
				referer:	referer,
				params:		SPACES_PARAMS.VP || {}
			});
		}
		
		// Liveinternet
		if (LIVEINTERNET_ENABLED) {
			let li_wrapper = document.getElementById('LI');
			if (li_wrapper) {
				let img = document.createElement('img');
				img.src = "//counter.yadro.ru/hit?t41.6;r" + 
					escape(referer) + 
					("undefined" == typeof screen ? "" : ";s" + screen.width + "*" + screen.height + "*" + (screen.colorDepth ? screen.colorDepth : screen.pixelDepth)) + 
					";u" + escape(url) + ";" + Math.random();
				
				img.setAttribute('width', '1');
				img.setAttribute('height', '1');
				img.setAttribute('alt', 'liveinternet');
				
				img.onload = img.onerror = function () {
					if (img.parentNode)
						img.parentNode.removeChild(img);
					img.onload = img.onerror = null;
				};
				
				li_wrapper.appendChild(img);
			}
		}
	});
}

export function reachGoal(goalId) {
	if (YANDEX_METRIC_ID) {
		console.log("[yandex] reachGoal", goalId);
		ym(YANDEX_METRIC_ID, 'reachGoal', goalId);
	}
}

function getOldYMAB() {
	try {
		return JSON.parse(cookie.get("ymab"));
	} catch (e) {
		return {};
	}
}

export { trackHit };
