import videojs from 'video.js';

const Plugin = videojs.getPlugin('plugin');

const HEATMAP_HEIGHT = 15;
const FILL_COLOR = 'currentColor';
const OPACITY = 0.35;

class VideoJsTimelineHeatmap extends Plugin {
	normalizedData;
	resizeObserver;
	svg;
	root;
	area;
	options;

	constructor(player, options) {
		super(player, options);

		if (!window.ResizeObserver)
			return;

		this.options = options;
		this.normalizedData = this.options.heatmap;

		if (player.duration() > 0) {
			this.init();
		} else {
			player.one('durationchange', () => this.init());
		}
	}

	init() {
		const progressControl = this.player.controlBar && this.player.controlBar.progressControl;
		const holder = progressControl && progressControl.el().querySelector('.vjs-progress-holder');

		if (!holder)
			return;

		this.root = document.createElement('div');
		this.root.className = 'vjs-heatmap';
		this.root.style.setProperty('--heatmap-height', HEATMAP_HEIGHT + 'px');
		holder.appendChild(this.root);

		this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		this.svg.classList.add('vjs-heatmap__svg');
		this.svg.setAttribute('preserveAspectRatio', 'none');

		this.area = document.createElementNS('http://www.w3.org/2000/svg', 'path');
		this.area.setAttribute('fill', FILL_COLOR);
		this.area.setAttribute('fill-opacity', String(OPACITY));
		this.area.setAttribute('stroke', 'none');

		this.svg.appendChild(this.area);
		this.root.appendChild(this.svg);

		this.resizeObserver = new ResizeObserver(() => this.redraw());
		this.resizeObserver.observe(holder);

		this.redraw();
		this.player.on('durationchange', () => this.redraw());
	}

	redraw() {
		if (!this.root)
			return;
		const w = this.root.clientWidth;
		this.area.setAttribute('d', makeSvgPath(this.normalizedData, w, HEATMAP_HEIGHT));
	}

	dispose() {
		super.dispose();
		if (this.resizeObserver)
			this.resizeObserver.disconnect();
		if (this.root)
			this.root.remove();
		this.root = undefined;
		this.svg = undefined;
		this.area = undefined;
		this.normalizedData = undefined;
		this.resizeObserver = undefined;
	}
}

videojs.registerPlugin('heatmap', VideoJsTimelineHeatmap);

function makeSvgPath(n, w, h) {
	if (!n.length || w <= 0)
		return '';
	const step = w / (n.length - 1 || 1);
	let d = 'M 0 ' + h + ' L 0 ' + (h - n[0] * h);
	for (let i = 1; i < n.length; i++)
		d += ' L ' + (i * step) + ' ' + (h - n[i] * h);
	d += ' L ' + w + ' ' + h + ' Z';
	return d;
}
