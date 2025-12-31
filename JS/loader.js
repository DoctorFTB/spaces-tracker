/*
Modules Loader (Touch / PC)

Используемые глобальные переменные:
BASE_URL				|	Базовый URL для JS
CSS_URL					|	Базовый URL для CSS (тёмная или светлая тема, когда CSS_THEME=false)
LIGHT_CSS_URL			|	Базовый URL для CSS (светлая тема)
DARK_CSS_URL			|	Базовый URL для CSS (тёмная тема)
MAIN_REVISION			|	Базовая ревизия
DARK_PREFIX				|	Префикс CSS для тёмной темы
INITIAL_THEME			|	Начальная тема: light|dark|both|false
__require				|	Загрузка модулей: __require.push(['module1', 'module1'], callback, errback)
__components			|	Загрузка компонентов: __components.push('component-name')
__define				|	Объявление модулей: __define.push('module1', ['dep1', 'dep2'], function (dep1, dep2) { })
__require_loaded		|	Список статики, которая загружается из <head>
__require_config		|	Конфиг загрузчика
*/
(function (window, document, JS_URL, CSS_URL, LIGHT_CSS_URL, DARK_CSS_URL, CSS_THEME, MAIN_REVISION) {
	"use strict";
	
	const LOADER_DEBUG = false;
	const DEFAULT_SORT = 0xFFFF;
	
	let modules_cache = {};
	let modules_loading = {};
		
	let require_queue = [];
	let require_queue_task;
		
	let require_defer = {};
	let require_defer_id = 0;
		
	let define_defer = {};
	let payload_loaded = {};
	
	let components_required = {};
	let components_queue = [];
	let components_queue_task;
	
	let module_to_chunk = {};
	let module_to_preload = {};
	let module_to_revision = {};
	let module_to_sort = {};
	
	let scripts_loaded = {};
	let head_ref;
	
	let css_load_hook;
	
	let page_components = {};
	
	function getModule(name) {
		return (modules_cache[name] = {
			id:			name,
			loaded:		false,
			exports:	{},
			meta:		{},
			on
		});
	}
	
	function on(name, callback) {
		this["on" + name] = callback;
	}
	
	/*
		Require components
	*/
	function requireComponentsTask() {
		let name = components_queue.shift();
		if (components_queue.length) {
			tick(requireComponentsTask);
		} else {
			components_queue_task = false;
		}
		
		requireComponentAsync(name);
	}
	
	function requireComponentAsync(name) {
		delete components_required[name];
		
		let module = modules_cache[name];
		if (module.oncomponentpage && !page_components[name]) {
			page_components[name] = true;
			module.oncomponentpage();
			
			if (module.oncomponent)
				tick(() => module.oncomponent());
		} else if (module.oncomponent) {
			page_components[name] = true;
			module.oncomponent();
		}
	}
	
	function requireComponent(name) {
		if (!components_required[name]) {
			if (modules_cache[name]) {
				components_queue.push(name);
				
				if (!components_queue_task)
					components_queue_task = tick(requireComponentsTask);
			} else {
				require([name], () => requireComponentAsync(name));
			}
			components_required[name] = true;
		}
	}
	
	function onPageDone(callback) {
		let counter = 0;
		let finalizer = (module) => {
			counter++;
			
			tick(() => {
				counter--;
				if (!counter) {
					tick(() => {
						page_components = {};
						callback();
					});
				}
				module.oncomponentpagedone()
			});
		};
		
		for (let k in page_components) {
			let module = modules_cache[k];
			if (module && module.oncomponentpagedone)
				finalizer(module);
		}
		
		if (!counter) {
			tick(() => {
				page_components = {};
				callback();
			});
		}
	}
	
	/*
		Require modules
	*/
	function require(names, callback, errback, context) {
		if (typeof names == "string")
			names = [names];
		
		require_queue.push([names, callback, errback, context]);
		if (!require_queue_task)
			require_queue_task = tick(requrieTask);
	}
	
	function requrieTask() {
		let argv = require_queue.shift();
		if (require_queue.length) {
			tick(requrieTask);
		} else {
			require_queue_task = false;
		}
		
		requireAsync.apply(null, argv);
	}
	
	function requireFast(name, callback) {
		if (modules_cache[name]) {
			callback && callback(modules_cache[name].exports);
		} else {
			require([name], callback);
		}
	}
	
	function requireFromCache(name, callback) {
		if (modules_cache[name]) {
			callback && callback(modules_cache[name].exports);
			return modules_cache[name].exports;
		}
		return null;
	}
	
	function requireAsync(names, callback, errback, context) {
		let parent_module = context && context.parent && (modules_cache[context.parent] || getModule(context.parent));
		let imports = [];
		let not_loaded = 0;
		
		// Встроенные модули
		let builtin = {
			// Возвращает текущий модуль
			module:		parent_module && {default: parent_module},
			// Возвращает экспорты текущего модуля
			exports:	parent_module && parent_module.exports,
			// Возвращает require()
			require:	require,
			// Возвращает некоторые полезные встроенные функции в качестве модуля "loader"
			loader:		{executeScripts, loadScript, tick, clearTick, domReady, windowReady, loadPageStyles, onPageDone, setCssTheme, setCassLoadHook}
		};
		
		for (let i = 0, l = names.length; i < l; i++) {
			let name = names[i];
			if (builtin[name]) {
				callback && imports.push(builtin[name]);
			} else if (name[0] == ">") {
				imports.push({default: window[name.substr(1)]});
			} else {
				let module = modules_cache[name] || getModule(name);
				if (!module.loaded) {
					not_loaded++;
					
					if (LOADER_DEBUG) {
						if (parent_module) {
							console.log('[require] ' + name + ' (from ' + parent_module.id + ')');
						} else {
							console.log('[require] ' + name);
						}
					}
					
					if (!modules_loading[name]) {
						modules_loading[name] = [];
						
						if (!define_defer[name] && name.indexOf('.css') > 0) {
							loadModuleAsset(name);
							define_defer[name] = [name, [], {}];
						}
						
						if (define_defer[name]) {
							define.apply(null, define_defer[name]);
							delete define_defer[name];
						} else {
							loadModuleAsset(name);
						}
						
						if (module_to_preload[name]) {
							require(module_to_preload[name]);
							delete module_to_preload[name];
						}
					}
					
					if (callback || errback || context)
						modules_loading[name].push(require_defer_id);
				}
				
				callback && imports.push(module.exports);
			}
		}
		
		if (not_loaded) {
			if (callback || errback || context) {
				require_defer[require_defer_id++] = [
					[names, callback, errback, context],
					not_loaded
				];
			}
		} else {
			callback && callback.apply(null, imports);
		}
	}
	
	/*
		Define modules
	*/
	function define(name, dep_names, callback) {
		payload_loaded[name] = true;
		
		if (modules_loading[name]) {
			let initializer = function () {
				defineAsync(name, Array.prototype.slice.call(arguments, 0), callback);
			};
			if (dep_names && dep_names.length) {
				require(dep_names, initializer, false, {parent: name});
			} else {
				tick(initializer);
			}
		} else {
			define_defer[name] = [name, dep_names, callback];
		}
	}
	
	function defineAsync(name, imports, callback) {
		let module = modules_cache[name] || getModule(name);
		if (!module.loaded) {
			module.meta.url = getModuleUrl(BASE_URL, name, false);
			
			let result = typeof callback == 'function' ? callback.apply(module.exports, imports) : callback;
			if (result !== undefined)
				module.exports = result;
			
			module.loaded = true;
			
			let requires = modules_loading[name];
			while (requires.length) {
				let require_request_id = requires.pop(),
					require_request = require_defer[require_request_id];
				if (require_request) {
					require_request[1]--;
					
					if (!require_request[1]) {
						require.apply(null, require_request[0]);
						delete require_defer[require_request_id];
					}
				}
			}
			
			delete modules_loading[name];
		}
	}
	
	function getHead() {
		head_ref = head_ref || document.head || document.getElementsByTagName('head')[0];
		return head_ref;
	}
	
	function getModuleUrl(base_url, name, with_revision) {
		let revision = with_revision ? 
			'?' + MAIN_REVISION + (module_to_revision[name] || Date.now()) : 
			'';
		
		if (name.indexOf('.css') > 0) {
			return base_url + '/' + name + revision;
		} else {
			return base_url + '/' + name + '.js' + revision;
		}
	}
	
	function loadModuleAsset(name) {
		if (LOADER_DEBUG) {
			if (module_to_chunk[name])
				console.log('[chunks] load ' + name + ' from ' + module_to_chunk[name]);
		}
		
		name = module_to_chunk[name] || name;
		
		if (scripts_loaded[name])
			return;
		
		scripts_loaded[name] = 1;
		
		if (name.indexOf('.css') > 0) {
			let asset_url = getModuleUrl(LIGHT_CSS_URL, name, true);
			let dark_asset_url = getModuleUrl(DARK_CSS_URL, name, true);
			
			let theme2url = {
				light:	asset_url,
				dark:	dark_asset_url
			};
			
			if (CSS_THEME == 'both') {
				// Загружаем CSS сразу для всех тем
				for (let theme in theme2url) {
					let style = loadStyle(theme2url[theme], module_to_sort[name]);
					style.setAttribute('data-theme', theme);
					css_load_hook && css_load_hook(CSS_THEME, style);
				}
			} else {
				// Загружаем CSS только для конкретной темы
				let style = loadStyle(theme2url[CSS_THEME], module_to_sort[name]);
				style.setAttribute('data-href', asset_url + "|" + dark_asset_url);
				css_load_hook && css_load_hook(CSS_THEME, style);
			}
		} else {
			let asset_url = getModuleUrl(BASE_URL, name, true);
			loadScript(asset_url);
		}
	}
	
	// Загрузчик скриптов
	function loadScript(src, callback, errback, old_script) {
		let script = document.createElement('script');
		script.src = src;
		script.type = "text/javascript";
		script.async = true;
		
		if (callback) {
			script.onload = () => {
				if (script.onload) {
					script.onerror = script.onload = script.onreadystatechange = null;
					callback && callback(script);
				}
			};
			script.onreadystatechange = () => {
				if (/^(complete|loaded)$/.test(script.readyState))
					script.onload && script.onload();
			};
		}
		
		if (errback) {
			script.onerror = (e) => {
				if (script.onerror) {
					script.onerror = script.onload = script.onreadystatechange = null;
					errback && errback(e);
				}
			};
		}
		
		if (old_script && old_script.parentNode) {
			old_script.parentNode.insertBefore(script, old_script);
			old_script.parentNode.removeChild(old_script);
		} else {
			getHead().appendChild(script);
		}
		
		return script;
	}
	
	// Загрузка списка стилей с ревизиями
	function loadPageStyles(styles) {
		let styles_to_require = [];
		for (let i = 0, l = styles.length; i < l; i++) {
			let style = styles[i];
			module_to_revision[style.file] = style.r;
			module_to_sort[style.file] = style.sort;
			styles_to_require.push(style.file);
		}
		require(styles_to_require);
	}
	
	function findPrevStyle(head, sort) {
		let links = head.getElementsByTagName('link');
		let prev_link;
		if (sort == DEFAULT_SORT) {
			prev_link = links[links.length - 1];
		} else {
			for (let i = 0, l = links.length; i < l; i++) {
				let link = links[i];
				let link_sort = dataAttr(link, 'sort') || DEFAULT_SORT;
				if (link_sort > sort)
					break;
				prev_link = link;
			}
		}
		return prev_link && prev_link.nextSibling;
	}
	
	// Установка темы CSS
	function setCssTheme(theme) {
		CSS_THEME = theme;
	}
	
	// Установка функции, которая вызывается для каждого загружаемого CSS
	function setCassLoadHook(callback) {
		css_load_hook = callback;
	}
	
	// Загрузчик стилей
	function loadStyle(href, sort) {
		if (sort == null)
			sort = DEFAULT_SORT;
		
		let head = getHead();
		let links = head.getElementsByTagName('link');
		
		let last_link = findPrevStyle(head, sort);
		
		let link = document.createElement('link');
		link.href = href;
		link.type = "text/css";
		link.rel = "stylesheet";
		link.setAttribute('data-sort', sort);
		
		if (last_link) {
			last_link.parentNode.insertBefore(link, last_link);
		} else {
			head.appendChild(link);
		}
		
		return link;
	}
	
	// Выполнение массива элементов <script>, асинхронно
	function executeScripts(scripts) {
		for (let i = 0, l = scripts.length; i < l; i++) {
			let script = scripts[i];
			if (!script.type || script.type == "text/javascript") {
				if (script.src) {
					let onload = script.getAttribute && script.getAttribute("onload");
					if (onload) {
						loadScript(script.src, () => onload && setTimeout(onload, 0), null, script);
					} else {
						loadScript(script.src, null, null, script);
					}
				} else {
					setTimeout(script.textContent, 0);
				}
			}
		}
	}
	
	function resolveDefer(symbol, callback, new_object, is_array) {
		let queue = window[symbol];
		if (queue && queue.push) {
			if (is_array) {
				while (queue.length) {
					let argv = queue.pop();
					callback(argv[0], argv[1], argv[2], argv[3]);
				}
			} else {
				while (queue.length)
					callback(queue.pop());
			}
		}
		window[symbol] = new_object;
	}
	
	function isDomReady() {
		let state = document.readyState;
		return state === "complete"  || state === "loaded" || state === "interactive";
	}
	
	function domReady(callback) {
		if (isDomReady()) {
			tick(callback);
		} else {
			document.addEventListener('DOMContentLoaded', () => tick(callback), false);
		}
	}

	function windowReady(callback) {
		if (document.readyState === "complete") {
			setTimeout(callback, 0);
		} else {
			window.addEventListener('load', callback, false);
		}
	}

	function dataAttr(el, name) {
		return el.dataset ? el.dataset[name] : el.getAttribute('data-' + name);
	}
	
	function tick(callback) {
		return setTimeout(callback, 0);
	}
	
	function clearTick(id) {
		return clearTimeout(id);
	}
	
	function useConfig(names, revisions, preloads, chunks, sorts) {
		for (let i = 0, l = revisions.length; i < l; i++)
			module_to_revision[names[i]] = revisions[i];
		
		for (let i = 0, l = preloads.length; i < l; i++) {
			let preload = preloads[i];
			let preload_list = [];
			for (let j = 0, lj = preload[1].length; j < lj; j++)
				preload_list.push(names[preload[1][j]]);
			module_to_preload[names[preload[0]]] = preload_list;
		}
		
		for (let i = 0, l = chunks.length; i < l; i++) {
			let chunk = chunks[i];
			module_to_revision[chunk[0]] = chunk[2];
			module_to_sort[chunk[0]] = chunk[3];
			for (let j = 0, lj = chunk[1].length; j < lj; j++)
				module_to_chunk[names[chunk[1][j]]] = chunk[0];
		}
		
		for (let i = 0, l = sorts.length; i < l; i += 2) {
			let id = names[sorts[i]];
			let sort = sorts[i + 1];
			module_to_sort[id] = sort;
		}
	}
	
	function init() {
		require.default = require;
		
		// Загрузка компонентов
		require.component = requireComponent;
		
		// Загрузка ранеее загруженных модулей
		require.loaded = requireFromCache;
		
		// Быстрая загрузка одного конкретного модуля
		require.fast = requireFast;
		
		// Кэш
		require.cache = modules_cache;
		
		// Реализация для import(module).then(...)
		require.I = (module) => {
			return new Promise(function (resolve, reject) {
				require([module], resolve, reject)
			});
		};
		
		// require(modules, callback, errback)
		require.push = (argv) => {
			return require(argv[0], argv[1], argv[2], argv[3]);
		};
		
		domReady(() => {
			let loader_config = window.__require_config;
			if (loader_config) {
				useConfig(loader_config[0], loader_config[1], loader_config[2], loader_config[3], loader_config[4]);
				window.__require_config = false;
			}
			
			let loaded_assets = window.__require_loaded;
			if (loaded_assets) {
				for (let i = 0, l = loaded_assets.length; i < l; i++)
					scripts_loaded[loaded_assets[i]] = 1;
				window.__require_loaded = false;
			}
			
			resolveDefer('__define', define, {
				// define(module, body)
				push(argv) {
					return define(argv[0], argv[1], argv[2]);
				}
			}, true);
			resolveDefer('__require', require, require, true);
			resolveDefer('__components', requireComponent, {push: requireComponent}, false);
		});
	}
	
	init();
})(window, document, BASE_URL, CSS_URL, LIGHT_CSS_URL, DARK_CSS_URL, INITIAL_THEME, MAIN_REVISION);
