'use strict';
const APP_VERSION='0.1.8.5', APP_BUILD=9, DB='frauen-app-beta', DB_VERSION=2;
const $=id=>document.getElementById(id), esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const categories=['Periode','Zwischenblutung','Ausfluss','Flüssigkeitsverlust','Sexualität','Kinderwunsch','Zervixschleim / Eisprung','Basaltemperatur','Schwangerschaftstest','Schmerzen','Brustveränderung','Vulva / Scheide','WC / Ausscheidung','Wohlbefinden','Schwangerschaft','Kindsbewegungen / Wehen','Frauenarzttermin','Abstrich / Laboruntersuchung','Geburt / Wochenbett','Gemeinsame Selbstkontrolle','Krankheit / Allgemeinsymptome'];
let updatingNow=false,db,page='home',selectedDay=[new Date().getFullYear(),String(new Date().getMonth()+1).padStart(2,'0'),String(new Date().getDate()).padStart(2,'0')].join('-'),reloadOnce=false,editing=null;
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
const illnessTypes=['Fieber / erhöhte Temperatur','Husten','Durchfall','Erbrechen','Schnupfen','Halsschmerzen','Kopfschmerzen','Harnwegsbeschwerden','Sonstige Erkrankung / Beschwerden'];
function illnessPage(){return `<h2>Krankheiten & Symptome</h2><p class="muted">Erkrankungen dokumentieren und zeitlich mit Zyklus- oder Schwangerschaftseinträgen vergleichen. Einträge ersetzen keine medizinische Einschätzung.</p><div class="card"><h3>Krankheit erfassen</h3><p class="muted">Beginn, Dauer, Intensität, Körpertemperatur, Messmethode, Symptome und Medikamente erfassen.</p><button class="primary" id="new-illness">＋ Krankheits-Eintrag</button></div><div class="warning"><strong>Schwangerschaft:</strong> Fieber, starke Beschwerden oder Beschwerden beim Wasserlassen zeitnah ärztlich abklären. Bei schwerem Krankheitsgefühl, Atemnot oder anderen akuten Warnzeichen sofort medizinische Hilfe holen.</div><h3>Typische Symptome</h3>${illnessTypes.map(name=>`<button class="link-btn" data-illness="${esc(name)}">＋ ${esc(name)}</button>`).join('')}`}
function extraFields(category){if(category==='Abstrich / Laboruntersuchung')return `<div class="detailfields"><h3>Abstrich und Labor – Dokumentation</h3><label>Art des Tests</label><select name="testType">${optionHTML(['HPV-Selbsttest (validiertes Testset)','PAP-Zytologie (ärztliche Entnahme)','Vaginaler Erregerabstrich','Andere Laboruntersuchung'])}</select><label>Wer hat die Probe entnommen?</label><select name="sampleBy">${optionHTML(['Ärztin / Arzt','Patientin mit geeignetem Selbsttestset','Andere / nicht geklärt'])}</select><label>Hersteller / Testkit / Chargennummer</label><input name="testKit" placeholder="Genaue Bezeichnung laut Verpackung"><label>Labor / Arztpraxis</label><input name="labName" placeholder="Name und Kontakt"><label>Probenabgabe / Versand am</label><input name="sentAt" type="date"><label>Laborbefund / Ergebnis</label><select name="testResult">${optionHTML(['Ergebnis ausständig','Negativ / unauffällig – laut Befund','Positiv / auffällig – laut Befund','Ungültig / Probe nicht verwertbar','Sonstiges'])}</select><label>Datum Befundeingang</label><input name="resultAt" type="date"><label>Ärztlicher Kontrolltermin</label><input name="followUp" type="date"><label>Ausführlicher Befund / Fragen</label><textarea name="labDetail" placeholder="Befund wortgetreu dokumentieren; keine Eigendiagnose"></textarea><p class="fine">Nur geeignete, vom Labor akzeptierte Selbsttestsets nach Herstelleranleitung verwenden. Ein HPV-Selbsttest ersetzt nicht pauschal PAP-Zytologie oder frauenärztliche Untersuchung.</p></div>`;if(category==='Krankheit / Allgemeinsymptome')return `<div class="detailfields"><h3>Angaben zur Erkrankung</h3><label>Art der Erkrankung / Symptom</label><select name="illnessType">${optionHTML(['Nicht zugeordnet',...illnessTypes])}</select><label>Beginn der Beschwerden</label><input type="datetime-local" name="illnessStart"><label>Ende (optional)</label><input type="datetime-local" name="illnessEnd"><label>Temperatur in °C (optional)</label><input name="temperature" type="number" min="30" max="45" step="0.1" placeholder="z. B. 38,2"><label>Temperatur-Messmethode</label><select name="tempMethod">${optionHTML(['Nicht angegeben','Ohr','Mund','Achsel','Rektal','Stirn'])}</select><label>Häufigkeit / Episoden</label><input name="frequency" placeholder="z. B. 3-mal heute"><label>Weitere Symptome / Medikamente</label><textarea name="illnessDetails" placeholder="Medikament, Dosierung, Wirkung, weitere Symptome ..."></textarea></div>`;if(category==='Gemeinsame Selbstkontrolle'||category==='Selbstkontrolle')return `<div class="detailfields"><h3>Angaben zur Gemeinsame Selbstkontrolle</h3><label>Beobachteter Bereich</label><select name="checkArea">${optionHTML(['Nicht zugeordnet',...selfcheckTopics.map(t=>t[0])])}</select><label>Beobachtungsmethode</label><select name="checkMethod">${optionHTML(['Ansehen','Äußerliches vorsichtiges Abtasten','Spekulum-Einstellung (Portio / Periode)','Vaginale Tastuntersuchung (NFP / Muttermund)','Messung mit Thermometer','Beobachtung an Kleidung/Toilettenpapier','Andere Beobachtung'])}</select><label>Veränderung seit letzter Beobachtung</label><select name="change">${optionHTML(['Unbekannt','Keine Veränderung','Neu aufgetreten','Verstärkt','Weniger geworden'])}</select><label>Fragen für den Frauenarzt</label><textarea name="doctorQuestions" placeholder="Was soll ärztlich abgeklärt werden?"></textarea><p class="fine">Keine invasiven vaginalen Untersuchungen oder ärztliche Diagnosen selbst durchführen.</p></div>`;return ''}
function diaryForm(){let edit=editing;return `<div class="card"><div class="row"><h3>${edit?'Eintrag bearbeiten':'Neue Beobachtung'}</h3><button class="secondary" id="close-form">Schließen</button></div><form id="entry-form"><label>Kategorie</label><select name="category" id="category">${optionHTML(categories)}</select><div id="category-extra"></div><label>Datum & Uhrzeit</label><input type="datetime-local" name="date" id="entry-date" required><label>Quelle</label><select name="source"><option>Eigene Beobachtung</option><option>Von ihr berichtet</option><option>Ärztlich mitgeteilt</option><option>Schriftlich ärztlich bestätigt</option><option>Ungeklärt</option></select><label>Stärke / Menge</label><select name="amount"><option>Unbekannt / nicht erfasst</option><option>Keine</option><option>Wenig</option><option>Mittel</option><option>Viel</option></select><label>Farbe</label><select name="color"><option>Nicht angegeben</option><option>Klar</option><option>Weiß</option><option>Gelblich</option><option>Grünlich</option><option>Rosa</option><option>Rot</option><option>Braun</option><option>Andere</option></select><label>Konsistenz</label><select name="texture"><option>Nicht angegeben</option><option>Wässrig</option><option>Cremig</option><option>Dick</option><option>Klumpig</option><option>Spinnbar</option><option>Anders</option></select><label>Schmerzstärke 0–10 (optional)</label><input name="pain" type="number" min="0" max="10" placeholder="Nicht angegeben"><label>Beschreibung / Beobachtung</label><textarea name="note" placeholder="Was wurde festgestellt? Wann? Wiederholt? Begleitbeschwerden?"></textarea><label>Fotos hinzufügen (mehrere möglich)</label><input id="photos-input" type="file" accept="image/*" multiple><div class="fine">Bei Bearbeitung bleiben bestehende Fotos erhalten; neue Fotos werden ergänzt.</div><div id="photos-preview" class="images"></div><div class="warning" id="form-alert">Bei möglichem Fruchtwasserverlust in einer Schwangerschaft sofort die Klinik kontaktieren – keine App- oder Fotodiagnose.</div><button class="primary" type="submit">Eintrag speichern</button></form></div>`}
async function diary(){const entries=(await all('entries')).sort((a,b)=>b.date.localeCompare(a.date));return `<div class="row"><h2>Tagebuch</h2><button class="secondary" id="new-entry">＋ Neu</button></div><p class="muted">Beobachtungen mit Fotos erfassen und später bearbeiten.</p><div id="form-holder"></div><label>Einträge filtern</label><select id="filter"><option>Alle Kategorien</option>${optionHTML(categories)}</select><div class="entries" id="entry-list">${entryRows(entries)}</div>`}
function entryRows(entries){return entries.map(e=>`<div class="entry"><div class="row"><strong>${esc(e.category)}</strong><small>${esc(new Date(e.date).toLocaleString('de-AT'))}</small></div><p class="muted">${esc(e.note||'Keine Beschreibung')}</p><small>${esc(e.source)} · ${esc(e.amount)}</small><div class="row wrap" style="margin-top:9px"><button class="secondary" data-open="${esc(e.id)}">Details / Fotos</button><button class="secondary" data-edit="${esc(e.id)}">Bearbeiten</button><button class="danger" data-delete="${esc(e.id)}" aria-label="Eintrag löschen" title="Eintrag löschen">🗑 Löschen</button></div></div>`).join('')||'<div class="card muted">Noch keine Einträge.</div>'}
async function photoCards(id){const photos=(await all('photos')).filter(p=>p.entryId===id);return photos.map(p=>`<div class="photo-card"><img src="${URL.createObjectURL(p.blob)}" alt="Gespeichertes Foto"><button class="danger" data-delphoto="${esc(p.id)}">Foto löschen</button></div>`).join('')}
async function openEntry(id){let entry=(await all('entries')).find(x=>x.id===id);if(!entry)return;let photos=await photoCards(id);let holder=$('form-holder');holder.innerHTML=`<div class="card"><div class="row"><h3>${esc(entry.category)}</h3><button class="secondary" id="detail-close">Schließen</button></div><p class="muted">${esc(new Date(entry.date).toLocaleString('de-AT'))}</p><p>${esc(entry.note||'Keine Beschreibung')}</p><p class="muted">Quelle: ${esc(entry.source)} · Menge: ${esc(entry.amount)} · Farbe: ${esc(entry.color)} · Konsistenz: ${esc(entry.texture)} · Schmerz: ${esc(entry.pain||'–')}</p><div class="entry-extra">${Object.entries({illnessType:'Symptom',illnessStart:'Beginn',illnessEnd:'Ende',temperature:'Temperatur °C',tempMethod:'Messmethode',frequency:'Häufigkeit',illnessDetails:'Zusatzangaben',checkArea:'Bereich',checkMethod:'Methode',change:'Veränderung',doctorQuestions:'Fragen für Arzt'}).filter(([key])=>entry[key]).map(([key,label])=>`<p class="fine"><strong>${esc(label)}:</strong> ${esc(entry[key])}</p>`).join('')}</div><div class="grid">${photos}</div><button class="danger" id="delete-entry" style="margin-top:12px">Eintrag vollständig löschen</button></div>`;$('detail-close').onclick=()=>holder.innerHTML='';$('delete-entry').onclick=async()=>{if(!confirm('Eintrag inklusive Fotos unwiderruflich löschen?'))return;await removeEntryWithPhotos(id);notify('Eintrag gelöscht');render()};holder.querySelectorAll('[data-delphoto]').forEach(b=>b.onclick=async()=>{if(!confirm('Dieses Foto unwiderruflich löschen?'))return;await del('photos',b.dataset.delphoto);openEntry(id)});holder.scrollIntoView({behavior:'smooth',block:'start'})}
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
  let data=Object.fromEntries(new FormData(f).entries());
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
async function calendar(){let entries=await all('entries');let d=new Date(selectedDay+'T12:00:00');let year=d.getFullYear(),month=d.getMonth(),first=new Date(year,month,1),last=new Date(year,month+1,0),start=(first.getDay()+6)%7;let cells=Array(start).fill('<div></div>');for(let n=1;n<=last.getDate();n++){let date=`${year}-${String(month+1).padStart(2,'0')}-${String(n).padStart(2,'0')}`,count=entries.filter(e=>e.date.startsWith(date)).length;cells.push(`<button class="day ${date===selectedDay?'active':''}" data-day="${date}">${n}${count?`<br><small>● ${count}</small>`:''}</button>`)}let todays=entries.filter(e=>e.date.startsWith(selectedDay));return `<h2>Kalender</h2><div id="form-holder"></div><div class="card"><div class="row"><button class="secondary" id="prev">←</button><strong>${d.toLocaleDateString('de-AT',{month:'long',year:'numeric'})}</strong><button class="secondary" id="next">→</button></div><div class="week" style="margin:17px 0 6px">${['Mo','Di','Mi','Do','Fr','Sa','So'].map(x=>`<small style="text-align:center">${x}</small>`).join('')}</div><div class="week">${cells.join('')}</div></div><h3>Einträge am ${esc(new Date(selectedDay+'T12:00').toLocaleDateString('de-AT'))}</h3>${entryRows(todays)}<p class="footnote">Der Kalender zeigt dokumentierte Ereignisse. Eine medizinische Zyklusvorhersage ist in Beta 0.1 noch nicht enthalten.</p>`}
function learn(){const mods=[...new Set(lessons.map(l=>l.module))];return `<h2>Lernzentrum · Lehrbuch</h2><p class="muted">${DEEP_LESSONS.length} umfangreiche Praxis- und Fachlektionen, ${lessons.length} Grundlagenlektionen sowie ${SELF_GUIDES.length} illustrierte Kapitel unter „Gemeinsame Selbstkontrolle“. Suche, Lernstufen und Fortschritt bleiben lokal auf diesem Handy.</p><div class="warning"><strong>Sicherheit:</strong> Die Lernkartei erklärt sichere äußere Beobachtung und ärztliche Verfahren. Bei möglichem Fruchtwasserverlust oder Frühgeburtszeichen während einer Schwangerschaft sofort in die Geburtsklinik.</div><h3>Ausführliche Lehrbuchlektionen</h3><p class="footnote" id="deep-progress"></p><div id="deep-lessons">${DEEP_LESSONS.map(deepCard).join('')}</div><h3>Weitere 50 Grundlagenlektionen</h3><p class="muted">Diese älteren Kurzlektionen werden in künftigen Updates schrittweise vertieft.</p><label for="lesson-module">Lerngebiet</label><select id="lesson-module"><option value="">Alle Lerngebiete</option>${mods.map(m=>`<option value="${esc(m)}">${esc(m)}</option>`).join('')}</select><label for="search-lessons">Suche in Grundlagen</label><input id="search-lessons" placeholder="z. B. Muttermund, Hygiene, Ausfluss..." aria-label="Lektionen durchsuchen"><p id="lesson-count" class="footnote">${lessons.length} Grundlagenlektionen</p><div id="lessons">${lessonCards(lessons)}</div>`}
function deepCard(l,i){return `<details class="lesson deep-lesson" id="deep-${i}"><summary><span class="summary-row"><span class="lesson-ico">${esc(l.icon||"🎓")}</span><span class="summary-text"><span class="summary-meta"><span class="pill">${esc(l.module)}</span>${l.images?.length?`<span class="pill img-pill">🖼️ ${l.images.length} Tafeln</span>`:""}</span><strong>${esc(l.title)}</strong></span></span></summary><p class="footnote">Vertiefte Lernlektion · ${l.steps.length} Praxis- und Dokumentationsschritte</p>${l.images?l.images.map(im=>`<figure class="medical-figure"><img src="./${esc(im.src)}" alt="${esc(im.alt)}" loading="lazy"><figcaption>${esc(im.caption)}<br><span class="zoom-hint">🔍 Antippen zum Vergrößern (Vollbild)</span></figcaption></figure>`).join(''):l.image?`<figure class="medical-figure"><img src="./${esc(l.image)}" alt="${esc(l.alt||l.title)}" loading="lazy"><figcaption>${esc(l.caption||'')}</figcaption></figure>`:""}<h3>Einfach erklärt</h3><p>${esc(l.simple)}</p><h3>Fachwissen – vertieft</h3><p>${esc(l.expert)}</p><h3>Vorbereitung und Schritt für Schritt</h3><ol>${l.steps.map(x=>`<li>${esc(x)}</li>`).join('')}</ol><div class="warning"><strong>Praxishinweis &amp; Besonderheiten:</strong> ${esc(l.tip)}</div><p class="footnote"><a target="_blank" rel="noopener noreferrer" href="${esc(l.source)}">Weiterführende Fachquelle ↗</a></p><label><input class="checkbox deep-complete" type="checkbox" data-deep="${i}" ${localStorage.getItem('frauen-app-lesson-done-'+i)==='1'?'checked':''}> Lektion abgeschlossen</label></details>`}
function lessonCards(arr){return arr.map(l=>`<details class="lesson"><summary><span class="pill">${esc(l.module)}</span> ${esc(l.title)}</summary><p class="footnote">Grundlagenlektion – wird noch erweitert.</p><h3>Einfach erklärt</h3><p>${esc(l.simple)}</p><h3>Medizinisches Fachwissen</h3><p>${esc(l.expert)}</p><h3>Selbstbeobachtung / Dokumentation</h3><p>${esc(l.practice)}</p><div class="warning"><strong>Grenzen und Warnzeichen:</strong> ${esc(l.tip)}</div><p class="footnote"><a href="${esc(l.source)}" target="_blank" rel="noopener noreferrer">Fachquelle öffnen ↗</a></p></details>`).join('')||'<p>Keine Lektion gefunden.</p>'}
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
async function render(){buttons();$('view').innerHTML=page==='home'?home():page==='diary'?await diary():page==='calendar'?await calendar():page==='learn'?learn():page==='selfcheck'?selfcheckPage():page==='illness'?illnessPage():records();$('view').querySelectorAll('[data-link]').forEach(b=>b.onclick=()=>goto(b.dataset.link));bindLightbox();if($('quick'))$('quick').onclick=async()=>{await goto('diary');showForm()};if(page==='selfcheck'){if($('open-all-guides'))$('open-all-guides').onclick=()=>document.querySelectorAll('details.guide').forEach(d=>d.open=true);if($('close-all-guides'))$('close-all-guides').onclick=()=>document.querySelectorAll('details.guide').forEach(d=>d.open=false);$('new-selfcheck').onclick=()=>startSpecial('Gemeinsame Selbstkontrolle');$('new-labcheck').onclick=()=>startSpecial('Abstrich / Laboruntersuchung');document.querySelectorAll('[data-checktopic]').forEach(b=>b.onclick=()=>startSpecial('Gemeinsame Selbstkontrolle','checkArea',b.dataset.checktopic))}if(page==='illness'){$('new-illness').onclick=()=>startSpecial('Krankheit / Allgemeinsymptome');document.querySelectorAll('[data-illness]').forEach(b=>b.onclick=()=>startSpecial('Krankheit / Allgemeinsymptome','illnessType',b.dataset.illness))}if(page==='diary'){const entries=await all('entries');$('new-entry').onclick=()=>showForm();$('filter').onchange=()=>{$('entry-list').innerHTML=entryRows(entries.filter(e=>$('filter').value==='Alle Kategorien'||e.category===$('filter').value).sort((a,b)=>b.date.localeCompare(a.date)));bindEntryButtons()};bindEntryButtons()}if(page==='calendar'){bindEntryButtons();$('prev').onclick=()=>shiftMonth(-1);$('next').onclick=()=>shiftMonth(1);document.querySelectorAll('[data-day]').forEach(b=>b.onclick=()=>{selectedDay=b.dataset.day;render()})}if(page==='learn'){const updateProgress=()=>{$('deep-progress').textContent=DEEP_LESSONS.filter((_,i)=>localStorage.getItem('frauen-app-lesson-done-'+i)==='1').length+' von '+DEEP_LESSONS.length+' vertieften Lektionen abgeschlossen';};document.querySelectorAll('.deep-complete').forEach(c=>c.onchange=()=>{localStorage.setItem('frauen-app-lesson-done-'+c.dataset.deep,c.checked?'1':'0');updateProgress()});updateProgress();const filterLessons=()=>{const q=$('search-lessons').value.toLocaleLowerCase('de'),m=$('lesson-module').value;const filtered=lessons.filter(l=>(!m||l.module===m)&&[l.title,l.simple,l.expert,l.practice].some(t=>t.toLocaleLowerCase('de').includes(q)));$('lessons').innerHTML=lessonCards(filtered);$('lesson-count').textContent=filtered.length+' von '+lessons.length+' Lektionen';};$('search-lessons').oninput=filterLessons;$('lesson-module').onchange=filterLessons;}if(page==='records'){$('open-record-form').onclick=async()=>{await goto('diary');showForm('Frauenarzttermin')};$('export').onclick=()=>backup().catch(err=>notify('Backup: '+err.message));$('drive-share').onclick=()=>shareDriveBackup().catch(err=>notify('Drive-Sicherung: '+err.message));$('restore').onchange=async e=>{try{await restore(e.target.files[0])}catch(err){notify('Importfehler: '+err.message)}};$('record-update').onclick=checkUpdate;$('clear-all').onclick=async()=>{if(!confirm('ALLE lokalen Gesundheitsdaten und Bilder unwiderruflich löschen?'))return;await Promise.all(['entries','photos'].map(async name=>{for(const v of await all(name))await del(name,v.id)}));notify('Alle Daten gelöscht');render()}}}
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
  const u=new URL('./version.json',location.href);u.searchParams.set('check',String(Date.now()));
  const res=await fetch(u.href,{cache:'no-store'});
  if(!res.ok)throw Error('Versionsdatei nicht erreichbar');
  const info=await res.json();
  const build=Number(info.build||1);
  if(info.version!==APP_VERSION||build>APP_BUILD){
   status.textContent='Neu: '+info.version+' ('+build+')';
   if(hasPendingInput()){if(!silent)notify('Erst Eingabe speichern oder schließen, dann Update starten');return;}
   updatingNow=true;status.textContent='Aktualisiere…';
   notify('Neue Version wird geprüft und geladen');
   try{if('serviceWorker' in navigator){const reg=await navigator.serviceWorker.getRegistration();await reg?.update();}}catch(e){/* Navigation versucht Netzwerk-Update dennoch */}
   // Eine neue URL erzwingt eine neue Navigationsanfrage statt einer bloßen Wiederholung.
   // Der Service Worker verwendet network-first für Seiten und JavaScript.
   const next=new URL('./index.html',location.href);
   next.searchParams.set('app_update',info.version+'-'+build);
   next.searchParams.set('t',String(Date.now()));
   location.replace(next.href);
  }else{
   status.textContent='Aktuell';if(!silent)notify('Version '+APP_VERSION+' (Build '+APP_BUILD+') ist aktuell');
  }
 }catch(e){status.textContent='Prüfung fehlgeschlagen';if(!silent)notify('Update nicht prüfbar – Verbindung und GitHub-Dateien kontrollieren');}
}
async function init(){try{db=await openDB();await unlockLocal();$('update').onclick=()=>checkUpdate();$('version').textContent='v'+APP_VERSION;await render();if('serviceWorker' in navigator && location.protocol==='https:'){navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).then(()=>{navigator.serviceWorker.addEventListener('controllerchange',()=>{/* App navigiert nach eigener Versionsprüfung; kein zweites Neuladen */})}).catch(()=>{});}setTimeout(()=>checkUpdate(true),2000);setInterval(()=>checkUpdate(true),5*60*1000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)checkUpdate(true)})}catch(err){const message=err?.message||'Unbekannter Fehler';const recoverable=/Mindestens 12 Zeichen|Passwörter stimmen nicht|Entsperren abgebrochen|Einrichtung abgebrochen|Datenpasswort falsch/.test(message);$('view').innerHTML='<div class="card"><h2>Lokale Daten '+(recoverable?'noch gesperrt':'nicht verfügbar')+'</h2><div class="warning">'+esc(message)+'</div><p class="muted">'+(recoverable?'Deine vorhandenen Daten wurden dadurch nicht gelöscht. Wähle ein Datenpasswort mit mindestens 12 Zeichen und wiederhole die Eingabe.':'Bitte nicht die Website-Daten oder den Browsercache löschen. Falls du bereits ein Backup hast, bewahre es auf.')+'</p><button class="primary" id="retry-unlock">'+'Passworteingabe erneut öffnen'+'</button></div>';const retry=$('retry-unlock');if(retry)retry.onclick=()=>{retry.disabled=true;init()};}}
init();
