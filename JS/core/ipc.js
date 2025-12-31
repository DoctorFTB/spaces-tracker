import {Spaces} from '../spacesLib';
import {Class} from '../class';
import cookie from '../cookie';

// Класс для действий, которые могут быть только на одной вкладке
var IPCSingleton = Class({
	Static: {
		instances: {},
		instance: function (id) {
			var self = this;
			if (!self.instances[id])
				self.instances[id] = new IPCSingleton(id);
			return self.instances[id];
		}
	},
	Constructor: function (id) {
		var self = this;
		self.id = id;
	},
	start: function (callback, sub_id) {
		var self = this,
			has_local_storage = Spaces.LocalStorage.support(),
			has_cookies = cookie.enabled();

		if (self.sub_id == sub_id)
			return;

		if (self.ipc_interval) {
			self.callback && self.callback(self.sub_id);
			self.stop();
		}
		
		self.sub_id = sub_id;
		self.callback = callback;
		
		var pid = "" + Date.now(), key, alive_key;
		if (has_local_storage) {
			key = "ipc:singleton:" +self.id;
			alive_key = "ipc:singleton:" +self.id + ":alive";
			Spaces.LocalStorage.set(key, pid);
		} else if (has_cookies) {
			key = '_' + self.id;
			cookie.set(key, pid);
		} else {
			// Нет кук и LS, работа невозможна
			return;
		}
		
		self.ipc_interval = setInterval(function () {
			var do_stop = false;
			if (has_local_storage) {
				if (Spaces.LocalStorage.get(alive_key) != pid)
					Spaces.LocalStorage.set(alive_key, pid);
				if (Spaces.LocalStorage.get(key) != pid)
					do_stop = true;
			} else {
				if (cookie.get(key) != pid)
					do_stop = true;
			}
			if (do_stop) {
				self.callback && self.callback(self.sub_id);
				self.stop(sub_id);
			}
		}, 1000);
	},
	stop: function (sub_id) {
		var self = this;
		if (self.ipc_interval && (!sub_id || self.sub_id == sub_id)) {
			clearInterval(self.ipc_interval);
			self.sub_id = self.callback = self.ipc_interval = null;
		}
	}
});

export {IPCSingleton};
