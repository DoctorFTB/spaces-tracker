import videojs from 'video.js';

videojs.registerPlugin('hideOnBlur', function VideoJsHideOnBlur() {
	let firstPlayTime = 0;
	this.one('firstplay', () => {
		firstPlayTime = Date.now();
	});
	this.el().addEventListener('mouseleave', () => {
		const hasMenuOpened = this.el().querySelectorAll('.vjs-menu.vjs-lock-showing').length > 0;
		if (!hasMenuOpened && !this.paused() && Date.now() - firstPlayTime > 3000)
			setTimeout(() => this.userActive(false), 0);
	});
});
