import $ from '../jquery';
import Device from '../device';
import SpacesApp from '../android/api';

// Настройки для свайпа
const SIDEBAR_NO_SWIPE = (
	!!navigator.userAgent.match(/(UCBrowser|UCWEB)/i) ||
	Device.type != 'touch' ||
	Device.android_app ||
	Device.browser.name == 'safari'
);

const SIDEBAR_GESTURE_MIN_X = 50;
const SIDEBAR_GESTURE_MAX_Y = 60;

let locked = false;
let lastScroll = 0;

init();

function init() {
	let handleClick = (e) => {
		toggle();
		return false;
	};

	let handleResize = (e) => {
		if ($('body').hasClass('root--is-sidebar-open') && $(window).innerWidth() >= 900)
			toggle(false);
	};

	$('#header_elements').on('click', '#home_link', handleClick);
	$('#js-root-overlay').on('click', handleClick);

	window.addEventListener('resize', handleResize, { passive: true });
	window.addEventListener('orientationchange', handleResize, { passive: true });

	initSwipe();
}

function initSwipe() {
	if (SIDEBAR_NO_SWIPE)
		return;

	let startX = 0;
	let startY = 0;
	let gesture = false;

	document.body.addEventListener('touchstart', (e) => {
		if (locked)
			return;

		if (e.target.closest('.vjs-control-bar')) {
			gesture = false;
			return;
		}

		gesture = !e.touches || e.touches.length == 1;
		startX = e.touches ? e.touches[0].clientX : e.clientX;
		startY = e.touches ? e.touches[0].clientY : e.clientY;
	}, { passive: true });

	document.body.addEventListener('touchmove', (e) => {
		if (!gesture)
			return;

		const x = e.touches ? e.touches[0].clientX : e.clientX;
		const y = e.touches ? e.touches[0].clientY : e.clientY;
		const dX = Math.abs(x - startX);
		const dY = Math.abs(y - startY);

		if (dY > SIDEBAR_GESTURE_MAX_Y) {
			gesture = false;
		} else {
			if (dX * 0.66 >= dY) {
				if (dX >= SIDEBAR_GESTURE_MIN_X) {
					const isOpen = startX <= x;
					gesture = false;
					if (!locked) {
						setTimeout(() => toggle(isOpen), 0);
					}
				}
			} else {
				gesture = false;
			}
		}
	}, { passive: true });
}

export function toggle(state) {
	const body = $("body");
	const sidebar = $('#sidebar_wrap');
	const sidebarBg = $('#js-sidebar-bg');

	if (state == null)
		state = !body.hasClass('root--is-sidebar-open');

	if (Device.android_app) {
		if (state) {
			lastScroll = $(window).scrollTop();
			$('html, body').scrollTop(0);
			$('#siteContent').css({marginTop: -lastScroll});
		} else {
			$('#siteContent').css({marginTop: 0});
			$('html, body').scrollTop(lastScroll);
		}
	}

	if (!sidebar.data('noDark')) {
		sidebarBg.toggleClass('sidebar--dark', sidebar.data('dark') == 1 || state);
		sidebar.toggleClass('sidebar--dark', sidebar.data('dark') == 1 || state);
	}

	body.toggleClass("root--is-sidebar-open", state);
	$('#home_link').toggleClass("horiz-menu__link_no_hover", state);
}

export function lock(flag) {
	locked = flag;

	if (Device.android_app)
		SpacesApp.exec('sidebar', {enable: !flag});
}
