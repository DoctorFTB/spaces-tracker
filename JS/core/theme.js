import { setCssTheme, setCassLoadHook } from 'loader';
import { Env, INITIAL_THEME } from './env';
import cookie from '../cookie';

let current_theme = Env.theme;
let effective_theme = INITIAL_THEME;
let css_upgraded = false;
let on_theme_change_callbacks = [];

initThemeSwitcher();

function getCurrentTheme() {
	return current_theme;
}

function getEffectiveTheme() {
	return effective_theme;
}

function onThemeChange(callback) {
	on_theme_change_callbacks.push(callback);
	return () => {
		on_theme_change_callbacks = on_theme_change_callbacks.filter((c) => c !== callback);
	};
}

function isSupportSystemTheme() {
	return !!window.matchMedia;
}

function initThemeSwitcher() {
	if (!isSupportSystemTheme()) {
		syncCookies('light'); // статистика
		return;
	}
	
	let onThemeChanged = (e) => {
		if (current_theme == 'system') {
			effective_theme = e.matches ? 'dark' : 'light';
			syncCssAndTheme();
		}
		syncCookies(e.matches ? 'dark' : 'light'); // статистика
	};
	
	let media = window.matchMedia('(prefers-color-scheme: dark)');
	if (media.addEventListener) {
		media.addEventListener("change", onThemeChanged);
	} else if (media.addListener) {
		media.addListener(onThemeChanged);
	}
	
	onThemeChanged(media);
}

function switchTheme(new_theme) {
	if (new_theme == current_theme)
		return;
	
	current_theme = new_theme;
	
	if (new_theme == "system") {
		if (isSupportSystemTheme()) {
			let media = window.matchMedia('(prefers-color-scheme: dark)');
			effective_theme = media.matches ? 'dark' : 'light';
		} else {
			effective_theme = 'light';
		}
	} else {
		effective_theme = new_theme;
	}
	
	syncCssAndTheme();
}

function upgradeCss() {
	if (effective_theme == INITIAL_THEME)
		return;
	
	let new_theme = (INITIAL_THEME == 'light' ? 'dark' : 'light');
	let links = document.querySelectorAll('link[data-href]');
	
	setCssTheme('both');
	setCassLoadHook((mode, link) => {
		if (current_theme == 'system' && isSupportSystemTheme()) {
			link.media = "(prefers-color-scheme: " + link.getAttribute('data-theme') + ")";
		} else {
			link.media = (link.getAttribute('data-theme') == effective_theme ? 'all' : 'only x');
		}
	});
	
	let links_to_downloads = links.length;
	links.forEach((link) => {
		let [light_href, dark_href] = link.getAttribute('data-href').split('|');
		let new_href = (new_theme == 'dark' ? dark_href : light_href);//.replace(/\?.*?$/, '?' + Date.now());
		loadThemeCSS(link, INITIAL_THEME, new_theme, new_href, () => {
			links_to_downloads--;
			if (links_to_downloads == 0) {
				css_upgraded = true;
				setTimeout(() => syncCssAndTheme(), 250);
			}
		});
	});
}

function syncCssAndTheme() {
	if (!css_upgraded) {
		upgradeCss();
		return;
	}
	
	let links = document.querySelectorAll('link[data-theme]');
	if (current_theme == 'system' && isSupportSystemTheme()) {
		links.forEach((link) => {
			link.media = "(prefers-color-scheme: " + link.getAttribute('data-theme') + ")";
		});
	} else {
		links.forEach((link) => {
			link.media = (link.getAttribute('data-theme') == effective_theme ? 'all' : 'only x');
		});
	}
	
	document.body.className = document.body.className.replace(/root--theme-(\w+)/, 'root--theme-' + effective_theme);
	
	syncBrowserThemeColor();
	
	for (let callback of on_theme_change_callbacks)
		callback(effective_theme);
}

function syncBrowserThemeColor() {
	let theme_color = document.querySelector('meta[name="theme-color"]') || document.createElement('meta');
	theme_color.name = "theme-color";
	theme_color.content = "#1f1f1f";
	
	if (current_theme == "system") {
		theme_color.media = "(prefers-color-scheme: dark)";
		if (!theme_color.parentNode)
			document.head.appendChild(theme_color);
	} else if (current_theme == "dark") {
		theme_color.media = "all";
		if (!theme_color.parentNode)
			document.head.appendChild(theme_color);
	} else {
		if (theme_color.parentNode)
			theme_color.parentNode.removeChild(theme_color);
	}
}

function loadThemeCSS(old_link, old_theme, new_theme, new_href, callback, errors_cnt) {
	errors_cnt = errors_cnt || 0;
	
	let new_link = document.createElement('link');
	new_link.rel = "stylesheet";
	new_link.type = "text/css";
	new_link.media = 'only x';
	new_link.href = new_href;
	new_link.setAttribute('data-sort', old_link.getAttribute('data-sort'));
	new_link.setAttribute('data-theme', new_theme);
	
	old_link.setAttribute('data-theme', old_theme);
	old_link.removeAttribute('data-href');
	
	new_link.onload = () => {
		if (!new_link.onload)
			return;
		
		callback && callback();
		new_link.onload = null;
		new_link.onerror = null;
	};
	new_link.onerror = () => {
		if (!new_link.onerror)
			return;
		
		new_link.onload = null;
		new_link.onerror = null;
		
		setTimeout(() => {
			new_link.parentNode.removeChild(new_link);
			new_href = new_href.replace(/\?.*?$/, '?' + Date.now());
			loadThemeCSS(old_link, old_theme, new_theme, new_href, callback, errors_cnt + 1);
		}, getErrorTimeout(errors_cnt));
	};
	
	old_link.parentNode.insertBefore(new_link, old_link);
}

function getErrorTimeout(errors_cnt) {
	let timeouts = [1000, 2000, 3000, 4000, 80000, 10000, 15000];
	return timeouts[errors_cnt] || 30000;
}

function syncCookies(default_theme) {
	cookie.set('theme', default_theme);
}

export { getCurrentTheme, getEffectiveTheme, switchTheme, isSupportSystemTheme, onThemeChange };
