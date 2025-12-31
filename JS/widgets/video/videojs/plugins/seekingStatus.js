import videojs from 'video.js';

videojs.registerPlugin('seekingStatus', function VideoJsSeekingStatus() {
	this.on('useractive', () => {
		this.removeClass('vjs-after-seeking');
	});

	this.on('seeking', () => {
		if (this.paused()) {
			this.addClass('vjs-seeking-paused');
		} else {
			this.addClass('vjs-seeking-playing');
		}
		this.addClass('vjs-after-seeking');
	});

	this.on('seeked', () => {
		this.removeClass('vjs-seeking-paused');
		this.removeClass('vjs-seeking-playing');
	});
});
