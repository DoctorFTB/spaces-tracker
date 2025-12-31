import videojs from 'video.js';
import { L, numeral } from '../../../../utils';

const TAP_TIMEOUT = 450;

const Component = videojs.getComponent('Component');

videojs.registerPlugin('tapToRewind', function VideoJsTapToRewind() {
	let seekOffset = 0;
	let lastDirection = 0;

	// Фикс бага с 00:00 после перемотки
	this.on("timeupdate", (e) => {
		if (typeof e.target.pendingSeekTime === 'function' && e.target.pendingSeekTime() == null) {
			this.tech(true).trigger("timeupdate");
		}
	});

	this.on('play', () => this.userActive(false));

	this.on('seeked', () => {
		if (!this.paused())
			this.userActive(false);
	});

	this.ready(() => {
		const handleTap = (tapNumber, direction) => {
			if (direction != 0 && tapNumber > 0) {
				if (tapNumber == 0 || direction != lastDirection)
					seekOffset = 0;

				const prevCurrentTime = this.currentTime();
				const shouldDisableSeekWhileScrubbing_ = this.controlBar.progressControl.seekBar.shouldDisableSeekWhileScrubbing_;

				this.controlBar.progressControl.seekBar.shouldDisableSeekWhileScrubbing_ = false;
				if (direction > 0) {
					this.controlBar.progressControl.seekBar.stepForward();
				} else if (direction < 0) {
					this.controlBar.progressControl.seekBar.stepBack();
				}
				seekOffset += Math.round(this.currentTime() - prevCurrentTime);
				this.controlBar.progressControl.seekBar.shouldDisableSeekWhileScrubbing_ = shouldDisableSeekWhileScrubbing_;

				touchOverlay.setRewindSeconds(seekOffset);
				touchOverlay.showNext(direction == 1);
				touchOverlay.showPrev(direction == -1);
			}

			lastDirection = direction;
		};

		const handleTapEnd = () => {
			lastDirection = 0;
			seekOffset = 0;
			touchOverlay.showNext(false);
			touchOverlay.showPrev(false);
		};

		const controlBarIdx = this.children().indexOf(this.getChild('ControlBar'));
		const touchOverlay = this.addChild('TouchOverlay', {
			onTap: handleTap,
			onTapEnd: handleTapEnd,
		}, controlBarIdx);
	});
});


class TouchOverlay extends Component {
	constructor(player, options) {
		super(player, options);

		let tapNumber = 0;
		let direction = 0;

		const resetTaps = videojs.fn.debounce(() => {
			options.onTapEnd();
			tapNumber = 0;
		}, TAP_TIMEOUT);

		this.on('touchend', (e) => {
			if (e.target && e.target.closest('.vjs-control'))
				return;
			resetTaps();

			const rect = this.el().getBoundingClientRect();
			const x = e.changedTouches[0].clientX - rect.left;

			if (x < rect.width * 0.4) {
				direction = -1;
			} else if (x > rect.width - (rect.width * 0.4)) {
				direction = 1;
			} else {
				direction = 0;
			}

			options.onTap(tapNumber, direction);

			tapNumber++;
		});
	}

	showNext(flag) {
		this.nextButton.style.opacity = flag ? 1 : 0;
	}

	showPrev(flag) {
		this.prevButton.style.opacity = flag ? 1 : 0;
	}

	setRewindSeconds(count) {
		const text = numeral(Math.abs(count), [L('$n секунда'), L('$n секунды'), L('$n секунд')]);
		this.prevButton.setAttribute('data-text', text);
		this.nextButton.setAttribute('data-text', text);
	}

	createEl() {
		const el = videojs.dom.createEl('div', {
			className: 'vjs-touch-overlay',
			tabIndex: -1
		});

		this.nextButton = videojs.dom.createEl('div', {
			className: 'vjs-touch-overlay__next',
		});

		this.prevButton = videojs.dom.createEl('div', {
			className: 'vjs-touch-overlay__prev',
		});

		el.appendChild(this.nextButton);
		el.appendChild(this.prevButton);

		return el;
	}
};

videojs.registerComponent('TouchOverlay', TouchOverlay);
