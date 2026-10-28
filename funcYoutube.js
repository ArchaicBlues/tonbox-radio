require('./funcsystem')();

global.ytTitle = []
global.ytUrl = []
global.ytVideoId = []
global.ytFound = 0
global.searchYouTube = ''

module.exports = function (required) {
  this.setYouTubeObj = function () {
    //no-op
  },
  this.checkYoutubeKey = async function (k) {
    return false
  },
  this.cleanFilenameNoPromise = async function (name, data) {
    var txt = ""
    if (name) {
      txt = data.replace(name, "");
    } else txt = data

    txt = txt.replace(/[^a-zA-Z0-9\.\-]/g, "")

    //remove spaces
    txt = txt.replace(/ /g, "")

    //remove (..) and what is in between
    var s = txt.indexOf("("); var e = txt.indexOf(")");
    if (s >= 0 && e > s) { let cut = txt.slice(s, e + 1); txt = txt.replace(cut, "") }

    //remove [..] and what is in between
    s = txt.indexOf("["); e = txt.indexOf("]");
    if (s >= 0 && e > s) { let cut = txt.slice(s, e + 1); txt = txt.replace(cut, "") }

    txt = txt.replace(/:/g, "-")
    txt = txt.replace(/;/g, "")
    txt = txt.replace(/'/g, "")
    txt = txt.replace(/&/g, "_")
    txt = txt.replace(/ß/g, "ss")
    txt = txt.replace(/\*/g, "")
    txt = txt.replace(/^-|-$/g, "") //remove - at beginning and end of filename
    return txt
  },
  this.downloadYTconvertMp3 = async function (url, index, em, save) {
    procStatus.text = "Feature disabled in this BASIS build"
    SSEIntervalTyp = constants.SSE_NONE_CLEAR_INTERVAL
  },
  this.ytSearch = async function (searchStr, res) {
    procStatus.text = "Feature disabled in this BASIS build"
    if (res) res.render('pages/youtubeselect', {
      vol: volumeAudioOut, play: "", settings: settings, searchYouTube: searchYouTube, btDevice: bluez,
      recording: getScheduledJobsWithoutTimeout(), pState: procStatus, yttitle: [], ytVideoId: [],
      ytFound: 0, mediathekSearchItem: ""
    })
  },
  this.downloadYT = async function (url, res, title) {
    procStatus.text = "Feature disabled in this BASIS build"
    if (res) res.render('pages/youtubeselect', {
      vol: volumeAudioOut, play: "", settings: settings, searchYouTube: searchYouTube, btDevice: bluez,
      recording: getScheduledJobsWithoutTimeout(), pState: procStatus, yttitle: ytTitle, ytVideoId: ytVideoId,
      ytFound: ytFound, mediathekSearchItem: ""
    })
  },
  this.removePart = function () {
    //no-op
  },
  this.getDownloadYT = async function () {
    //no-op
  },
  this.set_ytMP4 = function (val) {
    //no-op
  },
  this.initiateYTEnd = async function (msg, media) {
    SSEIntervalTyp = constants.SSE_NONE_CLEAR_INTERVAL
  },
  this.loadYouTubeSearch = async function () {
    //no-op: Mediathek search history is not loaded in this BASIS build
  }
}
