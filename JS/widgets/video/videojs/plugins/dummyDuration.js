import videojs from 'video.js';

videojs.registerPlugin('dummyDuration', function VideoJsDummyDuration(options = { duration: 0 }) {
	const originalDurationGetter = this.tech(true).duration;

	// Просто преопределяем метод duration() чтобы возвращать длительность которую знает бекенд (до загрузки мета-данных)
	this.tech(true).duration = function () {
		const duration = originalDurationGetter.call(this);
		if (duration == null || isNaN(duration) || !isFinite(duration)) {
			// console.warn("[video.js] used fake duration");
			return options.duration;
		}
		return duration;
	};

	this.ready(() => {
		// Даём знать, что длительность изменилась
		this.tech(true).trigger('durationchange');
	});
});
