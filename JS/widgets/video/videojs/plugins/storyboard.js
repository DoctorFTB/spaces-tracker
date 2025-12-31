import videojs from 'video.js';
import { throttleRaf } from '../../../../utils';

const Component = videojs.getComponent('Component');

videojs.registerPlugin('storyboard', function VideoJsStoryboard(options = {}) {
	const order = videojs.browser.TOUCH_ENABLED ? 3 : undefined;
	this.addChild('Storyboard', options, order);
});

class Storyboard extends Component {
	constructor(player, options) {
		options = {
			videoWidth: 1920,
			videoHeight: 1080,
			frameWidth: 160,
			frameHeight: 90,
			totalFramesCount: 0,
			spriteFramesCount: 50,
			spriteFramesPerRow: 10,
			sprites: [],
			...options
		};
		super(player, options);

		if (!this.options_.totalFramesCount)
			return;

		this.spritesLoadStatus = {};
		this.currentHoverProgress = 0;
		this.isMoving = false;

		const mouseTimeDisplay = player.getChild("controlBar")
			?.getChild("progressControl")
			?.getChild("seekBar")
			?.getChild("mouseTimeDisplay");

		if (mouseTimeDisplay)
			mouseTimeDisplay.hide();

		if (videojs.browser.TOUCH_ENABLED) {
			const handleScrubbing = throttleRaf((event) => {
				if (player.scrubbing()) {
					let time = event.target.pendingSeekTime() || player.currentTime();
					this.currentHoverProgress = time / player.duration();
					this._update();
				}
			});
			player.on("timeupdate", (event) => {
				if (event.target?.pendingSeekTime)
					handleScrubbing(event);
			});
			player.on("scrubbing", () => {
				if (player.scrubbing()) {
					this.el().classList.add('vjs-thumbnail--visible');
				} else {
					this.el().classList.remove('vjs-thumbnail--visible');
				}
			});
		} else {
			const handleMove = throttleRaf((e) => {
				this.currentHoverProgress = videojs.num.clamp(videojs.dom.getPointerPosition(this.progressControl, e).x, 0, 1);
				this._update();
			});

			const onMouseEnter = (e) => {
				this.el().classList.add('vjs-thumbnail--visible');
				handleMove(e);
				this.isMoving = true;
			};

			const onMouseLeave = () => {
				this.el().classList.remove('vjs-thumbnail--visible');
				this.isMoving = false;
			};

			this.progressControl.addEventListener('mouseenter', onMouseEnter);
			this.progressControl.addEventListener('mousemove', handleMove);
			this.progressControl.addEventListener('mouseleave', onMouseLeave);
		}

		player.on("playerresize", () => this._handleResize());
		this._handleResize();
	}

	loadSprite(spriteIndex) {
		if (this.spritesLoadStatus[spriteIndex])
			return;
		const sprite = this.options_.sprites[spriteIndex];
		this.spritesLoadStatus[spriteIndex] = "loading";
		loadImage(sprite.src, sprite.src_2x, (status) => {
			this.spritesLoadStatus[spriteIndex] = status ? "loaded" : "error";
			if (spriteIndex + 1 < this.options_.sprites.length)
				this.loadSprite(spriteIndex + 1);
			if (spriteIndex - 1 >= 0)
				this.loadSprite(spriteIndex - 1);
		});
	}

	createEl() {
		this.progressControl = this.player().el().querySelector('.vjs-progress-control');

		const el = videojs.dom.createEl('div', {
			className: 'vjs-thumbnail',
			tabIndex: -1
		});

		this.timeLabel = videojs.dom.createEl('div', {
			className: 'vjs-thumbnail__time-label'
		});
		el.appendChild(this.timeLabel);

		return el;
	}

	_handleResize() {
		if (videojs.browser.TOUCH_ENABLED) {
			const playerElement = this.player().el();
			const playerRect = playerElement.getBoundingClientRect();
			const [thumbW, thumbH] = resize(this.options_.videoWidth, this.options_.videoHeight, playerRect.width, playerRect.height);
			this.thumbW = thumbW;
			this.thumbH = thumbH;
		} else {
			const [thumbW, thumbH] = resize(this.options_.videoWidth, this.options_.videoHeight, this.options_.frameWidth, this.options_.frameHeight);
			this.thumbW = thumbW;
			this.thumbH = thumbH;
		}

		if (this.player().scrubbing() || this.isMoving) {
			const duration = this.player().duration();
			if (duration != null && !isNaN(duration))
				this._update();
		}
	}

	_update() {
		// Текущая позиция
		const currentHoverTime = this.player().duration() * this.currentHoverProgress;
		const frameNumber = Math.floor(this.options_.totalFramesCount * this.currentHoverProgress);

		// Определяем номер спрайта и номер кадра в этом спрайте
		const spriteIndex = Math.floor(frameNumber / this.options_.spriteFramesCount);
		const spriteFrameNumber = frameNumber - spriteIndex * this.options_.spriteFramesCount;

		// Определяем размеры текущего спрайта
		const framesPerRow = this.options_.spriteFramesPerRow;
		const spriteFramesCount = Math.min(this.options_.totalFramesCount - (spriteIndex * this.options_.spriteFramesCount), this.options_.spriteFramesCount);
		const spriteCols = Math.min(spriteFramesCount, framesPerRow);
		const spriteRows = Math.ceil(spriteFramesCount / framesPerRow);

		// Предзагрузка
		this.loadSprite(spriteIndex);

		const src = window.devicePixelRatio >= 1.5 ? this.options_.sprites[spriteIndex].src_2x : this.options_.sprites[spriteIndex].src;
		const el = this.el();
		el.style.width = this.thumbW + 'px';
		el.style.height = this.thumbH + 'px';
		el.style.backgroundImage = `url(${src})`;
		el.style.backgroundPositionX = `${-this.thumbW * (spriteFrameNumber % framesPerRow)}px`;
		el.style.backgroundPositionY = `${-this.thumbH * Math.floor(spriteFrameNumber / framesPerRow)}px`;
		el.style.backgroundSize = `${spriteCols * this.thumbW}px ${spriteRows * this.thumbH}px`;

		if (!videojs.browser.TOUCH_ENABLED) {
			this.timeLabel.textContent = videojs.time.formatTime(currentHoverTime);
			const maxX = this.progressControl.offsetLeft + this.progressControl.offsetWidth - this.thumbW;
			const minX = this.progressControl.offsetLeft;
			const x = Math.min(maxX, Math.max(minX, this.player().el().offsetWidth * this.currentHoverProgress - (this.thumbW / 2)));
			el.style.transform = `translate(${x}px, 0px)`;
		}
	}
}

videojs.registerComponent('Storyboard', Storyboard);

function loadImage(src, src_2x, callback) {
	let img = new Image();
	img.src = src;
	if (src_2x)
		img.srcset = `${src}, ${src_2x} 1.5x`;

	const handleLoad = () => {
		img.onload = null;
		img.onerror = null;
		img = undefined;
		callback(true);
	};

	const handleError = () => {
		img.onload = null;
		img.onerror = null;
		img = undefined;
		callback(false);
	};

	img.onload = handleLoad;
	img.onerror = handleError;
}

function resize(w, h, limitW, limitH) {
	const aspectRatio = w / h;
	if (h > limitH) {
		w = limitH * aspectRatio;
		h = limitH;
	}
	if (w > limitW) {
		w = limitW;
		h = limitW / aspectRatio;
	}
	return [w, h];
}
