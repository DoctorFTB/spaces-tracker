import { windowReady, loadScript } from "loader";
import Device from './device';
import cookie from './cookie';

// Удобно!
window.cookie = cookie;

// Метрика
import './metrics/track';

// Загрузка страниц
import './ajaxify';

// Уведомления
import './notifications';

// FIXME
import './spoiler';

// Отложенная загрузка виджетов
import './widgets/loadable_item';

// Переключатор темы
import './core/theme';
import SPACES_PARAMS from './core/env';

if (cookie.get("spaces_js_console")) {
	loadScript("https://cdn.jsdelivr.net/npm/eruda@3.4.3", () => {
		window.eruda.init();
	});
}

const m = location.href.match(/lm=(\d+)/i);
if (m) {
	const main_content_block = document.getElementById('main_content_block');
	main_content_block.style.margin = `0 -${m[1]}px`;
}

if (window.SPACES_PARAMS.nid) {
	// Обновление статуса онлайн у иконок юзеров
	import('./online_status');
	
	if (Device.type == 'desktop') {
		// Отправка сообщений по Ctrl-Enter
		import("./ctrl_enter");
	}
} else if (!cookie.get("sandbox")) {
	// Защита тумб
	import("./widgets/files/thumb-guard");
}

if (window.devicePixelRatio)
	cookie.set("dpr", window.devicePixelRatio);

if (SPACES_PARAMS.hetznerCheckURL)
	windowReady(() => import("./metrics/htz-checker"));
