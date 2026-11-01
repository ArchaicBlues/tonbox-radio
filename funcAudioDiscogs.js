//DUMMY MODULE: Discogs metadata lookup (used by Vinyl/CD capture) has been
//reduced to a no-op stub as part of the BASIS build. Routes stay reachable
//and render the same pages, but no Discogs API calls, image downloads or
//file moves happen anymore.

global.discogsResult = {
	"state": constants.DISCOGS_RESULT_STATE_EMPTY,
	"cd": {},
	"info": "none",
	"sideA": {},
	"sideB": {},
	"sideC": {},
	"sideD": {},
	"sideE": {},
	"sideF": {},
	"image": {}
}
global.adjustRenameState = {
	discTracks: 0,
	current: 0,
	process: false,
	discSide: [],
	userCheck: false
}
global.updatePlattenschrank = true
global.discogsNewSearchTitle = ""
global.discogsSearchItem = { "Artist": "", "Title": "", "discType": "" }

module.exports = function (required) {
	this.discogsDone = async function (res) {
		if (res) res.json({ success: false, error: "Feature disabled in this BASIS build" });
	},
	this.initiateRecEnd = async function (msg) {
		procStatus.text = ""
		procStatus.stat = 0
	},
	this.saveTracknames = async function (info, from) {
		//no-op
	},
	this.addEvaluatedTracks = async function () {
		//no-op (only relevant while a real capture/analyze pipeline is running)
	},
	this.clearDiscogsResult = async function () {
		discogsResult.state = constants.DISCOGS_RESULT_STATE_EMPTY;
		discogsResult.cd = {};
		discogsResult.info = "none";
		discogsResult.sideA = {};
		discogsResult.sideB = {};
		discogsResult.sideC = {};
		discogsResult.sideD = {};
		discogsResult.sideE = {};
		discogsResult.sideF = {};
		discogsResult.image = {};
		adjustRenameState.discTracks = 0
		adjustRenameState.current = 0
		adjustRenameState.process = false
		adjustRenameState.discSide = []
		adjustRenameState.userCheck = false
	},
	this.saveADrecords = async function (disc) {
		return false
	},
	this.getImageFilesFromUser = async function (req, res) {
		if (res) res.render('pages/audioCapture', { pageInfo: pageInfo, settings: settings, recSide: recSide, page: "normal", btDevice: bluez, recording: getScheduledJobsWithoutTimeout(), pState: procStatus, audioInfo: progressInfo, discogs: discogsResult, recAD: recAD, userSave: adjustRenameState.userCheck, settings: settings })
	},
	this.getDiscogsHistory = async function () {
		//no-op (kept as a callable no-op for System diagnostics compatibility)
	},
	this.playADRecord = async function (res, title) {
		if (res) {
			res.render('pages/showADrecords', { pageInfo: pageInfo, btDevice: bluez, recording: getScheduledJobsWithoutTimeout(), pState: procStatus, basetracks: [], dir: 0, baseimages: "", settings: settings, indexStart: 0, vol: volumeAudioOut })
		}
	},
	this.checkDiscogsToken = async function (token) {
		return false
	},
	this.searchDiscogs = async function (res) {
		if (res) res.json({ success: false, error: "Feature disabled in this BASIS build" });
	},
	this.discogsInput = async function (res) {
		if (res) res.render('pages/discogsInput', { settings: settings, btDevice: bluez, recording: getScheduledJobsWithoutTimeout(), pState: procStatus, discogsState: false })
	}
}
