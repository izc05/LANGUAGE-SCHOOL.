/// <reference path="../pb_data/types.d.ts" />

onRecordCreateRequest((e) => {
  function validate(record) {
    const allowed = ['ZOOM', 'GOOGLE_MEET', 'JITSI', 'MICROSOFT_TEAMS', 'EXTERNAL']
    const provider = record.getString('video_provider')
    const joinUrl = record.getString('online_join_url').trim()
    const roomName = record.getString('meeting_room').trim()
    if (provider && allowed.indexOf(provider) === -1) throw new BadRequestError('La plataforma de videoclase no es válida.')
    if ((record.getString('delivery_mode') || 'IN_PERSON') === 'IN_PERSON') return

    let hostname = ''
    let pathname = ''
    if (joinUrl) {
      const match = joinUrl.match(/^https:\/\/([^/?#]+)(\/[^?#]*)?(?:[?#].*)?$/i)
      if (!match || match[1].indexOf('@') !== -1) throw new BadRequestError('El enlace de videoclase debe ser una URL https válida.')
      hostname = match[1].split(':')[0].toLowerCase().replace(/^www\./, '')
      pathname = match[2] || '/'
    }
    if ((provider === 'GOOGLE_MEET' || provider === 'MICROSOFT_TEAMS' || provider === 'EXTERNAL') && !joinUrl) throw new BadRequestError('La plataforma seleccionada necesita un enlace https.')
    if (provider === 'GOOGLE_MEET' && hostname !== 'meet.google.com') throw new BadRequestError('El enlace no pertenece a Google Meet.')
    if (provider === 'MICROSOFT_TEAMS' && ['teams.microsoft.com', 'teams.live.com', 'teams.cloud.microsoft'].indexOf(hostname) === -1) throw new BadRequestError('El enlace no pertenece a Microsoft Teams.')
    if (provider === 'JITSI') {
      if (!roomName && !joinUrl) return
      if (!/^[A-Za-z0-9_-]{24,180}$/.test(roomName)) throw new BadRequestError('La sala Jitsi no tiene un identificador seguro.')
      let decodedRoom = ''
      try { decodedRoom = decodeURIComponent(pathname.replace(/^\/+|\/+$/g, '')) } catch (_) { throw new BadRequestError('El enlace Jitsi no es válido.') }
      if (hostname !== 'meet.jit.si' || decodedRoom !== roomName) throw new BadRequestError('El enlace Jitsi no coincide con la sala segura de la clase.')
    }
  }
  validate(e.record)
  e.next()
}, 'classes')

onRecordUpdateRequest((e) => {
  function validate(record) {
    const allowed = ['ZOOM', 'GOOGLE_MEET', 'JITSI', 'MICROSOFT_TEAMS', 'EXTERNAL']
    const provider = record.getString('video_provider')
    const joinUrl = record.getString('online_join_url').trim()
    const roomName = record.getString('meeting_room').trim()
    if (provider && allowed.indexOf(provider) === -1) throw new BadRequestError('La plataforma de videoclase no es válida.')
    if ((record.getString('delivery_mode') || 'IN_PERSON') === 'IN_PERSON') return

    let hostname = ''
    let pathname = ''
    if (joinUrl) {
      const match = joinUrl.match(/^https:\/\/([^/?#]+)(\/[^?#]*)?(?:[?#].*)?$/i)
      if (!match || match[1].indexOf('@') !== -1) throw new BadRequestError('El enlace de videoclase debe ser una URL https válida.')
      hostname = match[1].split(':')[0].toLowerCase().replace(/^www\./, '')
      pathname = match[2] || '/'
    }
    if ((provider === 'GOOGLE_MEET' || provider === 'MICROSOFT_TEAMS' || provider === 'EXTERNAL') && !joinUrl) throw new BadRequestError('La plataforma seleccionada necesita un enlace https.')
    if (provider === 'GOOGLE_MEET' && hostname !== 'meet.google.com') throw new BadRequestError('El enlace no pertenece a Google Meet.')
    if (provider === 'MICROSOFT_TEAMS' && ['teams.microsoft.com', 'teams.live.com', 'teams.cloud.microsoft'].indexOf(hostname) === -1) throw new BadRequestError('El enlace no pertenece a Microsoft Teams.')
    if (provider === 'JITSI') {
      if (!roomName && !joinUrl) return
      if (!/^[A-Za-z0-9_-]{24,180}$/.test(roomName)) throw new BadRequestError('La sala Jitsi no tiene un identificador seguro.')
      let decodedRoom = ''
      try { decodedRoom = decodeURIComponent(pathname.replace(/^\/+|\/+$/g, '')) } catch (_) { throw new BadRequestError('El enlace Jitsi no es válido.') }
      if (hostname !== 'meet.jit.si' || decodedRoom !== roomName) throw new BadRequestError('El enlace Jitsi no coincide con la sala segura de la clase.')
    }
  }
  validate(e.record)
  e.next()
}, 'classes')
