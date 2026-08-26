const placementCore = require(`${__hooks}/placement_core.js`)
const listeningCore = require(`${__hooks}/placement_listening_core.js`)
const listeningBank = require(`${__hooks}/placement_bank_listening.js`)

function noStore(e) { e.response.header().set('Cache-Control', 'no-store') }
function privateNoStore(e) { e.response.header().set('Cache-Control', 'private, no-store') }
function requestBody(e) {
  const raw = toString(e.request.body || '').trim(); if (!raw) return {}
  try { const parsed = JSON.parse(raw); if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('invalid'); return parsed }
  catch { throw new BadRequestError('El cuerpo de la solicitud no es JSON válido.') }
}
function requireAdmin(e) {
  if (!e.auth) throw new UnauthorizedError('Debes iniciar sesión para administrar Listening.')
  if (e.auth.getString('role') !== 'ADMIN') throw new ForbiddenError('Solo Administración puede gestionar Listening.')
  return e.auth
}
function cleanText(value, max) { const text = typeof value === 'string' ? value.trim() : ''; if (text.length > max) throw new BadRequestError('El texto supera la longitud permitida.'); return text }
function jsonField(record, field, fallback) {
  const raw = record.get(field); if (raw === null || raw === undefined) return fallback
  try { const text = toString(raw); if (text) return JSON.parse(text) } catch {}
  try { return JSON.parse(JSON.stringify(raw)) } catch { return fallback }
}
function questionOptions(record) { const value = jsonField(record, 'options', []); return Array.isArray(value) ? value : [] }
function sortQuestions(records) { return records.slice().sort((a,b) => Number(a.get('admin_order')||0) - Number(b.get('admin_order')||0) || a.getString('code').localeCompare(b.getString('code'))) }
function testQuestions(app, testId) { return sortQuestions(app.findAllRecords('placement_questions').filter((record) => record.getString('test') === testId)) }
function requireTest(app, id) { if (!id) throw new BadRequestError('Falta la versión del test.'); try { return app.findRecordById('placement_tests', id) } catch { throw new BadRequestError('La versión del test no existe.') } }
function requireV2Draft(app, id) { const test = requireTest(app,id); if (test.getString('algorithm_version') !== listeningCore.ALGORITHM_VERSION) throw new BadRequestError('La versión no usa el motor Listening.'); if (test.getString('status') !== 'DRAFT') throw new BadRequestError('Solo una versión Listening DRAFT puede modificarse.'); return test }
function requireQuestion(app, id) { if (!id) throw new BadRequestError('Falta la pregunta.'); try { return app.findRecordById('placement_questions', id) } catch { throw new BadRequestError('La pregunta no existe.') } }
function requireListeningDraftQuestion(app, id) { const question=requireQuestion(app,id); if(question.getString('skill')!==listeningCore.LISTENING_SKILL) throw new BadRequestError('La pregunta no es de Listening.'); requireV2Draft(app,question.getString('test')); return question }
function validateVersion(value) { const version=cleanText(value,40); if(!/^[A-Za-z0-9][A-Za-z0-9._-]{1,39}$/.test(version)) throw new BadRequestError('La versión debe tener entre 2 y 40 caracteres y usar solo letras, números, punto, guion o guion bajo.'); return version }
function ensureUniqueVersion(app, version) { if(app.findAllRecords('placement_tests').some((record)=>record.getString('version')===version)) throw new BadRequestError('Ya existe una versión con ese identificador.') }
function ensureUniqueCode(app,testId,code,exceptId){ if(app.findAllRecords('placement_questions').some((record)=>record.getString('test')===testId&&record.getString('code')===code&&record.id!==exceptId)) throw new BadRequestError('Ya existe una pregunta con ese código en esta versión.') }

function listeningQuestionDto(record) { return { id:record.id,testId:record.getString('test'),code:record.getString('code'),skill:record.getString('skill'),cefrLevel:record.getString('cefr_level'),prompt:record.getString('prompt'),passage:record.getString('passage'),options:questionOptions(record),correctOptionId:record.getString('correct_option_id'),internalExplanation:record.getString('internal_explanation'),weight:Number(record.get('weight')||1),active:record.getBool('active'),adminOrder:Number(record.get('admin_order')||0),hasAudio:Boolean(record.getString('audio')),audioName:record.getString('audio') } }

function normalizedListeningQuestion(body,current){
  const code=body.code!==undefined?cleanText(body.code,100):current?current.getString('code'):''
  const level=body.cefrLevel!==undefined?cleanText(body.cefrLevel,2).toUpperCase():current?current.getString('cefr_level'):''
  const prompt=body.prompt!==undefined?cleanText(body.prompt,12000):current?current.getString('prompt'):''
  const passage=body.passage!==undefined?cleanText(body.passage,30000):current?current.getString('passage'):''
  const explanation=body.internalExplanation!==undefined?cleanText(body.internalExplanation,20000):current?current.getString('internal_explanation'):''
  const weight=body.weight!==undefined?Number(body.weight):current?Number(current.get('weight')||1):1
  const active=body.active!==undefined?Boolean(body.active):current?current.getBool('active'):true
  const adminOrder=body.adminOrder!==undefined?Number(body.adminOrder):current?Number(current.get('admin_order')||0):0
  if(!/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(code)) throw new BadRequestError('Código de pregunta no válido.')
  if(!placementCore.LEVELS.includes(level)) throw new BadRequestError('Nivel MCER no válido.')
  if(!prompt) throw new BadRequestError('El enunciado es obligatorio.')
  if(!passage) throw new BadRequestError('Listening necesita una transcripción interna para revisión académica.')
  if(!Number.isFinite(weight)||weight<=0||weight>100) throw new BadRequestError('El peso debe estar entre 0 y 100.')
  if(!Number.isInteger(adminOrder)||adminOrder<0||adminOrder>1000000) throw new BadRequestError('El orden no es válido.')
  let options=body.options!==undefined?body.options:current?questionOptions(current):[]
  if(!Array.isArray(options)||options.length<2||options.length>6) throw new BadRequestError('Cada pregunta debe tener entre 2 y 6 opciones.')
  const seen={}
  options=options.map((option)=>{ if(!option||typeof option!=='object'||Array.isArray(option)) throw new BadRequestError('Formato de opción no válido.'); const id=cleanText(option.id,20); const label=cleanText(option.label,500); if(!/^[A-Za-z0-9_-]{1,20}$/.test(id)||!label||seen[id]) throw new BadRequestError('Opciones de respuesta no válidas.'); seen[id]=true; return {id,label} })
  const correctOptionId=body.correctOptionId!==undefined?cleanText(body.correctOptionId,20):current?current.getString('correct_option_id'):''
  if(!seen[correctOptionId]) throw new BadRequestError('La respuesta correcta debe coincidir con una opción.')
  return {code,level,prompt,passage,explanation,weight,active,adminOrder,options,correctOptionId}
}
function applyListeningQuestion(record,input){ record.set('code',input.code); record.set('skill',listeningCore.LISTENING_SKILL); record.set('cefr_level',input.level); record.set('prompt',input.prompt); record.set('passage',input.passage); record.set('options',input.options); record.set('correct_option_id',input.correctOptionId); record.set('internal_explanation',input.explanation); record.set('weight',input.weight); record.set('active',input.active); record.set('admin_order',input.adminOrder) }

function validateV2(app,test){
  const errors=[]; const questions=testQuestions(app,test.id); const active=questions.filter((question)=>question.getBool('active'))
  const expectedPublic=listeningCore.blueprintQuestionCount(listeningCore.PUBLIC_BLUEPRINT); const expectedCampus=listeningCore.blueprintQuestionCount(listeningCore.CAMPUS_BLUEPRINT)
  if(test.getString('algorithm_version')!==listeningCore.ALGORITHM_VERSION) errors.push('La versión no usa cefr-v2-listening.')
  if(test.getInt('public_question_count')!==expectedPublic) errors.push(`Público debe contener ${expectedPublic} preguntas.`)
  if(test.getInt('campus_question_count')!==expectedCampus) errors.push(`Campus debe contener ${expectedCampus} preguntas.`)
  const required={}
  ;[...listeningCore.PUBLIC_BLUEPRINT,...listeningCore.CAMPUS_BLUEPRINT].forEach((cell)=>{ const key=`${cell.skill}:${cell.level}`; required[key]=Math.max(Number(required[key]||0),Number(cell.count||0)) })
  placementCore.LEVELS.forEach((level)=>{ required[`${listeningCore.LISTENING_SKILL}:${level}`]=4 })
  const available={}
  active.forEach((question)=>{
    const skill=question.getString('skill'); const level=question.getString('cefr_level')
    if(![...placementCore.SKILLS,listeningCore.LISTENING_SKILL].includes(skill)||!placementCore.LEVELS.includes(level)){ errors.push(`${question.getString('code')}: competencia o nivel no válido.`); return }
    const options=questionOptions(question); const ids=options.map((option)=>String(option&&option.id||''))
    if(options.length<2||new Set(ids).size!==ids.length||!ids.includes(question.getString('correct_option_id'))) errors.push(`${question.getString('code')}: opciones o respuesta correcta no válidas.`)
    if(!question.getString('prompt').trim()) errors.push(`${question.getString('code')}: falta el enunciado.`)
    if(skill===listeningCore.LISTENING_SKILL){ if(!question.getString('passage').trim()) errors.push(`${question.getString('code')}: falta la transcripción interna.`); if(!question.getString('audio')) return }
    const key=`${skill}:${level}`; available[key]=Number(available[key]||0)+1
  })
  const requirements=Object.keys(required).sort().map((key)=>{ const [skill,level]=key.split(':'); const needed=Number(required[key]||0); const count=Number(available[key]||0); if(count<needed) errors.push(`${skill} ${level}: faltan ${needed-count} pregunta(s) activa(s)${skill===listeningCore.LISTENING_SKILL?' con audio':''}.`); return {skill,level,required:needed,available:count,ready:count>=needed} })
  return {ready:errors.length===0,errors:[...new Set(errors)],requirements,questionCount:questions.length,activeQuestionCount:active.length,listeningCount:questions.filter((q)=>q.getString('skill')===listeningCore.LISTENING_SKILL).length,listeningWithAudio:questions.filter((q)=>q.getString('skill')===listeningCore.LISTENING_SKILL&&q.getString('audio')).length}
}

function cloneQuestion(txApp,source,targetTestId,copyAudio){
  const record=new Record(txApp.findCollectionByNameOrId('placement_questions')); record.set('test',targetTestId); record.set('code',source.getString('code')); record.set('skill',source.getString('skill')); record.set('cefr_level',source.getString('cefr_level')); record.set('prompt',source.getString('prompt')); record.set('passage',source.getString('passage')); record.set('options',questionOptions(source)); record.set('correct_option_id',source.getString('correct_option_id')); record.set('internal_explanation',source.getString('internal_explanation')); record.set('weight',Number(source.get('weight')||1)); record.set('active',source.getBool('active')); record.set('admin_order',Number(source.get('admin_order')||0))
  const audioName=copyAudio?source.getString('audio'):''
  if(!audioName){ txApp.save(record); return }
  let fs=null
  try{ fs=txApp.newFilesystem(); const file=fs.getReuploadableFile(`${source.baseFilesPath()}/${audioName}`,true); record.set('audio',file); txApp.save(record) } finally { if(fs) fs.close() }
}
function addListeningBank(txApp,testId,startOrder){ const collection=txApp.findCollectionByNameOrId('placement_questions'); listeningBank.forEach((item,index)=>{ const record=new Record(collection); record.set('test',testId); record.set('code',item.code); record.set('skill',listeningCore.LISTENING_SKILL); record.set('cefr_level',item.level); record.set('prompt',item.prompt); record.set('passage',item.passage); record.set('options',item.options); record.set('correct_option_id',item.correct); record.set('internal_explanation',item.explanation||''); record.set('weight',1); record.set('active',true); record.set('admin_order',startOrder+index+1); txApp.save(record) }) }

function createVersion(e){
  noStore(e); const admin=requireAdmin(e); const body=requestBody(e); const sourceId=cleanText(body.sourceTestId,40); const name=cleanText(body.name,180); const version=validateVersion(body.version)
  if(!sourceId||!name) throw new BadRequestError('Selecciona una versión de origen e indica nombre y versión.')
  ensureUniqueVersion(e.app,version); const source=requireTest(e.app,sourceId); const sourceAlgorithm=source.getString('algorithm_version')
  if(sourceAlgorithm!=='cefr-v1'&&sourceAlgorithm!==listeningCore.ALGORITHM_VERSION) throw new BadRequestError('La versión de origen no se puede preparar para Listening.')
  let createdId=''
  e.app.runInTransaction((txApp)=>{ const txSource=txApp.findRecordById('placement_tests',source.id); const record=new Record(txApp.findCollectionByNameOrId('placement_tests')); record.set('name',name); record.set('version',version); record.set('status','DRAFT'); record.set('algorithm_version',listeningCore.ALGORITHM_VERSION); record.set('public_question_count',listeningCore.blueprintQuestionCount(listeningCore.PUBLIC_BLUEPRINT)); record.set('campus_question_count',listeningCore.blueprintQuestionCount(listeningCore.CAMPUS_BLUEPRINT)); record.set('public_blueprint',listeningCore.PUBLIC_BLUEPRINT); record.set('campus_blueprint',listeningCore.CAMPUS_BLUEPRINT); record.set('campus_retake_days',txSource.getInt('campus_retake_days')); record.set('published_at',''); record.set('created_by',admin.id); txApp.save(record); createdId=record.id; const sourceQuestions=testQuestions(txApp,txSource.id); sourceQuestions.forEach((question)=>cloneQuestion(txApp,question,record.id,sourceAlgorithm===listeningCore.ALGORITHM_VERSION)); if(sourceAlgorithm==='cefr-v1') addListeningBank(txApp,record.id,sourceQuestions.length) })
  const created=e.app.findRecordById('placement_tests',createdId); return e.json(201,{testId:created.id,algorithmVersion:created.getString('algorithm_version'),validation:validateV2(e.app,created)})
}
function status(e){ noStore(e); requireAdmin(e); const test=requireTest(e.app,String(e.request.pathValue('id')||'')); if(test.getString('algorithm_version')!==listeningCore.ALGORITHM_VERSION) throw new BadRequestError('La versión no usa Listening.'); const listeningQuestions=testQuestions(e.app,test.id).filter((q)=>q.getString('skill')===listeningCore.LISTENING_SKILL).map(listeningQuestionDto); return e.json(200,{testId:test.id,validation:validateV2(e.app,test),listeningQuestions}) }
function createQuestion(e){ noStore(e); requireAdmin(e); const test=requireV2Draft(e.app,String(e.request.pathValue('id')||'')); const input=normalizedListeningQuestion(requestBody(e),null); ensureUniqueCode(e.app,test.id,input.code,''); const record=new Record(e.app.findCollectionByNameOrId('placement_questions')); record.set('test',test.id); applyListeningQuestion(record,input); e.app.save(record); return e.json(201,{question:listeningQuestionDto(record),validation:validateV2(e.app,test)}) }
function updateQuestion(e){ noStore(e); requireAdmin(e); const question=requireListeningDraftQuestion(e.app,String(e.request.pathValue('id')||'')); const test=e.app.findRecordById('placement_tests',question.getString('test')); const input=normalizedListeningQuestion(requestBody(e),question); ensureUniqueCode(e.app,test.id,input.code,question.id); applyListeningQuestion(question,input); e.app.save(question); return e.json(200,{question:listeningQuestionDto(question),validation:validateV2(e.app,test)}) }
function uploadAudio(e){ noStore(e); requireAdmin(e); const question=requireListeningDraftQuestion(e.app,String(e.request.pathValue('id')||'')); const files=e.findUploadedFiles('audio'); if(!Array.isArray(files)||files.length!==1) throw new BadRequestError('Selecciona un único archivo de audio.'); question.set('audio',files[0]); e.app.save(question); const test=e.app.findRecordById('placement_tests',question.getString('test')); return e.json(200,{question:listeningQuestionDto(question),validation:validateV2(e.app,test)}) }
function deleteAudio(e){ noStore(e); requireAdmin(e); const question=requireListeningDraftQuestion(e.app,String(e.request.pathValue('id')||'')); question.set('audio',null); e.app.save(question); const test=e.app.findRecordById('placement_tests',question.getString('test')); return e.json(200,{question:listeningQuestionDto(question),validation:validateV2(e.app,test)}) }
function previewAudio(e){ privateNoStore(e); requireAdmin(e); const question=requireQuestion(e.app,String(e.request.pathValue('id')||'')); if(question.getString('skill')!==listeningCore.LISTENING_SKILL) throw new BadRequestError('La pregunta no es de Listening.'); const filename=question.getString('audio'); if(!filename) throw new BadRequestError('La pregunta no tiene audio.'); const fs=e.app.newFilesystem(); try{ fs.serve(e.response,e.request,`${question.baseFilesPath()}/${filename}`,filename) } finally { fs.close() } }
function publish(e){ noStore(e); requireAdmin(e); const id=String(e.request.pathValue('id')||''); const draft=requireV2Draft(e.app,id); const initial=validateV2(e.app,draft); if(!initial.ready) throw new BadRequestError(`La versión Listening no puede publicarse todavía: ${initial.errors.slice(0,3).join(' ')}`); e.app.runInTransaction((txApp)=>{ const txDraft=requireV2Draft(txApp,id); const report=validateV2(txApp,txDraft); if(!report.ready) throw new BadRequestError('El banco Listening ha cambiado y ya no cumple los requisitos.'); txApp.findAllRecords('placement_tests').filter((record)=>record.id!==txDraft.id&&record.getString('status')==='PUBLISHED').forEach((record)=>{record.set('status','ARCHIVED');txApp.save(record)}); txDraft.set('status','PUBLISHED'); txDraft.set('published_at',new Date().toISOString()); txApp.save(txDraft) }); const published=e.app.findRecordById('placement_tests',id); return e.json(200,{testId:published.id,status:published.getString('status'),validation:validateV2(e.app,published)}) }

module.exports={createVersion,status,createQuestion,updateQuestion,uploadAudio,deleteAudio,previewAudio,publish}
