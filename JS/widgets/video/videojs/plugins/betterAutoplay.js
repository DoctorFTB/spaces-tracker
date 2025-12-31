// Более юзер-френдли автоплей
import videojs from 'video.js';
import { silentPromise } from "./utils";

videojs.registerPlugin('betterAutoplay', function VideoJsBetterAutoplay(options = {}) {
	let canRemoveWaitingClass = true;
	let canRemoveStartedClass = true;
	let firstPlay = false;

	options = {
		playOnFirstSeek: true,
		...options
	};

	// Запускаем плеер при первой перемотке
	const handleTimeUpdate = () => {
		if (options.playOnFirstSeek && !firstPlay && this.currentTime() > 0)
			silentPromise("autoplay on first seek", this.play());
	};

	this.on('timeupdate', handleTimeUpdate);

	this.one('play', () => {
		this.trigger('firstplay'); // удалён в новом VideoJS
		canRemoveStartedClass = false;
		firstPlay = true;
		this.off('timeupdate', handleTimeUpdate);
	});

	this.one('waiting', () => {
		canRemoveWaitingClass = false;
	});

	// Выводим спиннер до начала автовоспроизведения
	if (this.options().autoplay) {
		this.addClass('vjs-waiting');
		this.addClass('vjs-has-started');

		const handleAutoplay = () => {
			canRemoveWaitingClass && this.removeClass('vjs-waiting');
			canRemoveStartedClass && this.removeClass('vjs-has-started');
		};
		this.one('autoplay-failure', handleAutoplay);
		this.one('autoplay-success', handleAutoplay);
	}
});
