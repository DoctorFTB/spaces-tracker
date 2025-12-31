// Обход бага: https://github.com/videojs/video.js/issues/4765
// Из-за асинхронного setSource на некоторых устройствах видео не начинает воспроизводиться
// Поэтому пытаемся сделать его синхронным путём переопределения player.handleSrc_
// Приходится выбирать: или держать копию videojs в локальном репозитории или использовать такой костыль
import { throttleRaf } from "../../../../utils";

export function videojsEnableSyncSetSource(videojs) {
	const Player = videojs.getComponent('Player');

	const originalCurrentTime = Player.prototype.currentTime;
	const originalSetTimeout = Player.prototype.setTimeout;
	const originalHandleSrc = Player.prototype.handleSrc_;
	const originalScrubbing = Player.prototype.scrubbing;
	let shouldSyncTimeout = false;

	const updateTime = throttleRaf((player) => {
		player.tech(true).trigger('timeupdate');
	});

	Player.prototype.scrubbing = function (...args) {
		const result = originalScrubbing.apply(this, args);
		if (args.length > 0)
			this.trigger('scrubbing');
		return result;
	}

	Player.prototype.currentTime = function (...args) {
		const result = originalCurrentTime.apply(this, args);
		if (args.length > 0)
			updateTime(this);
		return result;
	}

	Player.prototype.setTimeout = function (callback, timeout) {
		if (shouldSyncTimeout) {
			callback.call(this);
			return -1;
		} else {
			return originalSetTimeout.call(this, callback, timeout);
		}
	};

	Player.prototype.handleSrc_ = function (...args) {
		shouldSyncTimeout = true;
		const result = originalHandleSrc.apply(this, args);
		shouldSyncTimeout = false;
		return result;
	};
}
