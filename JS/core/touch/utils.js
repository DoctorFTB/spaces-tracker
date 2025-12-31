export function getElementRect(el, relative) {
	let box = el.getBoundingClientRect();
	if (relative) {
		return {
			x: box.left,
			y: box.top,
			w: box.right - box.left,
			h: box.bottom - box.top,
		};
	} else {
		return {
			x: box.left + document.documentElement.scrollLeft,
			y: box.top + document.documentElement.scrollTop,
			w: box.right - box.left,
			h: box.bottom - box.top,
		};
	}
}

export function getBoxesIntersection(box1, box2) {
	let intersection_x = Math.max(box1.x, box2.x);
	let intersection_y = Math.max(box1.y, box2.y);
	let intersection_width = Math.min(box1.x + box1.w, box2.x + box2.w) - intersection_x;
	let intersection_height = Math.min(box1.y + box1.h, box2.y + box2.h) - intersection_y;
	
	if (intersection_width <= 0 || intersection_height <= 0)
		return 0;
	
	return ((intersection_width * intersection_height) / Math.min(box1.w * box1.h, box2.w * box2.h));
}
