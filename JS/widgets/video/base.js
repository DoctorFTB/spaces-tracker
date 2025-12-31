/*
Базовый класс всех адаптеров

События, которые нужнор имплементнуть для каждого адаптера
- play
- pause
- qualityChange
- fullscreen

Методы, которые нужнор имплементнуть для каждого адаптера
updateSource(resolution, converted, available)
- isPlaying()
- play()
- pause()
- destroy()
- isFullscreen()
- setFullscreen(flag)
*/
class BaseDriver {
	constructor(id, container, options) {
		this.id = id;
		this.options = options;
		this.container = container;
		this.events = {};
	}
	
	getDefaultSource() {
		let { sources } = this.options;
		let selected_source;
		let default_source;
		for (let i = 0, l = sources.length; i < l; i++) {
			let source = sources[i];
			if (source.selected)
				selected_source = i;
			
			if (source.enabled) {
				default_source = i;
				if (selected_source != null && i >= selected_source)
					break;
			}
		}
		
		return default_source;
	}
	
	onStoryboardReady(_totalFramesCount) {
		// stub
	}

	trigger(event, params) {
		return this.events[event] && this.events[event].apply(this, params || []);
	}
	
	on(event, callback) {
		this.events[event] = callback;
		return this;
	}
}

export default BaseDriver;
