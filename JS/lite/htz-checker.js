import cookie from './cookie';
import { Spaces } from './core';
import { TRANSPARENT_PIXEL } from './utils';

const TIMEOUT = 5000;

hetznerChecker();

function hetznerChecker() {
	const htzChecks = SPACES_PARAMS.hetznerCheckURL;

	if (cookie.get("Htzct"))
		return;

	let checkQueueCount = 0;
	let stat = [];
	const checkServer = (url, serverName, checkDataBit) => {
		checkQueueCount++;
		checkUrl(url + '?' + Date.now(), (success) => {
			setCookie(success, serverName, checkDataBit);
			checkQueueCount--;

			stat.push([serverName, success]);

			if (checkQueueCount == 0) {
				setTimeout(hetznerChecker, 60 * 1000);
				Spaces.api("files.servers.stat", {
					seRver: stat.map(row => row[0]),
					AvAilable: stat.map(row => row[1])
				});
				stat = [];
			}
		});
	};

	let mask = 0;
	for (const checkType in htzChecks) {
		const checkData = htzChecks[checkType];

		if (checkData.force || checkData.inherits || checkData.off)
			continue;

		if (checkData.nums) {
			for (const serverIndex in checkData.nums) {
				const serverNum = checkData.nums[serverIndex].toString();
				const serverName = checkType + (serverNum.length < 2 ? '0' : '') + serverNum;

				if (! checkData.nums32k?.includes(serverNum))
					continue;

				let checkDataUrl = checkData.nums32k?.includes(serverNum) ? checkData.url32k : checkData.url;
				checkDataUrl = checkDataUrl.replace(checkType + '%02d', serverName);

				let checkDataBit = checkData.bit;
				checkDataBit = +checkDataBit.replace('%d', serverNum);

				mask |= 1 << checkDataBit;
				checkServer(checkDataUrl, serverName, checkDataBit);
			}
		} else {
			mask |= 1 << +checkData.bit;
			checkServer(checkData.url, checkType, +checkData.bit);
		}
	}

	const flags = Number(cookie.get("Htzna1") || 0);
	if (flags != (flags & mask)) {
		console.log("Cleaning old bits, mask=" + mask + ", flags=" + flags);
		cookie.set("Htzna1", flags & mask, { expires: 3600 });
	}

	cookie.set("Htzct", 1, { expires: 15 * 60 });
}

function setCookie(success, serverName, checkDataBit) {
	let flags = Number(cookie.get("Htzna1") || 0);
	if (success) {
		flags &= ~(1 << checkDataBit);
		console.log(`hetzner ${serverName} (#${checkDataBit}) is available`);
	} else {
		flags |= (1 << checkDataBit);
		console.log(`hetzner ${serverName} (#${checkDataBit}) is NOT available`);
	}
	cookie.set("Htzna1", flags, { expires: 3600 });
}

function checkUrl(url, callback) {
	const check = new Image();
	check.src = url;
	check.style.cssText = 'position:fixed;top:-1px;left:-1px';
	check.width = 1;
	check.height = 1;

	const timeout = setTimeout(() => {
		check.src = TRANSPARENT_PIXEL;
		onCheckDone(false);
	}, TIMEOUT);

	const onCheckDone = (success) => {
		callback(success);
		check.parentNode.removeChild(check);
		check.onload = check.onerror = null;
		clearTimeout(timeout);
	};

	check.onload = () => onCheckDone(true);
	check.onerror = () => onCheckDone(false);
	document.body.appendChild(check);
}
