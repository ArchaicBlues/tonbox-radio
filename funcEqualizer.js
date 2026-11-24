const { exec, spawn } = require('child_process');
const fsPromises = require('fs/promises');
const fs = require ('fs');;
global.fnames = ""
global.pwPlay = false
filterGraph = {  
  preamp:"-6.0",
  "graph" : [
    {label:"bq_low_shelf",Fc:"40.0", Q:"0.7",Gain:"6.0"}, //1
    {label:"bq_peaking",Fc:"121.0",Q:"0.7",Gain:"4.0"},
    {label:"bq_peaking",Fc:"547.0",Q:"2.10",Gain:"-7.2"},
    {label:"bq_peaking",Fc:"674.0",Q:"0.72",Gain:"-7.2"},//4
    {label:"bq_peaking",Fc:"818.0",Q:"2.82",Gain:"-4.8"},
    {label:"bq_peaking",Fc:"1503.0",Q:"1.64",Gain:"4.0"},//7
    {label:"bq_peaking",Fc:"1605.0",Q:"4.95",Gain:"0.4"},
    {label:"bq_peaking",Fc:"1722",Q:"2.75",Gain:"2.5"},
    {label:"bq_peaking",Fc:"4160.0",Q:"1.62",Gain:"3.0"},
    {label:"bq_highshelf",Fc:"12000",Q:"0.7",Gain:"-3.2"},//10
]}

//https://docs.pipewire.org/page_module_filter_chain.html


function spawnAsync(cmd, args = []) {
  console.log(cmd+" "+ args)
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: "inherit" });

    child.on("error", reject);

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Process exited with code ${code}`));
      }
    });
  });
}



module.exports = async function(required){
  this.findEqualizerSinkLine = async function(){
    //War bisher eine Suche nach "Equalizer Tonbox Sink" (node.description/media.name aus
    //tonboxFilter.conf) - "wpctl status" zeigt Knoten aber unter ihrem node.name ("eq10",
    //siehe capture.props in tonboxFilter.conf), NICHT unter node.description/media.name.
    //Dieser Text kommt in "wpctl status" also NIE vor - der Filter-Chain-Sink hat dadurch
    //immer als "nicht gefunden" gegolten, obwohl er (Filters-Sektion in wpctl status)
    //tatsaechlich laeuft; wpctl set-default wurde deshalb nie auf ihn aufgerufen, Audio
    //blieb am eigentlichen Default-Sink vorbei am Equalizer.
    //
    //Live auf zwei Geraeten mit unterschiedlicher PipeWire-Version gegengeprueft: 1.4.2
    //zeigt den Knoten unter node.name ("eq10"), 1.2.7 zeigt ihn stattdessen unter
    //node.description/media.name ("Equalizer Tonbox Sink") - je nach Version kommt NUR
    //einer der beiden Texte in "wpctl status" vor. Auf beide gleichzeitig pruefen, nicht
    //nur auf einen, um zwischen PipeWire-Versionen nicht erneut einseitig zu brechen.
    //
    //Kann kurz nach einem PipeWire-Neustart (Reverb-Toggle, Sender-Wechsel - siehe
    //ensureMpvRestarted() in funcRadio.js) voruebergehend fehlen, waehrend die Filter-Kette
    //neu lädt. Kurz retrien statt sofort leer zurückzugeben - ein fehlender Treffer liesse
    //EQ-Befehle sonst stillschweigend ins Leere laufen (siehe modifyFilterOnTheFly()/submitFilter()).
    for (let i=0; i<10; i++){
      let line = await execCmd('wpctl status 2>/dev/null | grep -E "\\. eq10 |Equalizer Tonbox Sink" || true')
      if (line && line.trim()) return line
      await new Promise(r => setTimeout(r, 300))
    }
    console.log("findEqualizerSinkLine: 'eq10' nach 3s nicht gefunden")
    return ""
  },
  this.fixEqualizerTarget = async function(){
    //tonboxFilter.conf/tonbox.txt/tonbox_All.txt haben "node.target" bisher hart auf
    //die Onboard-Audio des urspruenglichen Dev-Geraets kodiert
    //("alsa_output.platform-fe00b840.mailbox.stereo-fallback"). Auf jedem Geraet mit
    //einem DAC-HAT (oder deaktivierter Onboard-Audio, siehe README) heisst dieser
    //PipeWire-Knoten anders (z.B. "platform-soc_sound" beim Allo Boss) - das
    //filter-chain-Modul laedt dann nie, "Equalizer Tonbox Sink" entsteht nie, egal wie
    //oft findEqualizerSinkLine() nachfragt. Ermittelt den tatsaechlich aktiven
    //alsa_output-Knoten per Ausschluss (gleiche Logik wie getAudioOut(): alles außer
    //Headphones/HDMI) und schreibt ihn nur dann in die Config-Dateien, wenn er vom
    //aktuell eingetragenen abweicht - danach PipeWire neu starten, damit es greift.
    try{
      //Kurz nach PipeWire-Start (z.B. direkt bei configureTonbox()) hat WirePlumber die
      //ALSA-Sinks teils noch nicht fertig enumeriert - "pw-cli ls Node" kann dann kurzzeitig
      //noch gar keinen alsa_output-Knoten zeigen, auch wenn die Karte laengst da ist. Wie
      //findEqualizerSinkLine() daher kurz retrien statt beim ersten leeren Versuch aufzugeben.
      var target = null
      for (var attempt=0; attempt<10 && !target; attempt++){
        if (attempt > 0) await new Promise(r => setTimeout(r, 300))
        var out = await execCmd("pw-cli ls Node 2>/dev/null | grep -A3 'alsa_output' || true")
        var lines = out.split("\n")
        var candidates = []
        var current = null
        for (var i=0; i<lines.length; i++){
          var mName = lines[i].match(/node\.name\s*=\s*"([^"]+)"/)
          var mNick = lines[i].match(/node\.nick\s*=\s*"([^"]*)"/)
          if (mName){
            if (current) candidates.push(current)
            current = {name: mName[1], nick: ""}
          }
          if (mNick && current) current.nick = mNick[1]
        }
        if (current) candidates.push(current)
        for (var c of candidates){
          if (!c.nick.match(/headphone|hdmi/i)){
            target = c.name
            break
          }
        }
      }
      if (!target){
        //bisher komplett stillschweigend - ohne das sieht man im Log nicht, ob "pw-cli ls
        //Node" schlicht leer blieb (z.B. pw-cli kann den PipeWire-Socket in dieser
        //Umgebung nicht erreichen) oder ob nur kein passender Kandidat gefunden wurde.
        console.log("fixEqualizerTarget: kein passender alsa_output-Knoten gefunden (pw-cli ls Node lieferte nichts Brauchbares)")
        return
      }
      console.log("fixEqualizerTarget: aktiver Ausgabe-Knoten erkannt: " + target)

      var confDir = "/home/pi/.config/pipewire/pipewire.conf.d"
      var files = ["tonboxFilter.conf", "tonbox.txt", "tonbox_All.txt"]
      var changed = false
      for (var f of files){
        try{
          var filePath = confDir + "/" + f
          var content = await fsPromises.readFile(filePath, "utf8")
          var re = /node\.target\s*=\s*\S+/
          var m = content.match(re)
          if (m && m[0] !== "node.target = " + target && m[0] !== "node.target =  " + target){
            var newContent = content.replace(re, "node.target =  " + target)
            await fsPromises.writeFile(filePath, newContent, "utf8")
            changed = true
            console.log("fixEqualizerTarget: " + f + " node.target -> " + target)
          }
        }catch(err){/* Datei existiert auf diesem Geraet evtl. nicht - ignorieren */}
      }
      if (changed){
        //KEIN automatischer Neustart hier: pipewireAudioInit() (und damit diese Funktion)
        //kann auch waehrend laufender Wiedergabe aufgerufen werden - ein Neustart von
        //pipewire/wireplumber mitten im Stream reisst die Audio-Verbindung ab, ohne dass
        //danach irgendetwas die Wiedergabe neu verbindet ("kein Sound" live beobachtet).
        //Die Config ist jetzt korrigiert, greift aber erst nach einem manuellen Neustart.
        console.log("fixEqualizerTarget: node.target korrigiert - wird erst nach einem Neustart (Reboot) wirksam")
      }
    }catch(err){
      console.log("fixEqualizerTarget: " + err)
    }
  },
  this.setVolumeSettings = async function (value){
    console.log("setVolumeSettings="+value)
    settings.jackVolume = value
    await writeSettings()
  },
  this.getVolume = function (res){
    console.log("getVolume="+settings.jackVolume)
    res.writeHead(200, { 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify(settings.jackVolume), 'utf-8');
  },
  this.submitFilter = async function(filter){
    console.log("submitFilter:(" + filter +")")
    let old = settings.filterIndex;
    if (filter.match("Clear") && settings.filterIndex != "0") settings.filterIndex = "0"; else
    if (filter.match("Neutral") && settings.filterIndex != "1") settings.filterIndex = "1"; else
    if (filter.match("Warm") && settings.filterIndex != "2") settings.filterIndex = "2"; else 
    if (filter.match("Bass") && settings.filterIndex != "3") settings.filterIndex = "3"; else 
    if (filter.match("MyEQ") && settings.filterIndex != "4") settings.filterIndex = "4"; 
    if (old === settings.filterIndex)
      return
    await writeSettings()
    let dat = await loadEqSlider() //repariert eine kaputte Datei gleich mit
    if (dat){
      dat.preset = Number(settings.filterIndex)
      await fsPromises.writeFile("filter/eqSlider.json",JSON.stringify(dat,null,2),"utf8")
    }

    
    try{
      var f = escapeTrack(filter)
      var cmd = "cat filter/" + f + ".txt >&1"
      //console.log(cmd)
      var f = await execCmd(cmd)
      f = f.split("\n"); 
      if (!f[f.length-1])
        f.pop()
      var i=0; var e=""
      for (i in f){
        e = f[i].split(" ")
        if (i==0) filterGraph.preamp = e[1] 
        else {
          filterGraph.graph[i-1].bq_peaking = e[3]
          filterGraph.graph[i-1].Fc = e[5]
          filterGraph.graph[i-1].Q = e[11]
          filterGraph.graph[i-1].Gain = e[8]
        }
      }
      var equObj = await findEqualizerSinkLine()
      console.log(equObj)
      equObj = equObj.split(".")
      var objID = equObj[0].split(" ")
      //console.log("Equalizer objID: "+objID[objID.length-1])
      for (var i=1; i<=10; i++){
        var cmd = 'pw-cli s '+objID[objID.length-1]+' Props \'{params=["eq_band_'+i+':Gain"'+' '+filterGraph.graph[i-1].Gain+']}\''
        //console.log(cmd)
        await execCmd(cmd)
        await new Promise(r => setTimeout(r, 100));
      }
      //save /home/pi/.config/pipewire/pipewire.conf.d/tonboxFilter.conf for next power on
      await buildFilterConf() 

      if (filter.match("Clear")) settings.filterIndex = "0"
      else if (filter.match("Neutral")) settings.filterIndex = "1"
      else if (filter.match("Warm")) settings.filterIndex = "2"
      else if (filter.match("Bass")) settings.filterIndex = "3"
      else if (filter.match("MyEQ")) settings.filterIndex = "4"
      //await writeSettings()
    }
    catch(err){
      console.log(err)
    }
  },
  this.buildFilterConf = async function(){
    try{
      var filterconf = await execCmd("cat /home/pi/.config/pipewire/pipewire.conf.d/tonboxFilter.conf >&1")
      filterconf = filterconf.split("type  = builtin")
      var p = filterconf[0].split("\n")
      var strfilter = filterconf[0]//+"\n"
      //console.log(strfilter)

      //preamp
      var eq = filterconf[1].split("\n")
      eq[0] ="type  = builtin"
      var a = eq[3].indexOf("Gain")
      var b = eq[3].indexOf("}")
      var s = eq[3].slice(a-1,b+1)
      var s1 = "\"Gain\" = " + filterGraph.preamp + " }"
      eq[3] = eq[3].replace(s,s1)
      for (i in eq) {
        if (i == eq.length-1) strfilter += eq[i]
        else strfilter += eq[i]+"\n"
      }

      //eq1..eq10
      for (var n=2; n < filterconf.length; n++){
        eq = filterconf[n].split("\n")
        eq[0] ="type  = builtin"
        a = eq[3].indexOf("Gain")
        b = eq[3].indexOf("}")
        s = eq[3].slice(a-1,b+1)
        s1 = "\"Gain\" = " + filterGraph.graph[n-2].Gain + " }"
        eq[3] = eq[3].replace(s,s1)
        var i = 0
        for (i in eq) {
          if (i == eq.length-1) strfilter += eq[i]
          else strfilter += eq[i]+"\n"
        }
      }      
      await fs.writeFileSync('/home/pi/.config/pipewire/pipewire.conf.d/tonboxFilter.conf', strfilter)
    }
    catch(err){
      console.log(err)
    }    
  },
  this.setReverb = async function(body, res){
    trackIndex-- //see pw-play trackState = "done", (die gleiche Musik nochmal)
    try{
      //let conv = await execCmd("pw-link -l | grep conv >&1")
      let b = JSON.stringify(body)
      b = b.replace("{", ""); b = b.replace("}", "")
      if (b.match("on")){
          if (settings.reverb === "on"){
              console.log("already on")
              res.json({ success: true, reverb: settings.reverb });
              return
          } else {
            console.log("turn reverb on")
            if (!settings.mediaOut.match("HTTP")){
              try{
                await execCmd("pkill -f pw-play");
              }catch(e){}
            }
            await execCmd("bashScript/./conv.sh on")
            settings.reverb = "on"
          }
      }
      else{
          if (settings.reverb === "off"){
              console.log("already off")
              res.json({ success: true, reverb: settings.reverb });
              settings.reverb = "off"
              return
          } else {
            console.log("turn reverb off")
            if (!settings.mediaOut.match("HTTP")){
              try{
                await execCmd("pkill -f pw-play");
              }catch(e){}
            }
            await execCmd("bashScript/./conv.sh off")
            settings.reverb = "off"
          }
      }
      //await stopMusicPlay(constants.AUDIO_ALL)
      await execCmd("systemctl --user restart pipewire")
      res.json({ success: true, reverb: settings.reverb });
      await writeSettings()
    }
    catch(err){
      console.log("reverb:"+err)
      procStatus.text = "reverb:"+err
      if (!res.headersSent) res.json({ success: false, reverb: settings.reverb });
    }
  },
  this.setEqualizerFilter = function (eq){
    //audioWeb.js --> GET /eq --> setEqualizerFilter
    //Slider hat x=0..100, 0..50 soll -9..0 dB und 50..100 soll 0..+9 dB
    e = eq.split("=")
    var n = parseFloat(e[1])
    n = this.sliderValtoGain(n)
    //change filtergraph
    var val = n.toString()
    eqX = e[0].split("/eq")
    filterGraph.graph[eqX[1]-1].Gain = val
    console.log("SliderNum=" + eqX[1] + ", Wert="+val)
    modifyFilterOnTheFly(eqX[1],val)
  },
  this.modifyFilterOnTheFly = async function (sliderNum,gain){
    try{
      // get object id of equalizer
      var equObj = await findEqualizerSinkLine()
      console.log(equObj)
      equObj = equObj.split(".")
      var objID = equObj[0].split(" ")
      //console.log("Equalizer objID: "+objID[objID.length-1])
      //change gain on the fly
      var cmd = 'pw-cli s '+objID[objID.length-1]+' Props \'{params=["eq_band_'+sliderNum+':Gain"'+' '+gain+']}\''
      console.log(cmd)
      await execCmd(cmd)

    }
    catch(err){
      console.log(err)
    }
  },
  this.sliderValtoGain = function(n){
      //-9db..+9dB
      if (n > 50) {
        n = n-50; 
        n = n*9/50
      }else{
        n = n*9/50
        n = -9 + n
      }
      return(n)
  },
  this.gainToSliderVal = function(n){
    let y = 50/9
    y = y.toFixed(2)
    if (n > 0) y = 50 + y * n
    else  y = 50 + (y * n) 
    y = parseInt(y)
    return(y)
  }

  //Die 10 Baender in der Reihenfolge von Filter 1..10 in den filter/*.txt Dateien
  const eqBands = ["f40Hz","f121Hz","f547Hz","f674Hz","f818Hz","f1503Hz","f1605Hz","f1722Hz","f4160Hz","f12000Hz"]
  //Index in den Band-Arrays: [0]=Clear [1]=Neutral [2]=Warm [3]=Bass [4]=MyEQ
  const eqPresetFiles = ["Clear","Neutral","Warm","Bass","MyEQ"]

  this.isValidEqSlider = function(obj){
    if (!obj || typeof obj !== "object") return false
    for (const b of eqBands){
      if (!Array.isArray(obj[b]) || obj[b].length < 5) return false
      if (typeof obj[b][4] !== "number" || isNaN(obj[b][4])) return false
    }
    return true
  },

  //Baut eqSlider.json komplett aus filter/Clear.txt ... filter/MyEQ.txt neu auf.
  //Rueckgabe: das neue Objekt (oder null, wenn eine Preset-Datei fehlt).
  this.rebuildEqSliderFromFilterFiles = async function(){
    const out = {}
    for (const b of eqBands) out[b] = [50,50,50,50,50]
    for (let p = 0; p < eqPresetFiles.length; p++){
      let txt
      try { txt = await fsPromises.readFile("filter/" + eqPresetFiles[p] + ".txt", "utf8") }
      catch(err){ console.log("rebuildEqSliderFromFilterFiles: " + eqPresetFiles[p] + ".txt missing"); return null }
      const lines = txt.split("\n").filter(l => l.trim().length)
      //lines[0] = "Preamp: ...", lines[1..10] = "Filter n: ON PK Fc 40 Hz Gain 9 dB Q 0.7"
      for (let i = 1; i <= eqBands.length && i < lines.length; i++){
        const e = lines[i].split(" ")
        const gain = parseFloat(e[8])
        if (isNaN(gain)) continue
        out[eqBands[i-1]][p] = gainToSliderVal(gain)
      }
    }
    out.preset = Number(settings.filterIndex) || 0
    await fsPromises.writeFile("filter/eqSlider.json", JSON.stringify(out,null,2), "utf8")
    console.log("filter/eqSlider.json rebuilt from filter/*.txt")
    return out
  },

  //Liest filter/eqSlider.json und liefert IMMER ein gueltiges Objekt (inkl. preset).
  //Eine kaputte/leere Datei (z.B. "{}" durch einen frueheren saveFilter-Bug, siehe
  //dort) oder eine Datei ohne "preset" (frueher von audioWeb.js so gespeichert, der
  //Browser lehnt die Antwort dann als "incomplete" ab) wird dabei repariert und
  //zurueckgeschrieben. Rueckgabe null nur, wenn auch der Neuaufbau scheitert.
  this.loadEqSlider = async function(){
    let dat = null
    try {
      dat = JSON.parse(await fsPromises.readFile("filter/eqSlider.json","utf8"))
    } catch(err){
      console.log("loadEqSlider: " + err.message)
    }
    if (!isValidEqSlider(dat)){
      console.log("loadEqSlider: filter/eqSlider.json invalid, rebuilding")
      return await rebuildEqSliderFromFilterFiles()
    }
    if (typeof dat.preset !== "number" || isNaN(dat.preset)){
      dat.preset = Number(settings.filterIndex) || 0
      await fsPromises.writeFile("filter/eqSlider.json", JSON.stringify(dat,null,2), "utf8")
      console.log("loadEqSlider: added missing preset=" + dat.preset)
    }
    return dat
  },

  this.saveFilter = async function (eqData){
    try{
    //settings.filterIndex = "4";
    //await writeSettings()
      //ERST validieren, DANN schreiben. Frueher wurde eqData ungeprueft in die Datei
      //geschrieben - ein "{}" vom Browser (eqSlider dort noch nicht geladen) hat damit
      //eqSlider.json dauerhaft zerstoert und den Equalizer auf allen Seiten lahmgelegt.
      var eqSlider = null
      try { eqSlider = JSON.parse(eqData) }
      catch(err){ console.log("saveFilter: invalid JSON, ignored: " + eqData); return }
      if (!isValidEqSlider(eqSlider)){
        console.log("saveFilter: incomplete eq data, ignored: " + eqData)
        return
      }
      //preset beibehalten, falls der Client keins mitschickt (audioWeb.js hat frueher
      //preset vor dem Speichern geloescht -> Datei galt im Browser als "incomplete")
      if (typeof eqSlider.preset !== "number" || isNaN(eqSlider.preset)){
        let old = null
        try { old = JSON.parse(await fsPromises.readFile("filter/eqSlider.json","utf8")) } catch(err){}
        if (old && typeof old.preset === "number") eqSlider.preset = old.preset
        else eqSlider.preset = Number(settings.filterIndex) || 0
      }
      await fsPromises.writeFile('filter/eqSlider.json', JSON.stringify(eqSlider,null,2), "utf8")
      //Slidereinstellungen in MyEQ.txt übertragen
      var cmd = "cat filter/MyEQ.txt >&1"
      var newF = await execCmd(cmd)
      if (!newF) {
        procStatus.text = "MyEQ.txt not found!"
        console.log(procStatus.text)
        return
      }
      newF = newF.split("\n"); 
      if (!newF[newF.length-1]) 
        newF.pop()
      var ftxt = newF[0]
      var i = 0
      var gain = 0.0;
      for(i in newF){
        if (i != 0){
          ftxt+="\n"
          var filter = newF[i].split(" ")
          switch(i){
            case "1":
            gain = await sliderValtoGain(eqSlider.f40Hz[4])
            break;
            case "2":
            gain = await sliderValtoGain(eqSlider.f121Hz[4])
            break;
            case "3":
            gain = await sliderValtoGain(eqSlider.f547Hz[4])
            break;
            case "4":
            gain = await sliderValtoGain(eqSlider.f674Hz[4])
            break;
            case "5":
            gain = await sliderValtoGain(eqSlider.f818Hz[4])
            break;
            case "6":
            gain = await sliderValtoGain(eqSlider.f1503Hz[4])
            break;
            case "7":
            gain = await sliderValtoGain(eqSlider.f1605Hz[4])
            break;
            case "8":
            gain = await sliderValtoGain(eqSlider.f1722Hz[4])
            break;
            case "9":
            gain = await sliderValtoGain(eqSlider.f4160Hz[4])
            break;
            case "10":
            gain = await sliderValtoGain(eqSlider.f12000Hz[4])
            break;
          } 
          filterGraph.graph[i-1].Gain = gain 
          filter[8]=gain; 
          for (x=0; x<=11; x++) ftxt+=filter[x]+" "
        }
      }
      //console.log(ftxt)
      await fs.writeFileSync("filter/MyEQ.txt", ftxt)
      //eqSlider.json wird mit jeder page die Eq hat geholt, dewegen hier update:
      //await createEqSliderJson()
    }
    catch(err){
      console.log(err)
    }
  },

  this.sliderGain = function(){
    //clone JSON
    var sliderGain = JSON.parse(JSON.stringify(filterGraph))
    for (i in sliderGain.graph) {
      var val = parseFloat(filterGraph.graph[i].Gain)
      val = val * 10.0
      var str = val.toString()
      sliderGain.graph[i].Gain = str
    }
    return sliderGain
  },
  this.pipewireAudioInit = async function(){
    killplayAux()
    if (!settings.mediaOut) return
    if (settings.mediaOut.match("HTTP")) {
      await stopMusicPlay(constants.AUDIO_PW)
      return
    }
    try{
      var eq = "";
      var result = ""

      // //wpctl settings hier für effect_output.eq10 funktioniert nicht
      // d.h. pw-play spielt immer auf HAT-DAC, wenn vorhanden!

      result = await findEqualizerSinkLine()
      if (!result){
        //Sink nicht gefunden - bevor endgueltig aufgegeben wird, pruefen ob node.target
        //auf diesem Geraet schlicht falsch steht (siehe fixEqualizerTarget()) und ggf.
        //einmal reparieren + erneut versuchen. Laeuft bewusst nur im Fehlerfall, nicht
        //bei jedem Aufruf - restart pipewire ist kurz hoerbar unterbrechend.
        await fixEqualizerTarget()
        result = await findEqualizerSinkLine()
      }
      if (result){
        //Wie modifyFilterOnTheFly()/submitFilter(): auf "." splitten (nicht auf die
        //frueher gesuchte, nie vorkommende ". Equalizer Tonbox Sink") und das letzte durch
        //Leerzeichen getrennte Token vor dem ersten Punkt nehmen - das ist die ID-Nummer
        //("      36. eq10 ..." -> "36"), unabhaengig von ihrer Ziffernanzahl.
        result = result.split(".")
        let idParts = result[0].split(" ")
        eq = idParts[idParts.length-1]
      }
      console.log("eq Object ID = "+ eq )//+ ", au ID = " + au + ", au2 ID =" + au2)
      //Equalizer immer setzen wenn vorhanden
      if (eq){
        //wpctl lehnt "set-default" auf virtuelle Filter-Chain-Knoten ab ("failed to set
        //default node... media.class = Audio/Sink", live bestaetigt), obwohl eq10 laut
        //wpctl status (der "*"-Marker) laengst Standard ist - das kommt bereits von
        //"context.properties { default.audio.sink = eq10 }" in tonboxFilter.conf selbst.
        //Dieser Aufruf ist damit ueberfluessig; ohne die Absicherung brach er bisher ab
        //und liess "pwPlay = true" nie erreichen.
        await execCmd("wpctl set-default " + eq + " || true")
        console.log("pipewireAudioInit: wpctl set-default " + eq)

        pwPlay = true
      }else
        pwPlay = false
      // cmd = "pamixer --set-volume " + parseInt(75+settings.jackVolume*0.15)
      // console.log(cmd)
      // await execCmd(cmd) 
    }catch(err){
      console.log(err)
      procStatus.text += "; catch " + err
      pwPlay = false
    }
  },
  this.pwPlayEq = async function(song){
    let track = escapeTrack(song)
    try{
      let cmd = "pw-play " + track //+ " >/dev/null 2>&1"
      console.log(cmd)
      await execCmd(cmd) 
      //await spawnAsync("pw-play", [song]);
    }
    catch(err){
      console.log(err)
      trackState = "done"
    }
  }
  // this.checkPwPlayAction = async function(){
  //   var result = await execCmd("wpctl status | grep pw-play >&1")
  //   if (!result){
  //     trackState = "done" //see playTrack2AudioJack
  //     trackIndex++
  //   }
  // }
}
