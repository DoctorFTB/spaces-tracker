import module from "module";
import {debounce} from "../utils";
import * as sidebar from '../widgets/swiper';

function initRangeInput(widget) {
	const input = widget.querySelector('.js-form-range-input');
	const progress = widget.querySelector('.js-form-range-progress');
	const valueLabel = widget.querySelector('.js-form-range-value');
	const unlockSidebar = debounce(() => sidebar.lock(false), 300);
	const onInput = () => {
		const min = +input.min || 0;
		const max = +input.max || 100;
		const val = +input.value;
		const percent = ((val - min) / (max - min)) * 100;
		progress.style.width = `${percent}%`;
		if (valueLabel)
			valueLabel.textContent = `${Math.round(percent)}%`;
		sidebar.lock(true);
		unlockSidebar();
	};
	input.addEventListener("input", onInput, false);
	onInput();
}

module.on("componentpage", () => {
	const widgets = document.querySelectorAll(".js-form-range");
	for (const widget of widgets) {
		initRangeInput(widget);
	}
});
