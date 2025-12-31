/*
 * В этом файле переопределяем модули в рантайме, используя приватное API загрузчика (loader.js)
 * */
(function (window) {
	var Sizzle = false;
	var isSupportQsaScope = false;
	
	// Test for :scope selector
	try {
		isSupportQsaScope = !!document.querySelector(":scope");
	} catch (e) { }
	
	// Отключаем Sizzle, если браузер умеет в современные селекторы
	if (isSupportQsaScope)
		__define.push(["vendor/sizzle", [], {Sizzle, isSupportQsaScope}]);
})(window);
