import videojs from 'video.js';

videojs.registerPlugin('resizeMonitor', function VideoJsResizeMonitor() {
	const handleResize = () => {
		const element = this.el();
		const rect = element.getBoundingClientRect();
		element.style.setProperty('--vjs-width', rect.width + 'px');
		element.style.setProperty('--vjs-height', rect.height + 'px');
	};

	this.on('playerresize', handleResize);

	if (window.ResizeObserver) {
		const resizeObserver = new ResizeObserver(handleResize);
		resizeObserver.observe(this.el());

		this.on('dispose', () => {
			resizeObserver.unobserve(this.el());
			resizeObserver.disconnect();
		});
	}
});
