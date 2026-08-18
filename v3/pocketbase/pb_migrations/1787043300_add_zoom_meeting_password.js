migrate((app) => {
  const zoomMeetings = app.findCollectionByNameOrId('zoom_meetings')
  zoomMeetings.fields.add(new TextField({ name: 'meeting_password', max: 120 }))
  app.save(zoomMeetings)
}, (app) => {
  const zoomMeetings = app.findCollectionByNameOrId('zoom_meetings')
  zoomMeetings.fields.removeByName('meeting_password')
  app.save(zoomMeetings)
})
