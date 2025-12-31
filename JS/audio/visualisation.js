import { getEffectiveTheme, onThemeChange } from "../core/theme";
import { interpolateArray } from "../utils";

const BAR_WIDTH = 2;
const BAR_SPACE = 1;
const BAR_MIN_HEIGHT = 2;
const MAX_WAVEFORM_LENGTH = 500;

const SKINS = {
	RECORDER: {
		light: {
			inactiveColor:	'#D7DBE1',
			activeColor:	'#FFFFFF',
		},
		dark: {
			inactiveColor:	'#b2b2b2',
			activeColor:	'#FFFFFF',
		}
	},
	INCOMING: {
		light: {
			inactiveColor:	'#9ab2cc',
			activeColor:	'#395387',
		},
		dark: {
			inactiveColor:	'#5d5c61',
			activeColor:	'#7cc3ff',
		}
	},
	OUTGOING: {
		light: {
			inactiveColor:	'#a0cc99',
			activeColor:	'#448939',
		},
		dark: {
			inactiveColor:	'#5d5c61',
			activeColor:	'#78da97',
		}
	}
};

export function AudioWaveformWidget(container, options = {}) {
	let canvas;
	let waveform = [];
	let resizedWaveform;
	let waveFormPeak = 0;
	let progress = 1;
	let rafId;
	let waveformLiveMode = false;
	let prevContainerSize;

	options = {
		skin: 'PLAYER',
		...options
	};

	let skin = SKINS[options.skin];

	let unsubscribeThemeChange = onThemeChange(() => requestRender());

	let requestRender = () => {
		if (!rafId)
			rafId = requestAnimationFrame(render);
	};

	let recalculateCanvasSize = () => {
		canvas.width = container.offsetWidth * window.devicePixelRatio;
		canvas.height = container.offsetHeight * window.devicePixelRatio;
		canvas.style.width = container.offsetWidth + 'px';
		canvas.style.height = container.offsetHeight + 'px';
		let ctx = canvas.getContext('2d');
		ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
		resizedWaveform = null;
		prevContainerSize = { width: container.offsetWidth, height: container.offsetWidth };
	};

	let update = () => {
		recalculateCanvasSize();
		requestRender();
	};

	let renderWaveform = (points, maxPoints, peak) => {
		maxPoints = Math.min(maxPoints, points.length);

		if ((prevContainerSize.width != container.offsetWidth || prevContainerSize.height != container.offsetHeight))
			recalculateCanvasSize();

		let x = canvas.offsetWidth - BAR_WIDTH;
		let ctx = canvas.getContext('2d');
		ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
		for (let i = 0; i < maxPoints; i++) {
			let volume = points[points.length - i - 1];
			let barHeight = BAR_MIN_HEIGHT + (peak ? volume / peak : 0) * (canvas.offsetHeight - BAR_MIN_HEIGHT);
			let y = (canvas.offsetHeight - barHeight) / 2;

			ctx.beginPath();
			ctx.fillStyle = ((points.length - i - 1) / points.length >= progress) ?
				skin[getEffectiveTheme()].inactiveColor :
				skin[getEffectiveTheme()].activeColor;
			ctx.rect(x, y, BAR_WIDTH, barHeight);
			ctx.fill();

			x -= BAR_SPACE + BAR_WIDTH;
		}
	};

	let render = () => {
		rafId = null;

		if (canvas.width == 0)
			recalculateCanvasSize();

		let pointsCnt = Math.ceil(canvas.offsetWidth / (BAR_SPACE + BAR_WIDTH));
		if (waveformLiveMode) {
			renderWaveform(waveform, pointsCnt, 255);
		} else {
			if (!resizedWaveform) {
				resizedWaveform = interpolateArray(waveform, pointsCnt);
				waveFormPeak = 0;
				for (let i = 0; i < resizedWaveform.length; i++)
					waveFormPeak = Math.max(waveFormPeak, resizedWaveform[i]);
			}
			renderWaveform(resizedWaveform, pointsCnt, waveFormPeak);
		}
	};

	let report = (volume) => {
		waveform.push(volume);
		if (waveform.length >= MAX_WAVEFORM_LENGTH * 2)
			waveform = waveform.slice(-MAX_WAVEFORM_LENGTH);
		requestRender();
	};

	let setProgress = (newProgress) => {
		progress = newProgress;
		requestRender();
	};

	let setWaveform = (newWaveform, liveMode) => {
		waveform = newWaveform;
		waveformLiveMode = liveMode;
		requestRender();
	};

	let destroy = () => {
		window.removeEventListener('resize', update, false);

		canvas.parentNode.removeChild(canvas);
		canvas = null;

		cancelAnimationFrame(rafId);
		rafId = null;

		resizedWaveform = null;
		waveform = null;

		unsubscribeThemeChange();
	};

	canvas = document.createElement('canvas');
	canvas.width = 0;
	canvas.height = 0;
	container.appendChild(canvas);

	window.addEventListener('resize', update, false);

	return { report, destroy, update, setProgress, setWaveform };
}
