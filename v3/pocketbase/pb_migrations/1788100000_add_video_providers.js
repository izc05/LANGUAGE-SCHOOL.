migrate((app) => {
  const classes = app.findCollectionByNameOrId('classes')

  classes.fields.add(
    new SelectField({
      name: 'video_provider',
      maxSelect: 1,
      values: ['ZOOM', 'GOOGLE_MEET', 'JITSI', 'MICROSOFT_TEAMS', 'EXTERNAL'],
    }),
    new TextField({ name: 'meeting_room', max: 180 }),
  )
  app.save(classes)

  const zoomClassIds = {}
  try {
    const zoomMeetings = app.findAllRecords('zoom_meetings')
    for (let index = 0; index < zoomMeetings.length; index += 1) {
      zoomClassIds[zoomMeetings[index].getString('class')] = true
    }
  } catch {
    // Older installations may not have the optional Zoom collection yet.
  }

  function hostnameOf(value) {
    const match = String(value || '').trim().match(/^https:\/\/([^/?#]+)/i)
    if (!match) return ''
    return match[1].split('@').pop().split(':')[0].toLowerCase().replace(/^www\./, '')
  }

  function secureJitsiRoomOf(value) {
    const match = String(value || '').trim().match(/^https:\/\/meet\.jit\.si\/([^?#]+)(?:[?#].*)?$/i)
    if (!match) return ''
    let room = ''
    try { room = decodeURIComponent(match[1].replace(/^\/+|\/+$/g, '')) } catch { return '' }
    return /^[A-Za-z0-9_-]{24,180}$/.test(room) ? room : ''
  }

  const records = app.findAllRecords('classes')
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index]
    const url = record.getString('online_join_url')
    const hostname = hostnameOf(url)
    const jitsiRoom = secureJitsiRoomOf(url)
    let provider = ''

    if (zoomClassIds[record.id]) provider = 'ZOOM'
    else if (hostname === 'meet.google.com') provider = 'GOOGLE_MEET'
    else if (hostname === 'meet.jit.si' && jitsiRoom) provider = 'JITSI'
    else if (hostname === 'teams.microsoft.com' || hostname === 'teams.live.com' || hostname === 'teams.cloud.microsoft') provider = 'MICROSOFT_TEAMS'
    else if (hostname === 'zoom.us' || hostname.endsWith('.zoom.us')) provider = 'ZOOM'
    else if (url) provider = 'EXTERNAL'

    if (provider) {
      record.set('video_provider', provider)
      if (provider === 'JITSI') record.set('meeting_room', jitsiRoom)
      app.save(record)
    }
  }
}, (app) => {
  const classes = app.findCollectionByNameOrId('classes')
  classes.fields.removeByName('video_provider')
  classes.fields.removeByName('meeting_room')
  app.save(classes)
})
