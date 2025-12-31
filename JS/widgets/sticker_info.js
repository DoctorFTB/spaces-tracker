import "Common/Popover.css";
import module from "module";
import { createPopper } from '@popperjs/core/lib/popper-lite';
import flip from '@popperjs/core/lib/modifiers/flip';
import preventOverflow from '@popperjs/core/lib/modifiers/preventOverflow';
import arrow from '@popperjs/core/lib/modifiers/arrow';
import { debounce } from 'throttle-debounce';
import { L } from "../utils";

let closePrevPopper;

function initStickerPopover(el) {
	let popperInstance;
	let popperBlock;

	const onBodyClick = (e) => {
		if (popperBlock && !popperBlock.contains(e.target) && e.target !== popperBlock)
			hidePopper();
	};

	const hidePopper = () => {
		if (popperInstance) {
			popperBlock.classList.remove("popover--visible");
			popperBlock.addEventListener("transitionend", (e) => e.currentTarget.remove(), false);
			popperInstance.destroy();
			popperInstance = undefined;
			popperBlock = undefined;
			closePrevPopper = undefined;
			autoHide.cancel({ upcomingOnly: true });
			document.body.removeEventListener("click", onBodyClick, false);
		}
	};
	const autoHide = debounce(5000, hidePopper);

	el.addEventListener("click", (e) => {
		e.preventDefault();
		e.stopPropagation();

		if (popperInstance) {
			hidePopper();
			return;
		}

		if (closePrevPopper)
			closePrevPopper();

		autoHide();

		closePrevPopper = () => {
			closePrevPopper = undefined;
			hidePopper();
		};

		document.body.addEventListener("click", onBodyClick, false);

		popperBlock = document.createElement("div");
		popperBlock.className = "popover popover--visible t_center";
		popperBlock.setAttribute("data-popper-placement", "top");
		popperBlock.innerHTML = `
			<div class="text-list">
				<div class="text-list__item">
					<span class="ico_xlarge ico_xlarge_magic"></span>
				</div>
				<div class="text-list__item">
					${L("Этот стикер создал {0}!", el.dataset.userName)}
				</div>
				<div class="text-list__item">
					${L("Хочешь такой же?")}
				</div>
				<div class="text-list__item">
					<a href="${el.dataset.genUrl}" class="link-blue">
						${L("Сгенерируй свой прямо сейчас!")}
					</a>
				</div>
			</div>
			<div data-popper-arrow class="popover__arrow"></div>
		`;

		popperBlock.addEventListener("mouseover", () => autoHide.cancel({ upcomingOnly: true }), false);
		popperBlock.addEventListener("mouseout", () => autoHide(), false);
		document.body.appendChild(popperBlock);

		popperInstance = createPopper(e.currentTarget, popperBlock, {
			modifiers: [
				flip, preventOverflow, arrow,
				{
					name: 'offset',
					options: {
						offset: [0, 30],
					},
				},
				{
					name: 'preventOverflow',
					options: {
						padding: 30,
					},
				},
			],
			placement: "top",
		});
	});
}

module.on("component", () => {
	const elements = document.querySelectorAll(".js-sticker_info");
	for (const el of elements) {
		el.classList.remove("js-sticker_info");
		initStickerPopover(el);
	}
});

module.on("componentpagedone", () => {
	if (closePrevPopper)
		closePrevPopper();
});
