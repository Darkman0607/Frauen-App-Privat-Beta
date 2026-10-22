'use strict';
const APP_VERSION='0.1.9.6', APP_BUILD=20, DB='frauen-app-beta', DB_VERSION=2;
const $=id=>document.getElementById(id), esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const categories=['Periode','Zwischenblutung','Ausfluss','Flüssigkeitsverlust','Sexualität','Kinderwunsch','Zervixschleim / Eisprung','Basaltemperatur','Schwangerschaftstest','Schmerzen','Brustveränderung','Vulva / Scheide','WC / Ausscheidung','Wohlbefinden','Schwangerschaft','Kindsbewegungen / Wehen','Frauenarzttermin','Abstrich / Laboruntersuchung','Geburt / Wochenbett','Gemeinsame Selbstkontrolle','Krankheit / Allgemeinsymptome'];
const categoryIcons = {
 'Periode': '🩸',
 'Zwischenblutung': '🍷',
 'Ausfluss': '💧',
 'Flüssigkeitsverlust': '💦',
 'Sexualität': '❤️',
 'Kinderwunsch': '🌱',
 'Zervixschleim / Eisprung': '✨',
 'Basaltemperatur': '🌡️',
 'Schwangerschaftstest': '🧪',
 'Schmerzen': '⚡',
 'Brustveränderung': '🤲',
 'Vulva / Scheide': '🌸',
 'WC / Ausscheidung': '🚽',
 'Wohlbefinden': '🧘‍♀️',
 'Schwangerschaft': '🤰',
 'Kindsbewegungen / Wehen': '👣',
 'Frauenarzttermin': '🩺',
 'Abstrich / Laboruntersuchung': '🔬',
 'Geburt / Wochenbett': '👶',
 'Gemeinsame Selbstkontrolle': '🔦',
 'Krankheit / Allgemeinsymptome': '🤒'
};
function getCatIcon(cat){return categoryIcons[cat]||'📝';}

let updatingNow=false,db,page='home',selectedTopic=null,selectedTopic=null,selectedDay=[new Date().getFullYear(),String(new Date().getMonth()+1).padStart(2,'0'),String(new Date().getDate()).padStart(2,'0')].join('-'),reloadOnce=false,editing=null;
const lessons=COURSE_LESSONS;
let dataKey=null;
const SECURE_CHECK='frauen-app-local-v1';
function openDB(){return new Promise((ok,no)=>{let r=indexedDB.open(DB,DB_VERSION);r.onupgradeneeded=()=>{let d=r.result;if(!d.objectStoreNames.contains('entries'))d.createObjectStore('entries',{keyPath:'id'});if(!d.objectStoreNames.contains('photos'))d.createObjectStore('photos',{keyPath:'id'});if(!d.objectStoreNames.contains('security'))d.createObjectStore('security',{keyPath:'id'});};r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error);});}
function readRaw(name){return new Promise((ok,no)=>{const tx=db.transaction(name,'readonly'),r=tx.objectStore(name).getAll();r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error);});}
function readMeta(){return new Promise((ok,no)=>{const r=db.transaction('security','readonly').objectStore('security').get('local');r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error);});}
function randomBytes(n){const v=new Uint8Array(n);crypto.getRandomValues(v);return v;}
async function makeDataKey(pass,salt,iterations=350000){const material=await crypto.subtle.importKey('raw',new TextEncoder().encode(pass),'PBKDF2',false,['deriveKey']);return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);}
async function seal(value,id,key=dataKey){const iv=randomBytes(12);const bytes=new TextEncoder().encode(JSON.stringify(value));const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode(id)},key,bytes);return {id,iv:toB64(iv),cipher:toB64(encrypted),secure:1};}
async function unseal(value,key=dataKey){if(value?.secure!==1)throw Error('Unverschlüsselter Eintrag erkannt – bitte Sicherung und Migration prüfen');const clear=await crypto.subtle.decrypt({name:'AES-GCM',iv:fromB64(value.iv),additionalData:new TextEncoder().encode(value.id)},key,fromB64(value.cipher));return JSON.parse(new TextDecoder().decode(clear));}
async function packRecord(name,value){if(name==='photos'){const bytes=await value.blob.arrayBuffer();return seal({...value,blobType:value.blob.type,blob:toB64(bytes)},value.id);}return seal(value,value.id);}
async function unpackRecord(name,value){const data=await unseal(value);if(name==='photos'){const {blobType,blob,...rest}=data;return {...rest,blob:new Blob([fromB64(blob)],{type:blobType||'application/octet-stream'})};}return data;}
async function all(name){const rows=await readRaw(name);if(!dataKey)throw Error('Gesundheitsdaten sind gesperrt');return Promise.all(rows.map(x=>unpackRecord(name,x)));}
async function put(name,obj){const enc=await packRecord(name,obj);return new Promise((ok,no)=>{const tx=db.transaction(name,'readwrite');tx.objectStore(name).put(enc);tx.oncomplete=()=>ok();tx.onerror=()=>no(tx.error);tx.onabort=()=>no(tx.error||Error('Speicherfehler'));});}
function del(name,id){return new Promise((ok,no)=>{const tx=db.transaction(name,'readwrite');tx.objectStore(name).delete(id);tx.oncomplete=()=>ok();tx.onerror=()=>no(tx.error);tx.onabort=()=>no(tx.error||Error('Löschfehler'));});}
function requestDataPassword(isNew, initialError=""){
 return new Promise((resolve,reject)=>{
  const v=$('view');
  v.innerHTML=`<section class="card" style="max-width:540px;margin:20px auto;padding:24px"><h2>${isNew?'Lokale Verschlüsselung einrichten':'Gesundheitsdaten entsperren'}</h2><p class="muted">${isNew?'Erstelle jetzt ein Datenpasswort mit mindestens 12 Zeichen. Dieses Passwort wird zum Öffnen deiner verschlüsselten Daten benötigt. Es ist keine Handy-PIN.':'Gib dein bereits festgelegtes Datenpasswort ein. Ein neues Passwort würde vorhandene Daten nicht entschlüsseln.'}</p><form id="data-password-form"><label for="data-password">${isNew?'Neues Datenpasswort':'Datenpasswort'}</label><input id="data-password" name="password" type="password" minlength="${isNew?12:1}" autocomplete="${isNew?'new-password':'current-password'}" required style="width:100%;box-sizing:border-box;font:inherit;padding:12px;margin:8px 0 18px"><div id="data-password-confirm-box" style="display:${isNew?'block':'none'}"><label for="data-password-confirm">Datenpasswort wiederholen</label><input id="data-password-confirm" name="confirmation" type="password" minlength="12" autocomplete="new-password" style="width:100%;box-sizing:border-box;font:inherit;padding:12px;margin:8px 0 18px" ${isNew?'required':''}></div><p id="data-password-error" role="alert" style="color:#9c2649;min-height:1.5em"></p><button class="primary" type="submit">${isNew?'Verschlüsselung aktivieren':'Daten entsperren'}</button></form><p class="footnote">Wichtig: Passwort sicher außerhalb der App aufbewahren. Ohne es sind die verschlüsselten Daten nicht lesbar. Browser- oder App-Daten nicht löschen.</p></section>`;
  const form=$('data-password-form'),error=$('data-password-error');error.textContent=initialError;
  form.addEventListener('submit',event=>{event.preventDefault();const pass=$('data-password').value,confirmPass=isNew?$('data-password-confirm').value:pass;if(isNew&&pass.length<12){error.textContent='Bitte mindestens 12 Zeichen eingeben.';return;}if(isNew&&pass!==confirmPass){error.textContent='Die Passwörter stimmen nicht überein.';return;}form.querySelector('button').disabled=true;resolve(pass);},{once:false});
 });
}
async function unlockLocal(){if(!crypto?.subtle)throw Error('Web Crypto nicht verfügbar; HTTPS erforderlich');const meta=await readMeta();if(meta){
  let promptError="";
  for(;;){
    const pass=await requestDataPassword(false,promptError);
    try{
      const key=await makeDataKey(pass,fromB64(meta.salt),meta.iterations);
      const marker=await unseal(meta.check,key);
      if(marker.value!==SECURE_CHECK)throw Error('Prüfwert fehlerhaft');
      dataKey=key;return;
    }catch(e){
      promptError='Passwort stimmt nicht oder die Daten können nicht entschlüsselt werden. Bitte erneut eingeben.';
    }
  }
}
const pass=await requestDataPassword(true);const salt=randomBytes(16),iterations=350000,key=await makeDataKey(pass,salt,iterations);
const [entries,photos]=await Promise.all([readRaw('entries'),readRaw('photos')]);if(entries.some(v=>v.secure===1)||photos.some(v=>v.secure===1))throw Error('Unerwartete verschlüsselte Altbestände; Migration gestoppt');
const es=await Promise.all(entries.map(e=>seal(e,e.id,key)));const ps=[];for(const photo of photos){const bytes=await photo.blob.arrayBuffer();ps.push(await seal({...photo,blobType:photo.blob.type,blob:toB64(bytes)},photo.id,key));}
const check=await seal({value:SECURE_CHECK},'check',key);
await new Promise((ok,no)=>{const tx=db.transaction(['entries','photos','security'],'readwrite');const e=tx.objectStore('entries'),p=tx.objectStore('photos');e.clear();p.clear();for(const row of es)e.put(row);for(const row of ps)p.put(row);tx.objectStore('security').put({id:'local',salt:toB64(salt),iterations,check,created:new Date().toISOString()});tx.oncomplete=()=>ok();tx.onerror=()=>no(tx.error||Error('Migration fehlgeschlagen'));tx.onabort=()=>no(tx.error||Error('Migration abgebrochen'));});dataKey=key;
}
async function removeEntryWithPhotos(id){
 const photos=await readRaw('photos');const target=[];
 for(const row of photos){const p=await unpackRecord('photos',row);if(p.entryId===id)target.push(row.id);}
 await new Promise((resolve,reject)=>{
  const tx=db.transaction(['entries','photos'],'readwrite');
  tx.objectStore('entries').delete(id);
  for(const photoId of target)tx.objectStore('photos').delete(photoId);
  tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error||Error('Löschfehler'));
  tx.onabort=()=>reject(tx.error||Error('Löschen abgebrochen'));
 });
}
async function confirmAndDeleteEntry(id){
 if(!confirm('Diesen Eintrag und alle dazugehörigen Fotos endgültig löschen?'))return;
 try{await removeEntryWithPhotos(id);editing=null;notify('Eintrag und zugehörige Fotos gelöscht');await render();}
 catch(e){notify('Löschen fehlgeschlagen: '+e.message);}
}
function notify(msg){$('toast').textContent=msg;$('toast').style.display='block';clearTimeout(notify.timer);notify.timer=setTimeout(()=>$('toast').style.display='none',3800)}
function buttons(){document.querySelectorAll('[data-page]').forEach(b=>{b.classList.toggle('active',b.dataset.page===page);b.onclick=()=>goto(b.dataset.page)});}
async function goto(p,{preserveEdit=false}={}){page=p;if(!preserveEdit)editing=null;await render();window.scrollTo(0,0)}
function optionHTML(items){return items.map(x=>`<option>${esc(x)}</option>`).join('')}
function home(){return `<div class="card hero"><div class="hero-top"><span class="pill hero-pill">✨ Version ${APP_VERSION}</span><span class="pill hero-sub">🌸 Körperwissen &amp; Praxis</span></div><h2>Alles an einem Ort</h2><p class="muted">Beobachtungen, Zyklus und gynäkologische Befunde festhalten, mit illustrierten Fachbuch-Lektionen lernen und euren Körper gemeinsam verstehen.</p><button class="primary hero-btn" id="quick">＋ Neue Beobachtung eintragen</button></div><h3 class="section-title">Bereiche</h3><div class="grid"><button class="tile tile-diary" data-link="diary"><span class="tile-icon">📔</span>Tagebuch<small>Ausfluss, Zyklus, Symptome &amp; Fotos</small></button><button class="tile tile-cal" data-link="calendar"><span class="tile-icon">📅</span>Kalender<small>Alle Einträge &amp; Tage im Überblick</small></button><button class="tile tile-learn" data-link="learn"><span class="tile-icon">🎓</span>Lernzentrum<small>Lehrbuch, Schautafeln &amp; Fachwissen</small></button><button class="tile tile-records" data-link="records"><span class="tile-icon">🗂️</span>Frauenarztakte<small>Befunde, Termine &amp; Backup</small></button><button class="tile tile-self" data-link="selfcheck"><span class="tile-icon">🔦</span>Gemeinsame Selbstkontrolle<small>Spekulum, Tastung &amp; Praxisanleitung</small></button><button class="tile tile-ill" data-link="illness"><span class="tile-icon">🌡️</span>Krankheiten<small>Fieber, Beschwerden &amp; Verlauf</small></button></div>`}
const selfcheckTopics=[
 ['Brüste','Aussehen im Spiegel beobachten, Veränderungen im üblichen Tastgefühl dokumentieren. Neue Knoten oder blutige Absonderungen ärztlich abklären.'],
 ['Vulva und Scheideneingang','Nur äußerlich mit Licht und Spiegel betrachten; Rötung, Schwellung, Schmerzen und Juckreiz notieren. Keine Instrumente einführen.'],
 ['Ausfluss','Unterwäsche oder Toilettenpapier beobachten; Menge, Farbe, Konsistenz, Geruch und Beschwerden notieren. Fotos können den Verlauf ergänzen, keine Diagnose liefern.'],
 ['Blutungen','Datum, Dauer, Stärke und Produktwechsel dokumentieren. Starke Blutung mit Kreislaufproblemen ist dringlich abzuklären.'],
 ['Temperatur','Mit Thermometer messen und Messmethode/Uhrzeit festhalten.'],
 ['Muttermund und Gebärmutterhals','Anatomie und ärztliche Untersuchungsmethoden kennenlernen; keine vaginale Selbstprüfung auf Öffnung oder Verkürzung, besonders nicht in der Schwangerschaft.']
];
function selfcheckPage(){return `<h2>Gemeinsame Selbstkontrolle</h2><p class="muted">Vertieftes Fachwissen mit schematischen Abbildungen, Hygieneplan, sicheren Beobachtungen und Dokumentation. Keine Heimdiagnose oder Ersatz für Vorsorge.</p><div class="warning"><strong>Schwangerschaft:</strong> Bei möglichem Fruchtwasserverlust, Blutung, Wehen oder neuen Frühgeburtszeichen unmittelbar medizinisch abklären lassen. Keine innere Muttermundkontrolle oder Spekulumanwendung zu Hause bei solchen Symptomen.</div><div class="card"><h3>Beobachtung und Labor dokumentieren</h3><button class="primary" id="new-selfcheck">＋ Gemeinsame Beobachtung erfassen</button><button class="secondary" id="new-labcheck">＋ Abstrich / Laboruntersuchung erfassen</button><p class="footnote">Die Dokumentation stellt keine Diagnose. Zur Heimselbstentnahme nur validierte Testkits und deren Originalanleitung verwenden; PAP-Zytologie und Spekulumuntersuchung nicht als allgemeine Heimroutine.</p></div><div class="row wrap" style="margin-top:14px"><h3>Illustrierte Fachlektionen (${SELF_GUIDES.length})</h3><div class="row" style="gap:6px"><button class="secondary small-btn" id="open-all-guides">Alle öffnen</button><button class="secondary small-btn" id="close-all-guides">Alle schließen</button></div></div><p class="muted">Tippe auf ein Kapitel zum Öffnen und auf eine Schautafel für die Vollbild-Ansicht.</p>${SELF_GUIDES.map(g=>`<details class="lesson guide"><summary><span class="summary-row"><span class="lesson-ico">${esc(g.icon||"📘")}</span><span class="summary-text"><span class="summary-meta"><span class="pill guide-pill">${esc(g.group)}</span>${g.images?.length?`<span class="pill img-pill">🖼️ ${g.images.length} Schautafeln</span>`:g.image?`<span class="pill img-pill">🖼️ 1 Schautafel</span>`:""}</span><strong>${esc(g.title)}</strong></span></span></summary>${g.images?g.images.map(im=>`<figure class="medical-figure"><img src="./${esc(im.src)}" alt="${esc(im.alt)}" loading="lazy"><figcaption>${esc(im.caption)}<br><span class="zoom-hint">🔍 Antippen zum Vergrößern (Vollbild)</span></figcaption></figure>`).join(''):g.image?`<figure class="medical-figure"><img src="./${esc(g.image)}" alt="${esc(g.alt)}" loading="lazy"><figcaption>${esc(g.caption)}<br><span class="zoom-hint">🔍 Antippen zum Vergrößern (Vollbild)</span></figcaption></figure>`:''}<h3>Einfach erklärt</h3><p>${esc(g.simple)}</p><h3>Medizinischer Hintergrund</h3><p>${esc(g.expert)}</p><h3>Hygiene, Vorbereitung und sichere Schritte</h3><ol>${g.steps.map(t=>`<li>${esc(t)}</li>`).join('')}</ol><h3>So dokumentiert ihr es</h3><p>${esc(g.docs)}</p><div class="warning"><strong>Grenzen / Warnzeichen:</strong> ${esc(g.warning)}</div><p class="footnote"><a href="${esc(g.source)}" target="_blank" rel="noopener noreferrer">Medizinische Fachquelle öffnen ↗</a></p><button class="secondary" data-checktopic="${esc(g.category)}">Passende Beobachtung erfassen</button></details>`).join('')}`}
const illnessTypes=['Fieber / erhöhte Temperatur','Schüttelfrost','Schlappheit / Erschöpfung','Gliederschmerzen','Husten','Schnupfen','Halsschmerzen','Kopfschmerzen','Übelkeit','Erbrechen','Durchfall','Bauchkrämpfe','Harnwegsbeschwerden','Sonstige Beschwerden'];
function illnessPage(){return `<h2>Krankheiten & Symptome</h2><p class="muted">Erkrankungen dokumentieren und zeitlich mit Zyklus- oder Schwangerschaftseinträgen vergleichen. Einträge ersetzen keine medizinische Einschätzung.</p><div class="card"><h3>Krankheit erfassen</h3><p class="muted">Beginn, Dauer, Intensität, Körpertemperatur, Messmethode, Symptome und Medikamente erfassen.</p><button class="primary" id="new-illness">＋ Krankheits-Eintrag</button></div><div class="warning"><strong>Schwangerschaft:</strong> Fieber, starke Beschwerden oder Beschwerden beim Wasserlassen zeitnah ärztlich abklären. Bei schwerem Krankheitsgefühl, Atemnot oder anderen akuten Warnzeichen sofort medizinische Hilfe holen.</div><h3>Typische Symptome</h3>${illnessTypes.map(name=>`<button class="link-btn" data-illness="${esc(name)}">＋ ${esc(name)}</button>`).join('')}`}
function extraFields(category){if(category==='Abstrich / Laboruntersuchung')return `<div class="detailfields"><h3>Abstrich und Labor – Dokumentation</h3><label>Art des Tests</label><select name="testType">${optionHTML(['HPV-Selbsttest (validiertes Testset)','PAP-Zytologie (ärztliche Entnahme)','Vaginaler Erregerabstrich','Andere Laboruntersuchung'])}</select><label>Wer hat die Probe entnommen?</label><select name="sampleBy">${optionHTML(['Ärztin / Arzt','Patientin mit geeignetem Selbsttestset','Andere / nicht geklärt'])}</select><label>Hersteller / Testkit / Chargennummer</label><input name="testKit" placeholder="Genaue Bezeichnung laut Verpackung"><label>Labor / Arztpraxis</label><input name="labName" placeholder="Name und Kontakt"><label>Probenabgabe / Versand am</label><input name="sentAt" type="date"><label>Laborbefund / Ergebnis</label><select name="testResult">${optionHTML(['Ergebnis ausständig','Negativ / unauffällig – laut Befund','Positiv / auffällig – laut Befund','Ungültig / Probe nicht verwertbar','Sonstiges'])}</select><label>Datum Befundeingang</label><input name="resultAt" type="date"><label>Ärztlicher Kontrolltermin</label><input name="followUp" type="date"><label>Ausführlicher Befund / Fragen</label><textarea name="labDetail" placeholder="Befund wortgetreu dokumentieren; keine Eigendiagnose"></textarea><p class="fine">Nur geeignete, vom Labor akzeptierte Selbsttestsets nach Herstelleranleitung verwenden. Ein HPV-Selbsttest ersetzt nicht pauschal PAP-Zytologie oder frauenärztliche Untersuchung.</p></div>`;if(category==='Krankheit / Allgemeinsymptome')return `<div class="detailfields illness-detail-box">
 <h3>🤒 Angaben zur Erkrankung &amp; Symptome</h3>
 <div class="field-wrap" style="margin-bottom:12px">
  <label>Aktuelle Symptome (Mehrfachauswahl möglich)</label>
  <p class="muted" style="margin:2px 0 8px;font-size:12px">Tippe alle zutreffenden Symptome an:</p>
  <div class="symptom-chips-grid">
   ${illnessTypes.map(s=>`<label class="symptom-chip"><input type="checkbox" name="symptoms" value="${esc(s)}"><span class="chip-text">${esc(s)}</span></label>`).join('')}
  </div>
 </div>
 <div class="form-grid-2">
  <div class="field-wrap">
   <label>Beginn der Beschwerden</label>
   <input type="datetime-local" name="illnessStart" class="input-styled">
  </div>
  <div class="field-wrap">
   <label>Ende (optional)</label>
   <input type="datetime-local" name="illnessEnd" class="input-styled">
  </div>
  <div class="field-wrap">
   <label>Temperatur in °C (optional)</label>
   <input name="temperature" type="number" min="30" max="45" step="0.1" placeholder="z. B. 38,5" class="input-styled">
  </div>
  <div class="field-wrap">
   <label>Temperatur-Messmethode</label>
   <select name="tempMethod" class="select-styled">
    ${optionHTML(['Nicht angegeben','Ohr','Mund','Achsel','Rektal','Stirn'])}
   </select>
  </div>
 </div>
 <div class="field-wrap" style="margin-top:10px">
  <label>Verlauf &amp; Häufigkeit</label>
  <input name="frequency" placeholder="z. B. ständige Abgeschlagenheit, Husten vor allem nachts" class="input-styled">
 </div>
 <div class="field-wrap" style="margin-top:10px">
  <label>Weitere Symptome, Medikamente &amp; Dosierung</label>
  <textarea name="illnessDetails" class="textarea-styled" placeholder="Welche Medikamente wurden genommen (z. B. Paracetamol, Tee, Wadenwickel)? Wann? Wie ist das Allgemeinbefinden?"></textarea>
 </div>
</div>`;if(category==='Gemeinsame Selbstkontrolle'||category==='Selbstkontrolle')return `<div class="detailfields"><h3>Angaben zur Gemeinsame Selbstkontrolle</h3><label>Beobachteter Bereich</label><select name="checkArea">${optionHTML(['Nicht zugeordnet',...selfcheckTopics.map(t=>t[0])])}</select><label>Beobachtungsmethode</label><select name="checkMethod">${optionHTML(['Ansehen','Äußerliches vorsichtiges Abtasten','Spekulum-Einstellung (Portio / Periode)','Vaginale Tastuntersuchung (NFP / Muttermund)','Messung mit Thermometer','Beobachtung an Kleidung/Toilettenpapier','Andere Beobachtung'])}</select><label>Veränderung seit letzter Beobachtung</label><select name="change">${optionHTML(['Unbekannt','Keine Veränderung','Neu aufgetreten','Verstärkt','Weniger geworden'])}</select><label>Fragen für den Frauenarzt</label><textarea name="doctorQuestions" placeholder="Was soll ärztlich abgeklärt werden?"></textarea><p class="fine">Keine invasiven vaginalen Untersuchungen oder ärztliche Diagnosen selbst durchführen.</p></div>`;return ''}
function diaryForm(){
 let edit=editing;
 return `<div class="card form-modal-card">
  <div class="form-header">
   <div class="form-header-title">
    <h3>${edit?'✏️ Beobachtung bearbeiten':'✨ Neue Beobachtung erfassen'}</h3>
    <p class="muted">${edit?'Bestehende Daten &amp; Fotos anpassen':'Symptome, Befunde &amp; Fotos strukturiert dokumentieren'}</p>
   </div>
   <button class="secondary close-form-btn" id="close-form" aria-label="Schließen">✕</button>
  </div>
  <form id="entry-form" class="modern-entry-form">

   <!-- Sektion 1: Kategorie & Zeitpunkt -->
   <div class="form-section">
    <div class="section-badge"><span class="badge-num">1</span><strong>Kategorie &amp; Zeitpunkt</strong></div>
    <div class="form-grid-2">
     <div class="field-wrap">
      <label for="category">Kategorie</label>
      <select name="category" id="category" class="select-styled">${optionHTML(categories)}</select>
     </div>
     <div class="field-wrap">
      <label for="entry-date">Datum &amp; Uhrzeit</label>
      <input type="datetime-local" name="date" id="entry-date" required class="input-styled">
     </div>
    </div>
   </div>

   <!-- Dynamische Spezialfelder -->
   <div id="category-extra"></div>

   <!-- Sektion 2: Befund-Kriterien -->
   <div class="form-section">
    <div class="section-badge"><span class="badge-num">2</span><strong>Körperliche Kriterien &amp; Befund</strong></div>
    <div class="form-grid-2">
     <div class="field-wrap">
      <label>Quelle</label>
      <select name="source" class="select-styled">
       <option>Eigene Beobachtung</option>
       <option>Von ihr berichtet</option>
       <option>Gemeinsame Tastung / VU</option>
       <option>Ärztlich mitgeteilt</option>
       <option>Schriftlich ärztlich bestätigt</option>
       <option>Ungeklärt</option>
      </select>
     </div>
     <div class="field-wrap">
      <label>Stärke / Menge</label>
      <select name="amount" class="select-styled">
       <option>Unbekannt / nicht erfasst</option>
       <option>Keine</option>
       <option>Wenig / leicht</option>
       <option>Mittel / normal</option>
       <option>Viel / stark</option>
       <option>Sehr stark (Koagel)</option>
      </select>
     </div>
     <div class="field-wrap">
      <label>Farbe</label>
      <select name="color" class="select-styled">
       <option>Nicht angegeben</option>
       <option>Klar / durchsichtig</option>
       <option>Weißlich / milchig</option>
       <option>Gelblich</option>
       <option>Grünlich / schaumig</option>
       <option>Rosa / zartrot</option>
       <option>Hellrot (frisch)</option>
       <option>Dunkelrot</option>
       <option>Braun / Schmierblutung</option>
       <option>Grau-weißlich</option>
       <option>Andere</option>
      </select>
     </div>
     <div class="field-wrap">
      <label>Konsistenz / Tastgefühl</label>
      <select name="texture" class="select-styled">
       <option>Nicht angegeben</option>
       <option>Wässrig / flüssig</option>
       <option>Spinnbar (zieht Fäden / fruchtbar)</option>
       <option>Cremig / lotionartig</option>
       <option>Dicklich / zäh</option>
       <option>Klumpig / bröckelig (Hüttenkäse)</option>
       <option>Knorpelig-fest (Nasenspitze)</option>
       <option>Weich (Lippenrot)</option>
       <option>Anders</option>
      </select>
     </div>
    </div>

    <!-- Schmerz Schieberegler -->
    <div class="field-wrap pain-field-wrap">
     <div class="row">
      <label for="pain-input">Schmerz- / Spannungsstärke (0–10)</label>
      <span class="pain-badge" id="pain-val-display">Keine (0)</span>
     </div>
     <div class="pain-slider-row">
      <input type="range" name="pain" id="pain-input" min="0" max="10" value="0" step="1" class="slider-styled">
      <span class="pain-num" id="pain-num-pill">0</span>
     </div>
    </div>
   </div>

   <!-- Sektion 3: Notiz -->
   <div class="form-section">
    <div class="section-badge"><span class="badge-num">3</span><strong>Beschreibung &amp; Notizen</strong></div>
    <div class="field-wrap">
     <textarea name="note" class="textarea-styled" placeholder="Was genau wurde festgestellt? (z. B. Muttermundstand, Geruch, Krämpfe, Begleitsymptome, Stimmung oder Besonderheiten)"></textarea>
    </div>
   </div>

   <!-- Sektion 4: Fotos mit Kamera & Galerie -->
   <div class="form-section photo-upload-section">
    <div class="section-badge"><span class="badge-num">4</span><strong>Fotos &amp; Befundbilder</strong></div>
    <p class="muted" style="margin:2px 0 10px;font-size:12.5px">Dokumentiere Zervixschleim, Tests, Befunde oder Beobachtungen. Sicher verschlüsselt auf diesem Gerät.</p>
    <div class="photo-action-bar">
     <label for="camera-input" class="photo-btn camera-btn">
      <span class="photo-btn-icon">📷</span> Direkt Foto aufnehmen
      <input id="camera-input" type="file" accept="image/*" capture="environment" style="display:none">
     </label>
     <label for="photos-input" class="photo-btn gallery-btn">
      <span class="photo-btn-icon">🖼️</span> Aus Galerie wählen
      <input id="photos-input" type="file" accept="image/*" multiple style="display:none">
     </label>
    </div>
    <div id="photos-preview-gallery" class="photo-preview-grid"></div>
    <div id="photos-status" class="footnote" style="margin-top:6px"></div>
   </div>

   <div class="form-actions">
    <button class="primary submit-entry-btn" type="submit">💾 Beobachtung sicher speichern</button>
   </div>
  </form>
 </div>`;
}
async function diary(){
 const entries=(await all('entries')).sort((a,b)=>b.date.localeCompare(a.date));
 return `<div class="diary-header-card">
  <div class="row">
   <div>
    <h2>📔 Tagebuch</h2>
    <p class="muted" style="margin:2px 0 0">Einträge, Symptome und Fotos chronologisch im Überblick.</p>
   </div>
   <button class="primary new-entry-top-btn" id="new-entry">＋ Neuer Eintrag</button>
  </div>
  <div class="diary-filter-bar">
   <span class="filter-icon">🔍</span>
   <select id="filter" class="select-styled diary-filter-select">
    <option>Alle Kategorien (${entries.length})</option>
    ${optionHTML(categories)}
   </select>
  </div>
 </div>
 <div id="form-holder"></div>
 <div class="entries-count-bar">
  <span id="entries-count-text">${entries.length} ${entries.length===1?'Eintrag':'Einträge'} gefunden</span>
 </div>
 <div class="entries" id="entry-list">${entryRows(entries)}</div>`;
}
function entryRows(entries){
 return entries.map(e=>{
  const ico=getCatIcon(e.category);
  const d=new Date(e.date);
  const dateFormatted=d.toLocaleDateString('de-AT',{day:'2-digit',month:'2-digit',year:'numeric'});
  const timeFormatted=d.toLocaleTimeString('de-AT',{hour:'2-digit',minute:'2-digit'});
  const hasSymptoms=Array.isArray(e.symptoms)&&e.symptoms.length>0;
  const painVal=e.pain!==undefined&&e.pain!==''?Number(e.pain):null;

  return `<div class="entry-card" data-entry-card="${esc(e.id)}">
   <div class="entry-card-header">
    <div class="entry-cat-badge">
     <span class="entry-cat-icon">${ico}</span>
     <div class="entry-cat-texts">
      <strong class="entry-cat-title">${esc(e.category)}</strong>
      <span class="entry-date-pill">📅 ${dateFormatted} · ⏰ ${timeFormatted}</span>
     </div>
    </div>
    ${painVal!==null&&painVal>0?`<span class="entry-pain-pill pain-lvl-${painVal>6?'high':painVal>3?'med':'low'}">⚡ Schmerz ${painVal}/10</span>`:''}
   </div>

   ${hasSymptoms?`<div class="entry-symptoms-list">
    ${e.symptoms.map(s=>`<span class="entry-symptom-tag">${esc(s)}</span>`).join('')}
   </div>`:''}

   ${e.temperature?`<div class="entry-temp-badge">🌡️ Temperatur: <strong>${esc(e.temperature)} °C</strong> ${e.tempMethod&&e.tempMethod!=='Nicht angegeben'?`(${esc(e.tempMethod)})`:''}</div>`:''}

   <p class="entry-note-preview ${e.note?'':'empty'}">${esc(e.note||'Keine zusätzliche Notiz hinterlegt.')}</p>

   <div class="entry-meta-chips">
    ${e.amount&&e.amount!=='Unbekannt / nicht erfasst'&&e.amount!=='Keine'?`<span class="meta-chip">Menge: ${esc(e.amount)}</span>`:''}
    ${e.color&&e.color!=='Nicht angegeben'?`<span class="meta-chip">Farbe: ${esc(e.color)}</span>`:''}
    ${e.texture&&e.texture!=='Nicht angegeben'?`<span class="meta-chip">Art: ${esc(e.texture)}</span>`:''}
    ${e.source&&e.source!=='Ungeklärt'?`<span class="meta-chip meta-source">👤 ${esc(e.source)}</span>`:''}
   </div>

   <div class="entry-card-actions">
    <button class="secondary action-btn-details" data-open="${esc(e.id)}">🔍 Details &amp; Fotos</button>
    <button class="secondary action-btn-edit" data-edit="${esc(e.id)}">✏️ Bearbeiten</button>
    <button class="danger action-btn-del" data-delete="${esc(e.id)}" aria-label="Eintrag löschen" title="Eintrag löschen">🗑️ Löschen</button>
   </div>
  </div>`;
 }).join('') || `<div class="card empty-diary-card">
   <span class="empty-diary-ico">📝</span>
   <h3>Noch keine Einträge vorhanden</h3>
   <p class="muted">Tippe oben auf „＋ Neuer Eintrag“, um deine erste Beobachtung zu dokumentieren.</p>
 </div>`;
}
async function photoCards(id){const photos=(await all('photos')).filter(p=>p.entryId===id);return photos.map(p=>`<div class="photo-card"><img src="${URL.createObjectURL(p.blob)}" alt="Gespeichertes Foto"><button class="danger" data-delphoto="${esc(p.id)}">Foto löschen</button></div>`).join('')}
async function openEntry(id){let entry=(await all('entries')).find(x=>x.id===id);if(!entry)return;let photos=await photoCards(id);let holder=$('form-holder');holder.innerHTML=`<div class="card"><div class="row"><h3>${esc(entry.category)}</h3><button class="secondary" id="detail-close">Schließen</button></div><p class="muted">${esc(new Date(entry.date).toLocaleString('de-AT'))}</p><p>${esc(entry.note||'Keine Beschreibung')}</p><p class="muted">Quelle: ${esc(entry.source)} · Menge: ${esc(entry.amount)} · Farbe: ${esc(entry.color)} · Konsistenz: ${esc(entry.texture)} · Schmerz: ${esc(entry.pain||'–')}</p><div class="entry-extra">${Object.entries({illnessType:'Hauptsymptom',symptoms:'Symptome',illnessStart:'Beginn',illnessEnd:'Ende',temperature:'Temperatur °C',tempMethod:'Messmethode',frequency:'Häufigkeit',illnessDetails:'Zusatzangaben',checkArea:'Bereich',checkMethod:'Methode',change:'Veränderung',doctorQuestions:'Fragen für Arzt'}).filter(([key])=>entry[key]).map(([key,label])=>`<p class="fine"><strong>${esc(label)}:</strong> ${esc(entry[key])}</p>`).join('')}</div><div class="grid">${photos}</div><button class="danger" id="delete-entry" style="margin-top:12px">Eintrag vollständig löschen</button></div>`;$('detail-close').onclick=()=>holder.innerHTML='';$('delete-entry').onclick=async()=>{if(!confirm('Eintrag inklusive Fotos unwiderruflich löschen?'))return;await removeEntryWithPhotos(id);notify('Eintrag gelöscht');render()};holder.querySelectorAll('[data-delphoto]').forEach(b=>b.onclick=async()=>{if(!confirm('Dieses Foto unwiderruflich löschen?'))return;await del('photos',b.dataset.delphoto);openEntry(id)});holder.scrollIntoView({behavior:'smooth',block:'start'})}
function formBind(){
 const f=$('entry-form');if(!f)return;
 const now=editing?.date||new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16);
 $('entry-date').value=now;
 
 // Pain slider listener
 const painSlider=$('pain-input'), painDisp=$('pain-val-display'), painPill=$('pain-num-pill');
 if(painSlider){
  const updatePain=()=>{
   const v=Number(painSlider.value);
   painPill.textContent=v;
   painDisp.textContent=v===0?'Keine':v<=3?'Leicht ('+v+')':v<=6?'Mäßig ('+v+')':v<=8?'Stark ('+v+')':'Extrem ('+v+')';
   painPill.style.background=v===0?'#e3f5ec':v<=3?'#fbf1cf':v<=6?'#fde2cf':v<=8?'#fccfcf':'#9c2649';
   painPill.style.color=v>8?'#fff':'#4d3347';
  };
  painSlider.oninput=updatePain;
  if(editing?.pain!==undefined&&editing.pain!==''){painSlider.value=editing.pain;updatePain();}
 }

 // Category dynamic fields
 $('category').onchange=()=>{
  const current=Object.fromEntries(new FormData(f).entries());
  $('category-extra').innerHTML=extraFields($('category').value);
  for(const [key,val] of Object.entries(current)){
   const control=f.elements[key];
   if(control && !['category','date'].includes(key) && control.type!=='file')control.value=val;
  }
 };
 if(editing){$('category').value=editing.category;}
 $('category').onchange();
 if(editing){
  for(const [key,val] of Object.entries(editing)){
   const control=f.elements[key];
   if(control && control.type!=='file')control.value=val;
   if(key==='symptoms'&&Array.isArray(val)){
    f.querySelectorAll('input[name="symptoms"]').forEach(cb=>{cb.checked=val.includes(cb.value);});
   }
  }
 }

 // Accumulative photo files list
 let selectedFiles=[];
 const previewBox=$('photos-preview-gallery'), statusBox=$('photos-status');
 const renderPreviews=()=>{
  previewBox.innerHTML='';
  if(selectedFiles.length===0){
   statusBox.textContent=editing?'Bestehende Fotos bleiben erhalten; tippe oben um weitere hinzuzufügen.':'Noch keine Fotos ausgewählt.';
   return;
  }
  statusBox.textContent=selectedFiles.length+(selectedFiles.length===1?' neues Foto bereit':' neue Fotos bereit');
  selectedFiles.forEach((file,idx)=>{
   const card=document.createElement('div');card.className='form-preview-thumb';
   const img=document.createElement('img');img.src=URL.createObjectURL(file);card.appendChild(img);
   const delBtn=document.createElement('button');delBtn.type='button';delBtn.className='thumb-del-btn';delBtn.innerHTML='✕';delBtn.title='Foto entfernen';
   delBtn.onclick=(e)=>{e.preventDefault();selectedFiles.splice(idx,1);renderPreviews();};
   card.appendChild(delBtn);
   previewBox.appendChild(card);
  });
 };
 renderPreviews();

 const handleAddFiles=(fileList)=>{
  for(const file of fileList){
   if(!file.type.startsWith('image/')){notify('Nur Bilddateien erlaubt');continue;}
   if(file.size>12*1024*1024){notify('Maximal 12 MB pro Bild erlaubt');continue;}
   selectedFiles.push(file);
  }
  renderPreviews();
 };

 if($('photos-input'))$('photos-input').onchange=e=>handleAddFiles(e.target.files);
 if($('camera-input'))$('camera-input').onchange=e=>handleAddFiles(e.target.files);

 f.onsubmit=async ev=>{
  ev.preventDefault();
  const formData=new FormData(f);
  let data=Object.fromEntries(formData.entries());
  const selectedSymptoms=formData.getAll('symptoms');
  if(selectedSymptoms.length>0){data.symptoms=selectedSymptoms;}
  delete data[''];
  let id=editing?.id||crypto.randomUUID();
  const item={...data,id,modified:new Date().toISOString()};
  try{
   const encodedItem=await packRecord('entries',item);
   const encodedPhotos=[];
   for(const file of selectedFiles){
    encodedPhotos.push(await packRecord('photos',{id:crypto.randomUUID(),entryId:id,blob:file,name:file.name,added:new Date().toISOString()}));
   }
   await new Promise((resolve,reject)=>{
    const tx=db.transaction(['entries','photos'],'readwrite');
    tx.objectStore('entries').put(encodedItem);
    for(const encryptedPhoto of encodedPhotos)tx.objectStore('photos').put(encryptedPhoto);
    tx.oncomplete=()=>resolve();
    tx.onerror=()=>reject(tx.error||Error('Speicherfehler'));
    tx.onabort=()=>reject(tx.error||Error('Speicherplatz oder Datenbankfehler'));
   });
   editing=null;
   notify('Beobachtung inklusive '+encodedPhotos.length+' Foto(s) sicher gespeichert');
   await render();
  }catch(err){
   notify('Speichern fehlgeschlagen: '+(err?.message||'Speicher prüfen')+'. Eingabe bleibt geöffnet.');
  }
 };
 $('close-form').onclick=()=>{editing=null;$('form-holder').innerHTML='';};
}
async function calendar(){
 let entries=await all('entries');
 let d=new Date(selectedDay+'T12:00:00');
 let year=d.getFullYear(),month=d.getMonth();
 let first=new Date(year,month,1),last=new Date(year,month+1,0),start=(first.getDay()+6)%7;
 let todayStr=[new Date().getFullYear(),String(new Date().getMonth()+1).padStart(2,'0'),String(new Date().getDate()).padStart(2,'0')].join('-');
 
 let cells=Array(start).fill('<div class="day-empty"></div>');
 for(let n=1;n<=last.getDate();n++){
  let date=`${year}-${String(month+1).padStart(2,'0')}-${String(n).padStart(2,'0')}`;
  let dayEntries=entries.filter(e=>e.date.startsWith(date));
  let count=dayEntries.length;
  let isSelected=date===selectedDay;
  let isToday=date===todayStr;

  // Extract distinct category icons for this day (max 3 visible dots/icons)
  let catSet=[...new Set(dayEntries.map(e=>e.category))];
  let iconBadges=catSet.slice(0,3).map(c=>`<span class="day-mini-ico" title="${esc(c)}">${getCatIcon(c)}</span>`).join('');
  let hasMore=catSet.length>3;

  // Period / Illness special highlight class
  let hasPeriod=catSet.some(c=>c==='Periode'||c==='Zwischenblutung');
  let hasIllness=catSet.includes('Krankheit / Allgemeinsymptome');
  let dayTypeClass=hasPeriod?'day-has-period':hasIllness?'day-has-illness':count?'day-has-entry':'';

  cells.push(`<button class="day-card ${isSelected?'active':''} ${isToday?'is-today':''} ${dayTypeClass}" data-day="${date}" aria-label="${n}. ${d.toLocaleDateString('de-AT',{month:'long'})}">
   <span class="day-num">${n}</span>
   <div class="day-icons-row">${iconBadges}${hasMore?'<span class="day-more-dots">+</span>':''}</div>
   ${count>0?`<span class="day-badge-count">${count}</span>`:''}
  </button>`);
 }

 let todays=entries.filter(e=>e.date.startsWith(selectedDay)).sort((a,b)=>b.date.localeCompare(a.date));
 const selectedDateFormatted=new Date(selectedDay+'T12:00').toLocaleDateString('de-AT',{weekday:'long',day:'2-digit',month:'long',year:'numeric'});

 return `<div class="calendar-header-card">
  <div class="row wrap" style="margin-bottom:12px">
   <div>
    <h2>📅 Kalender</h2>
    <p class="muted" style="margin:2px 0 0">Monatsübersicht mit Symptom- und Zyklus-Icons.</p>
   </div>
   <button class="primary new-entry-cal-btn" id="cal-new-entry">＋ Eintrag am ${new Date(selectedDay+'T12:00').toLocaleDateString('de-AT',{day:'2-digit',month:'2-digit'})}</button>
  </div>

  <div class="cal-nav-bar">
   <button class="cal-arrow-btn" id="prev" aria-label="Vorheriger Monat">◀</button>
   <div class="cal-month-title">
    <strong>${d.toLocaleDateString('de-AT',{month:'long'})}</strong>
    <small>${year}</small>
   </div>
   <button class="cal-arrow-btn" id="next" aria-label="Nächster Monat">▶</button>
  </div>

  <div class="week-header-row">
   ${['Mo','Di','Mi','Do','Fr','Sa','So'].map(x=>`<span class="week-header-cell">${x}</span>`).join('')}
  </div>

  <div class="cal-grid-month">${cells.join('')}</div>

  <div class="cal-legend-bar">
   <span class="legend-item"><span class="legend-dot dot-period">🩸</span> Periode</span>
   <span class="legend-item"><span class="legend-dot dot-ill">🤒</span> Krankheit</span>
   <span class="legend-item"><span class="legend-dot dot-check">🔦</span> Kontrolle</span>
   <span class="legend-item"><span class="legend-dot dot-mucus">✨</span> Schleim</span>
  </div>
 </div>

 <div id="form-holder"></div>

 <div class="selected-day-header">
  <div class="selected-day-title-wrap">
   <h3>Einträge am ${selectedDateFormatted}</h3>
   <span class="selected-day-count-pill">${todays.length} ${todays.length===1?'Eintrag':'Einträge'}</span>
  </div>
 </div>

 <div class="entries" id="entry-list">${entryRows(todays)}</div>`;
}
const LEARN_TOPICS = [
  {
    id: 'periode',
    title: 'Periode & Blutung',
    icon: '🩸',
    desc: 'Menstruationsverlauf, Blutmengen, Koagel, Hygiene & freies Bluten',
    colorClass: 'topic-periode',
    modules: ['Zyklus und Periode', 'Zyklus'],
    keywords: ['menstruation', 'blutung', 'hygiene', 'periode', 'koagel', 'freies bluten', 'dysmenorrhoe', 'regelschmerz', 'gewebe']
  },
  {
    id: 'zyklus',
    title: 'Zyklus & Hormone',
    icon: '✨',
    desc: 'Eisprung, Zervixschleim, Basaltemperatur, Lutealphase & NFP',
    colorClass: 'topic-zyklus',
    modules: ['Zyklus und Periode', 'Hormone & Zyklus', 'Kinderwunsch', 'Zyklus'],
    keywords: ['zervixschleim', 'basaltemperatur', 'lutealphase', 'sensiplan', 'eisprung', 'hormon', 'fsh', 'lh', 'östrogen', 'progesteron']
  },
  {
    id: 'schwangerschaft',
    title: 'Schwangerschaft & Geburt',
    icon: '🤰',
    desc: 'Entwicklung, Fruchtblase, Fruchtwasser, Wehen & Geburt',
    colorClass: 'topic-schwanger',
    modules: ['Schwangerschaft und Geburt', 'Schwangerschaft & Geburt', 'Geburtshilfe'],
    keywords: ['fruchtblase', 'fruchtwasser', 'geburt', 'schwangerschaft', 'einnistung', 'befruchtung', 'wehen', 'kindswochen', 'ultraschall']
  },
  {
    id: 'untersuchungen',
    title: 'Untersuchungen & Spekulum',
    icon: '🔦',
    desc: 'Spekulumkunde, Vaginale Tastung (VU), Portio-Einstellung & Labor',
    colorClass: 'topic-unter',
    modules: ['Untersuchungen', 'Gynäkologie'],
    keywords: ['spekulum', 'vaginale untersuchung', 'frauenarzt', 'palpation', 'labor', 'abstrich', 'pap', 'hpv']
  },
  {
    id: 'anatomie',
    title: 'Anatomie & Intimbereich',
    icon: '🌸',
    desc: 'Vulva, Schamlippen, Scheideneingang, Muttermund & Beckenboden',
    colorClass: 'topic-anatomie',
    modules: ['Anatomie'],
    keywords: ['vulva', 'scheideneingang', 'muttermund', 'beckenboden', 'vagina', 'gebärmutter', 'eierstock', 'damm']
  },
  {
    id: 'wochenbett',
    title: 'Wochenbett & Rückbildung',
    icon: '🍼',
    desc: 'Lochien (Wochenfluss), Fundusstand, Gebärmutter-Rückbildung & Pflege',
    colorClass: 'topic-wochenbett',
    modules: ['Wochenbett'],
    keywords: ['lochien', 'wochenfluss', 'fundus', 'rückbildung']
  },
  {
    id: 'brust',
    title: 'Brustgesundheit',
    icon: '🤲',
    desc: 'Anatomie, Abtasttechnik, Mastodynie & Selbstbeobachtung',
    colorClass: 'topic-brust',
    modules: ['Brustgesundheit'],
    keywords: ['brust']
  },
  {
    id: 'selbstkontrolle',
    title: 'Selbstbeobachtung & Hygiene',
    icon: '🧼',
    desc: 'Händehygiene, Handschuhe, sichere Schritte & Fotodokumentation',
    colorClass: 'topic-hygiene',
    modules: ['Selbstbeobachtung', 'Gemeinsame Selbstkontrolle'],
    keywords: ['hygiene', 'handschuh', 'selbstkontrolle', 'foto']
  }
];

function getDeepLessonsForTopic(topicId){
  const t = LEARN_TOPICS.find(x => x.id === topicId);
  if(!t) return DEEP_LESSONS.map((l,idx)=>({l,idx}));
  return DEEP_LESSONS.map((l,idx)=>({l,idx})).filter(({l})=>{
    const modMatch = t.modules.includes(l.module);
    const kwMatch = t.keywords.some(kw => l.title.toLowerCase().includes(kw) || l.simple.toLowerCase().includes(kw));
    return modMatch || kwMatch;
  });
}

function learn(){
 if(selectedTopic){
  const t = LEARN_TOPICS.find(x => x.id === selectedTopic);
  if(!t){ selectedTopic = null; return learn(); }
  const topicDeep = getDeepLessonsForTopic(t.id);

  return `<div class="learn-subpage-header ${t.colorClass}">
   <button class="subpage-back-btn" id="topic-back-btn">← Zur Themenübersicht</button>
   <div class="subpage-title-row">
    <span class="subpage-ico">${t.icon}</span>
    <div class="subpage-texts">
     <h2>${esc(t.title)}</h2>
     <p class="muted" style="margin:2px 0 0">${esc(t.desc)}</p>
    </div>
   </div>
   <div class="subpage-stats-chips">
    <span class="pill sub-pill">📖 ${topicDeep.length} Fachkapitel</span>
    <button class="secondary small-btn" id="open-all-topic">Alle öffnen</button>
    <button class="secondary small-btn" id="close-all-topic">Alle schließen</button>
   </div>
  </div>

  <div class="topic-lessons-wrap">
   <div id="deep-lessons" class="lessons-container">
    ${topicDeep.length ? topicDeep.map(({l,idx})=>deepCard(l,idx)).join('') : '<div class="card muted text-center" style="padding:20px">Keine Fachlektionen in diesem Bereich.</div>'}
   </div>
  </div>`;
 }

 const doneTotal = DEEP_LESSONS.filter((_,i)=>localStorage.getItem('frauen-app-lesson-done-'+i)==='1').length;
 const pctTotal = Math.round((doneTotal / DEEP_LESSONS.length) * 100);

 return `<div class="learn-hero-card">
  <div class="learn-hero-top">
   <div class="learn-hero-title">
    <h2>🎓 Lernzentrum · Themenbereiche</h2>
    <p class="muted" style="margin:2px 0 0">Wähle ein Fachgebiet aus, um alle ${DEEP_LESSONS.length} Fachkapitel &amp; Schautafeln zu öffnen.</p>
   </div>
   <div class="learn-stats-badge">
    <strong>${DEEP_LESSONS.length}</strong>
    <small>Fachkapitel</small>
   </div>
  </div>

  <div class="learn-progress-box">
   <div class="row" style="margin-bottom:6px">
    <span class="learn-progress-label">Gesamter Lernfortschritt</span>
    <span class="learn-progress-val">${doneTotal} / ${DEEP_LESSONS.length} (${pctTotal}%)</span>
   </div>
   <div class="progress-bar-track">
    <div class="progress-bar-fill" style="width:${pctTotal}%"></div>
   </div>
  </div>
 </div>

 <h3 class="section-title" style="margin:16px 4px 12px">Wähle dein Lernkapitel:</h3>

 <div class="topics-grid">
  ${LEARN_TOPICS.map(t=>{
    const deepCount = getDeepLessonsForTopic(t.id).length;
    return `<button class="topic-card ${t.colorClass}" data-topic="${esc(t.id)}">
     <div class="topic-card-top">
      <span class="topic-card-icon">${t.icon}</span>
      <span class="topic-arrow">➔</span>
     </div>
     <strong class="topic-card-title">${esc(t.title)}</strong>
     <p class="topic-card-desc">${esc(t.desc)}</p>
     <div class="topic-card-footer">
      <span class="topic-stat-pill">📖 ${deepCount} Fachkapitel</span>
     </div>
    </button>`;
  }).join('')}
 </div>`;
}

function deepCard(l,i){
 const isDone = localStorage.getItem('frauen-app-lesson-done-'+i)==='1';
 return `<details class="lesson deep-lesson ${isDone?'is-completed':''}" id="deep-${i}">
  <summary>
   <span class="summary-row">
    <span class="lesson-ico">${esc(l.icon||"🎓")}</span>
    <span class="summary-text">
     <span class="summary-meta">
      <span class="pill module-pill">${esc(l.module)}</span>
      ${l.images?.length?`<span class="pill img-pill">🖼️ ${l.images.length} Schautafeln</span>`:l.image?`<span class="pill img-pill">🖼️ 1 Schautafel</span>`:""}
      <span class="pill steps-pill">📋 ${l.steps.length} Schritte</span>
      ${isDone?`<span class="pill done-pill">✓ Gelernt</span>`:''}
     </span>
     <strong>${esc(l.title)}</strong>
    </span>
   </span>
  </summary>

  <div class="lesson-content-body">
   ${l.images?l.images.map(im=>`<figure class="medical-figure"><img src="./${esc(im.src)}" alt="${esc(im.alt)}" loading="lazy"><figcaption>${esc(im.caption)}<br><span class="zoom-hint">🔍 Antippen zum Vergrößern (Vollbild)</span></figcaption></figure>`).join(''):l.image?`<figure class="medical-figure"><img src="./${esc(l.image)}" alt="${esc(l.alt||l.title)}" loading="lazy"><figcaption>${esc(l.caption||'')}<br><span class="zoom-hint">🔍 Antippen zum Vergrößern (Vollbild)</span></figcaption></figure>`:""}

   <div class="lesson-box simple-box">
    <h4>💡 Einfach erklärt</h4>
    <p>${esc(l.simple)}</p>
   </div>

   <div class="lesson-box expert-box">
    <h4>🔬 Hebammen- &amp; Fachwissen</h4>
    <p>${esc(l.expert)}</p>
   </div>

   <div class="lesson-box steps-box">
    <h4>📋 Schritt für Schritt</h4>
    <ol class="styled-steps-list">
     ${l.steps.map(x=>`<li>${esc(x)}</li>`).join('')}
    </ol>
   </div>

   <div class="warning lesson-warning">
    <strong>⚠️ Praxishinweis &amp; Warnzeichen:</strong> ${esc(l.tip)}
   </div>

   <div class="lesson-footer-bar">
    <p class="footnote"><a target="_blank" rel="noopener noreferrer" href="${esc(l.source)}">Fachquelle öffnen ↗</a></p>
    <label class="lesson-check-label">
     <input class="checkbox deep-complete" type="checkbox" data-deep="${i}" ${isDone?'checked':''}>
     <span>Lektion als verstanden markieren</span>
    </label>
   </div>
  </div>
 </details>`;
}
function lessonCards(arr){
 return arr.map(l=>`<details class="lesson base-lesson">
  <summary>
   <span class="summary-row">
    <span class="lesson-ico base-ico">📖</span>
    <span class="summary-text">
     <span class="summary-meta"><span class="pill base-pill">${esc(l.module)}</span></span>
     <strong>${esc(l.title)}</strong>
    </span>
   </span>
  </summary>
  <div class="lesson-content-body">
   <div class="lesson-box simple-box">
    <h4>💡 Einfach erklärt</h4>
    <p>${esc(l.simple)}</p>
   </div>
   <div class="lesson-box expert-box">
    <h4>🔬 Medizinisches Fachwissen</h4>
    <p>${esc(l.expert)}</p>
   </div>
   <div class="lesson-box steps-box">
    <h4>📋 Selbstbeobachtung / Dokumentation</h4>
    <p>${esc(l.practice)}</p>
   </div>
   <div class="warning lesson-warning">
    <strong>⚠️ Grenzen und Warnzeichen:</strong> ${esc(l.tip)}
   </div>
   <p class="footnote"><a href="${esc(l.source)}" target="_blank" rel="noopener noreferrer">Fachquelle öffnen ↗</a></p>
  </div>
 </details>`).join('') || '<div class="card muted text-center" style="padding:24px">Keine Lektionen gefunden.</div>';
}
function records(){return `<h2>Frauenarztakte & Sicherung</h2><div class="card"><h3>Untersuchungen dokumentieren</h3><p class="muted">Lege unter „Tagebuch“ die Kategorie „Frauenarzttermin“ an. Dort kannst du mehrere Bilder von Befunden hinzufügen. Eine eigene PDF-Verwaltung folgt später.</p><button class="secondary" id="open-record-form">＋ Frauenarzt-Eintrag</button></div><div class="card"><h3>🔐 Verschlüsselte Google-Drive-Sicherung</h3><p class="muted">Die Backup-Datei wird vor dem Teilen oder Herunterladen auf diesem Gerät mit AES-GCM verschlüsselt. Du legst dafür ein <strong>separates Sicherungspasswort</strong> fest. Ohne dieses Passwort kann niemand die Backup-Inhalte wiederherstellen.</p><button id="drive-share" class="secondary">☁ Verschlüsseltes Backup nach Drive teilen</button><button id="export" class="secondary">⬇ Verschlüsseltes Backup herunterladen</button><label for="restore">Verschlüsselte Sicherung aus Drive / Dateien auswählen</label><input id="restore" type="file" accept=".json,.fbackup,application/json"><p class="footnote">Die App verbindet sich nicht direkt mit Google Drive. Alte unverschlüsselte Backups aus 0.1.5 können nach deutlicher Warnung importiert werden. Bewahre das Passwort außerhalb der App sicher auf.</p></div><div class="warning"><strong>Datenschutz:</strong> Lokale Einträge und Fotos werden mit AES-GCM verschlüsselt, ebenso exportierte Backups. Kein Fingerabdruck und keine App-PIN. Das Datenpasswort wird zum Entschlüsseln bei jedem Start benötigt. Ein verlorenes Passwort kann nicht zurückgesetzt werden.</div><div class="card"><h3>Lokale Datenverwaltung</h3><p class="muted">Browserdaten zu löschen kann die Tagebucheinträge dauerhaft entfernen. Prüfe ein verschlüsseltes Backup und die Wiederherstellung zunächst mit Testdaten.</p><button id="clear-all" class="danger">Alle lokalen Daten löschen</button></div><div class="card"><h3>Version & Aktualisierung</h3><p>Aktuell: <strong>v${APP_VERSION}</strong></p><p class="muted">Die Prüfung oben sucht nach einer neu veröffentlichten Version.</p><button class="secondary" id="record-update">Jetzt nach Updates suchen</button></div>`}
async function buildBackupFile(){let entries=await all('entries'),photos=await all('photos');let encoded=[];for(let p of photos){let b64=await new Promise((ok,no)=>{let r=new FileReader();r.onload=()=>ok(r.result);r.onerror=no;r.readAsDataURL(p.blob)});encoded.push({...p,blob:b64})}const payload={format:'frauen-app-backup',version:1,created:new Date().toISOString(),entries,photos:encoded};return new File([JSON.stringify(payload)],'frauen-app-backup-'+new Date().toISOString().slice(0,10)+'.json',{type:'application/json'});}
const BACKUP_LIMIT=150*1024*1024;
function toB64(buf){let a=new Uint8Array(buf),chunks=[];for(let i=0;i<a.length;i+=8192)chunks.push(String.fromCharCode(...a.subarray(i,i+8192)));return btoa(chunks.join(''))}
function fromB64(text){if(typeof text!=='string'||text.length>BACKUP_LIMIT*2||!/^[A-Za-z0-9+/]*={0,2}$/.test(text))throw Error('Ungültige Kodierung');return Uint8Array.from(atob(text),c=>c.charCodeAt(0))}
async function passwordKey(password,salt){const material=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveKey']);return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:310000,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt'])}
async function encryptedBackupFile(){if(!crypto?.subtle||!crypto.getRandomValues)throw Error('Sichere Verschlüsselung im Browser nicht verfügbar');const password=prompt('Neues Sicherungspasswort eingeben (mindestens 12 Zeichen). Ohne Passwort ist die Wiederherstellung unmöglich:');if(password===null)throw Error('Abgebrochen');if(password.length<12)throw Error('Sicherungspasswort benötigt mindestens 12 Zeichen');const again=prompt('Sicherungspasswort zur Kontrolle erneut eingeben:');if(again!==password)throw Error('Passwörter stimmen nicht überein');let plain=await buildBackupFile();if(plain.size>BACKUP_LIMIT)throw Error('Backup ist für diese Version zu groß');const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));const key=await passwordKey(password,salt);const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,await plain.arrayBuffer());const envelope={format:'frauen-app-encrypted-backup',version:1,algorithm:'AES-256-GCM',kdf:'PBKDF2-SHA256',iterations:310000,salt:toB64(salt),iv:toB64(iv),data:toB64(cipher),created:new Date().toISOString()};return new File([JSON.stringify(envelope)],'frauen-app-verschluesselt-'+new Date().toISOString().slice(0,10)+'.fbackup',{type:'application/octet-stream'})}
function saveBackup(file){const url=URL.createObjectURL(file);const a=document.createElement('a');a.href=url;a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000)}
async function backup(){const file=await encryptedBackupFile();saveBackup(file);notify('Verschlüsseltes Backup heruntergeladen')}
async function shareDriveBackup(){const file=await encryptedBackupFile();if(navigator.share&&navigator.canShare&&navigator.canShare({files:[file]})){try{await navigator.share({files:[file],title:'Frauen-App verschlüsselte Sicherung'});notify('Verschlüsselte Sicherung geteilt');return}catch(err){if(err.name==='AbortError'){notify('Teilen abgebrochen');return;}}}saveBackup(file);notify('Verschlüsselte Datei herunterladen und in Drive hochladen')}
async function readBackup(file){if(file.size>BACKUP_LIMIT*2)throw Error('Sicherungsdatei zu groß');let raw=JSON.parse(await file.text());if(raw.format==='frauen-app-backup'){if(!confirm('WARNUNG: Das ist ein ALTES, UNVERSCHLÜSSELTES Backup. Nur aus vertrauenswürdiger Quelle importieren. Fortsetzen?'))throw Error('Import abgebrochen');return raw}if(raw.format!=='frauen-app-encrypted-backup'||raw.version!==1||raw.algorithm!=='AES-256-GCM'||raw.kdf!=='PBKDF2-SHA256'||raw.iterations!==310000)throw Error('Unbekanntes verschlüsseltes Backup');const salt=fromB64(raw.salt),iv=fromB64(raw.iv),bytes=fromB64(raw.data);if(salt.length!==16||iv.length!==12||bytes.length>BACKUP_LIMIT+32)throw Error('Ungültige Verschlüsselungsparameter');const password=prompt('Sicherungspasswort eingeben:');if(password===null)throw Error('Import abgebrochen');try{const key=await passwordKey(password,salt);const clear=await crypto.subtle.decrypt({name:'AES-GCM',iv},key,bytes);return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(clear))}catch(e){throw Error('Entschlüsselung fehlgeschlagen: Passwort falsch oder Datei beschädigt')}}
async function restore(file){if(!file)return;if(!confirm('Achtung: Alle derzeitigen Einträge und Bilder werden durch dieses Backup ersetzt. Hast du zuvor eine Sicherung erstellt?'))return;let raw=await readBackup(file);if(raw.format!=='frauen-app-backup'||raw.version!==1||!Array.isArray(raw.entries)||!Array.isArray(raw.photos))throw Error('Unbekanntes Backup-Format');if(raw.entries.length>50000||raw.photos.length>50000)throw Error('Backup zu groß');const ids=new Set();for(const e of raw.entries){if(!e||typeof e.id!=='string'||!e.id||typeof e.date!=='string'||!/^\d{4}-\d{2}-\d{2}T/.test(e.date)||typeof e.category!=='string'||!e.category||ids.has(e.id))throw Error('Ungültiger oder doppelter Eintrag');ids.add(e.id)}const photoIds=new Set();for(const p of raw.photos){if(!p||typeof p.id!=='string'||!p.id||photoIds.has(p.id)||typeof p.entryId!=='string'||!ids.has(p.entryId)||typeof p.blob!=='string'||!/^data:image\/(png|jpeg|webp|gif);base64,/.test(p.blob))throw Error('Ungültige Fotoangaben');photoIds.add(p.id)}const newPhotos=await Promise.all(raw.photos.map(async p=>{const response=await fetch(p.blob);const blob=await response.blob();if(blob.size>20*1024*1024)throw Error('Foto im Backup zu groß');return {...p,blob}}));const encryptedEntries=await Promise.all(raw.entries.map(e=>packRecord('entries',e)));const encryptedPhotos=[];for(const p of newPhotos)encryptedPhotos.push(await packRecord('photos',p));await new Promise((ok,no)=>{let tx=db.transaction(['entries','photos'],'readwrite');tx.objectStore('entries').clear();tx.objectStore('photos').clear();for(const e of encryptedEntries)tx.objectStore('entries').put(e);for(const p of encryptedPhotos)tx.objectStore('photos').put(p);tx.oncomplete=()=>ok();tx.onerror=()=>no(tx.error);tx.onabort=()=>no(tx.error||Error('Import abgebrochen'))});notify('Backup wiederhergestellt');render()}
async function render(){buttons();$('view').innerHTML=page==='home'?home():page==='diary'?await diary():page==='calendar'?await calendar():page==='learn'?learn():page==='selfcheck'?selfcheckPage():page==='illness'?illnessPage():records();$('view').querySelectorAll('[data-link]').forEach(b=>b.onclick=()=>goto(b.dataset.link));bindLightbox();if($('quick'))$('quick').onclick=async()=>{await goto('diary');showForm()};if(page==='selfcheck'){if($('open-all-guides'))$('open-all-guides').onclick=()=>document.querySelectorAll('details.guide').forEach(d=>d.open=true);if($('close-all-guides'))$('close-all-guides').onclick=()=>document.querySelectorAll('details.guide').forEach(d=>d.open=false);$('new-selfcheck').onclick=()=>startSpecial('Gemeinsame Selbstkontrolle');$('new-labcheck').onclick=()=>startSpecial('Abstrich / Laboruntersuchung');document.querySelectorAll('[data-checktopic]').forEach(b=>b.onclick=()=>startSpecial('Gemeinsame Selbstkontrolle','checkArea',b.dataset.checktopic))}if(page==='illness'){$('new-illness').onclick=()=>startSpecial('Krankheit / Allgemeinsymptome');document.querySelectorAll('[data-illness]').forEach(b=>b.onclick=()=>startSpecial('Krankheit / Allgemeinsymptome','illnessType',b.dataset.illness))}if(page==='diary'){const entries=await all('entries');$('new-entry').onclick=()=>showForm();$('filter').onchange=()=>{
   const selVal=$('filter').value;
   const filtered=entries.filter(e=>selVal.startsWith('Alle Kategorien')||e.category===selVal).sort((a,b)=>b.date.localeCompare(a.date));
   $('entry-list').innerHTML=entryRows(filtered);
   if($('entries-count-text'))$('entries-count-text').textContent=filtered.length+(filtered.length===1?' Eintrag':' Einträge')+' gefunden';
   bindEntryButtons();
  };bindEntryButtons()}if(page==='calendar'){
 bindEntryButtons();
 $('prev').onclick=()=>shiftMonth(-1);
 $('next').onclick=()=>shiftMonth(1);
 if($('cal-new-entry'))$('cal-new-entry').onclick=async()=>{await goto('diary');showForm();if($('entry-date'))$('entry-date').value=selectedDay+'T12:00';};
 document.querySelectorAll('[data-day]').forEach(b=>b.onclick=()=>{selectedDay=b.dataset.day;render();});
}if(page==='learn'){
 // If in topic view
 if(selectedTopic){
  if($('topic-back-btn'))$('topic-back-btn').onclick=()=>{ selectedTopic=null; render(); };
  if($('open-all-topic'))$('open-all-topic').onclick=()=>document.querySelectorAll('#deep-lessons details, #lessons details').forEach(d=>d.open=true);
  if($('close-all-topic'))$('close-all-topic').onclick=()=>document.querySelectorAll('#deep-lessons details, #lessons details').forEach(d=>d.open=false);
  
  // Bind completion checkboxes in topic view
  document.querySelectorAll('.deep-complete').forEach(c=>c.onchange=()=>{
   localStorage.setItem('frauen-app-lesson-done-'+c.dataset.deep, c.checked?'1':'0');
   const card = c.closest('details.deep-lesson');
   if(card){
    card.classList.toggle('is-completed', c.checked);
    const meta = card.querySelector('.summary-meta');
    if(meta){
     const donePill = meta.querySelector('.done-pill');
     if(c.checked && !donePill){ meta.insertAdjacentHTML('beforeend','<span class="pill done-pill">✓ Gelernt</span>'); }
     else if(!c.checked && donePill){ donePill.remove(); }
    }
   }
  });
 } else {
  // If in topics grid view: bind click on cards
  document.querySelectorAll('[data-topic]').forEach(b=>{
   b.onclick=()=>{
    selectedTopic = b.dataset.topic;
    render();
    window.scrollTo(0,0);
   };
  });
 }
}
if(page==='records'){$('open-record-form').onclick=async()=>{await goto('diary');showForm('Frauenarzttermin')};$('export').onclick=()=>backup().catch(err=>notify('Backup: '+err.message));$('drive-share').onclick=()=>shareDriveBackup().catch(err=>notify('Drive-Sicherung: '+err.message));$('restore').onchange=async e=>{try{await restore(e.target.files[0])}catch(err){notify('Importfehler: '+err.message)}};$('record-update').onclick=checkUpdate;$('clear-all').onclick=async()=>{if(!confirm('ALLE lokalen Gesundheitsdaten und Bilder unwiderruflich löschen?'))return;await Promise.all(['entries','photos'].map(async name=>{for(const v of await all(name))await del(name,v.id)}));notify('Alle Daten gelöscht');render()}}}
function bindLightbox(){
 const lb=$('lightbox');if(!lb)return;
 const close=()=>{lb.classList.remove('open');$('lb-img').src='';};
 $('lb-close').onclick=close;
 lb.onclick=e=>{if(e.target===lb)close();};
 document.querySelectorAll('.medical-figure').forEach(fig=>{
  fig.onclick=e=>{
   e.stopPropagation();
   const img=fig.querySelector('img'),cap=fig.querySelector('figcaption');
   if(!img)return;
   $('lb-img').src=img.src;
   $('lb-img').alt=img.alt||'Schautafel';
   $('lb-title').textContent=img.alt||'Medizinische Schautafel';
   $('lb-caption').textContent=(cap?cap.textContent.replace('🔍 Antippen zum Vergrößern (Vollbild)','').trim():'');
   lb.classList.add('open');
  };
 });
}
function bindEntryButtons(){document.querySelectorAll('[data-open]').forEach(b=>b.onclick=async()=>{if(page!=='diary')await goto('diary');await openEntry(b.dataset.open)});document.querySelectorAll('[data-edit]').forEach(b=>b.onclick=async()=>{editing=(await all('entries')).find(e=>e.id===b.dataset.edit);if(page!=='diary')await goto('diary',{preserveEdit:true});showForm()});document.querySelectorAll('[data-delete]').forEach(b=>b.onclick=()=>confirmAndDeleteEntry(b.dataset.delete))}
async function startSpecial(category,field,value){await goto('diary');showForm(category);if(field&&$('entry-form').elements[field])$('entry-form').elements[field].value=value}
function showForm(category){$('form-holder').innerHTML=diaryForm();formBind();if(category){$('category').value=category;$('category').onchange()};$('form-holder').scrollIntoView({behavior:'smooth',block:'start'})}
function shiftMonth(delta){let d=new Date(selectedDay+'T12:00');d.setDate(1);d.setMonth(d.getMonth()+delta);selectedDay=[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),'01'].join('-');render()}
function hasPendingInput(){return !!document.querySelector('#entry-form')}
async function checkUpdate(silent=false){
 const status=$('update-state');
 if(updatingNow)return;
 if(!navigator.onLine){status.textContent='Offline';return;}
 if(!silent)status.textContent='Prüfe…';
 try{
  const u=new URL('./version.json',location.href);
  u.searchParams.set('force_ts',String(Date.now()));
  const res=await fetch(u.href,{cache:'no-store'});
  if(!res.ok)throw Error('Versionsdatei nicht erreichbar');
  const info=await res.json();
  const build=Number(info.build||1);
  if(info.version!==APP_VERSION||build>APP_BUILD){
   status.textContent='Neu: v'+info.version;
   if(hasPendingInput()){if(!silent)notify('Erst Eingabe speichern oder schließen, dann Update starten');return;}
   updatingNow=true;
   status.textContent='Installiere…';
   notify('Neue Version v'+info.version+' gefunden – Cache wird bereinigt');
   try{
    if('serviceWorker' in navigator){
     const regs=await navigator.serviceWorker.getRegistrations();
     for(const r of regs){ await r.unregister(); }
    }
    if('caches' in window){
     const keys=await caches.keys();
     await Promise.all(keys.map(k=>caches.delete(k)));
    }
   }catch(e){}
   const next=new URL('./index.html',location.href);
   next.searchParams.set('v_fresh',info.version+'-'+build);
   next.searchParams.set('ts',String(Date.now()));
   setTimeout(()=>{ location.replace(next.href); },300);
  }else{
   status.textContent='Aktuell';
   if(!silent)notify('Version v'+APP_VERSION+' (Build '+APP_BUILD+') ist aktuell');
  }
 }catch(e){
  status.textContent='Prüffehler';
  if(!silent)notify('Update-Prüfung: Bitte Internetverbindung prüfen');
 }
}
async function init(){
 try{
  if('serviceWorker' in navigator){
   const regs=await navigator.serviceWorker.getRegistrations();
   for(const r of regs){
    if(r.active && !r.active.scriptURL.includes('build20')){
     await r.unregister();
    }
   }
  }
 }catch(e){}try{db=await openDB();await unlockLocal();$('update').onclick=()=>checkUpdate();$('version').textContent='v'+APP_VERSION;await render();if('serviceWorker' in navigator && location.protocol==='https:'){navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).then(()=>{navigator.serviceWorker.addEventListener('controllerchange',()=>{/* App navigiert nach eigener Versionsprüfung; kein zweites Neuladen */})}).catch(()=>{});}setTimeout(()=>checkUpdate(true),2000);setInterval(()=>checkUpdate(true),5*60*1000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)checkUpdate(true)})}catch(err){const message=err?.message||'Unbekannter Fehler';const recoverable=/Mindestens 12 Zeichen|Passwörter stimmen nicht|Entsperren abgebrochen|Einrichtung abgebrochen|Datenpasswort falsch/.test(message);$('view').innerHTML='<div class="card"><h2>Lokale Daten '+(recoverable?'noch gesperrt':'nicht verfügbar')+'</h2><div class="warning">'+esc(message)+'</div><p class="muted">'+(recoverable?'Deine vorhandenen Daten wurden dadurch nicht gelöscht. Wähle ein Datenpasswort mit mindestens 12 Zeichen und wiederhole die Eingabe.':'Bitte nicht die Website-Daten oder den Browsercache löschen. Falls du bereits ein Backup hast, bewahre es auf.')+'</p><button class="primary" id="retry-unlock">'+'Passworteingabe erneut öffnen'+'</button></div>';const retry=$('retry-unlock');if(retry)retry.onclick=()=>{retry.disabled=true;init()};}}
init();
