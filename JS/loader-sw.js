/*
Modules Loader (Workers)

Используемые глобальные переменные:
BASE_URL				|	Базовый URL для JS
MAIN_REVISION			|	Базовая ревизия
__require				|	Загрузка модулей: __require.push(['module1', 'module1'], callback, errback)
__define				|	Объявление модулей: __define.push('module1', ['dep1', 'dep2'], function (dep1, dep2) { })
__require_loaded		|	Список статики, которая загружается из <head>
__require_config		|	Конфиг загрузчика
*/
(function (window, JS_URL, MAIN_REVISION) {
	"use strict";
	
	const LOADER_DEBUG = false;
	
	let document = window.document;
	
	let modules_cache = {};
	let modules_loading = {};
	
	let define_defer = {};
	let payload_loaded = {};
	
	let module_to_chunk = {};
	let module_to_preload = {};
	let module_to_revision = {};
	
	let scripts_loaded = {};
	let head_ref;
	
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
		Require modules
	*/
	function requireFromCache(name, callback) {
		if (modules_cache[name]) {
			callback && callback(modules_cache[name].exports);
			return modules_cache[name].exports;
		}
		return null;
	}
	
	function require(names, callback, errback, context) {
		if (typeof names == "string")
			names = [names];
		
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
			loader:		{tick, clearTick}
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
					modules_loading[name] = true;
					
					if (define_defer[name]) {
						define.apply(null, define_defer[name]);
						delete define_defer[name];
					} else {
						loadModuleAsset(name);
					}
				}
				
				if (!module.loaded)
					throw new Error(name + ' - not loaded!!!');
				
				callback && imports.push(module.exports);
			}
		}
		
		callback && callback.apply(null, imports);
	}
	
	/*
		Define modules
	*/
	function define(name, dep_names, callback) {
		payload_loaded[name] = true;
		
		if (modules_loading[name]) {
			let initializer = function () {
				moduleInit(name, Array.prototype.slice.call(arguments, 0), callback);
			};
			if (dep_names && dep_names.length) {
				require(dep_names, initializer, false, {parent: name});
			} else {
				initializer();
			}
		} else {
			define_defer[name] = [name, dep_names, callback];
		}
	}
	
	function moduleInit(name, imports, callback) {
		let module = modules_cache[name] || getModule(name);
		if (!module.loaded) {
			module.meta.url = getModuleUrl(name, false);
			
			let result = typeof callback == 'function' ? callback.apply(module.exports, imports) : callback;
			if (result !== undefined)
				module.exports = result;
			
			module.loaded = true;
			
			delete modules_loading[name];
		}
	}
	
	function getHead() {
		head_ref = head_ref || document.head || document.getElementsByTagName('head')[0];
		return head_ref;
	}
	
	function getModuleUrl(name, with_revision) {
		let revision = with_revision ? 
			'?' + MAIN_REVISION + (module_to_revision[name] || Date.now()) : 
			'';
		return JS_URL + '/' + name + '.js' + revision;
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
		
		loadScript(getModuleUrl(name, true));
	}
	
	// Загрузчик скриптов
	function loadScript(src, callback, errback) {
		try {
			importScripts(src);
			callback && callback();
		} catch (e) {
			errback && errback(e);
		}
	}
	
	function tick(callback) {
		return setTimeout(callback, 0);
	}
	
	function clearTick(id) {
		return clearTimeout(id);
	}
	
	function useConfig(names, revisions, preloads, chunks) {
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
			for (let j = 0, lj = chunk[1].length; j < lj; j++)
				module_to_chunk[names[chunk[1][j]]] = chunk[0];
		}
	}
	
	function init() {
		// Конфиг
		let loader_config = window.__require_config;
		if (loader_config) {
			useConfig(loader_config[0], loader_config[1], loader_config[2], loader_config[3]);
			window.__require_config = false;
		}
		
		// Уже загруженные скрипты
		let loaded_assets = window.__require_loaded;
		if (loaded_assets) {
			for (let i = 0, l = loaded_assets.length; i < l; i++)
				scripts_loaded[loaded_assets[i]] = 1;
			window.__require_loaded = false;
		}
		
		require.default = require;
		require.loaded = requireFromCache;
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
		
		window.__require = require;
		
		window.__define = {
			// define(module, body)
			push(argv) {
				return define(argv[0], argv[1], argv[2]);
			}
		};
	}
	
	init();
})(self, BASE_URL, MAIN_REVISION);
