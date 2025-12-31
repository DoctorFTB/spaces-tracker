import Device from '../device';

const can_passive_events = Device.can('passiveEvents');

function addEvent(el, event, callback, passive) {
	let options = can_passive_events ? {passive: passive || false} : false;
	el.addEventListener(event, callback, options);
}

function removeEvent(el, event, callback, passive) {
	let options = can_passive_events ? {passive: passive || false} : false;
	el.removeEventListener(event, callback, options);
}

export {addEvent, removeEvent};
