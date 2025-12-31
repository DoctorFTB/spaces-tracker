import { debounce } from "./utils";

const removeAllGuards = debounce(() => {
	document.querySelectorAll('.js-preview_guard').forEach((el) => el.remove());
}, 300);

const addGuard = (target) => {
	if (target.tagName == 'IMG' && (target.classList.contains("preview") || target.classList.contains("gallery__image"))) {
		if (!target.querySelector('.js-preview_guard')) {
			const guard = document.createElement("div");
			guard.className = 'js-preview_guard';
			guard.style.cssText = "display: block; position: absolute; top: 0; bottom: 0; left: 0; right: 0; z-index: 1000;";
			target.parentNode.insertBefore(guard, target);
		}
		removeAllGuards();
	}
};

document.addEventListener("mousedown", (e) => {
	if (e.button == 2)
		addGuard(e.target);
});

document.addEventListener("contextmenu", (e) => {
	addGuard(e.target);
});
