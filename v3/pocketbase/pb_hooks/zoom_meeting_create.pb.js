/// <reference path="../pb_data/types.d.ts" />

routerAdd("POST", "/api/language-school/zoom/classes/{classId}/meeting", (e) => {
  if (!e.auth || e.auth.get("role") !== "ADMIN") {
    throw new ForbiddenError("Solo Administración puede crear reuniones Zoom.")
  }

  function base64Ascii(value) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
    let output = ""
    let index = 0
    while (index < value.length) {
      const byte1 = value.charCodeAt(index++) & 255
      const hasByte2 = index < value.length
      const byte2 = hasByte2 ? value.charCodeAt(index++) & 255 : 0
      const hasByte3 = index < value.length
      const byte3 = hasByte3 ? value.charCodeAt(index++) & 255 : 0
      output += chars.charAt(byte1 >> 2)
      output += chars.charAt(((byte1 & 3) << 4) | (byte2 >> 4))
      output += hasByte2 ? chars.charAt(((byte2 & 15) << 2) | (byte3 >> 6)) : "="
      output += hasByte3 ? chars.charAt(byte3 & 63) : "="
    }
    return output
  }

  function findExisting(app, classId) {
    // Avoid filter parser ambiguity around the relation field literally named `class`.
    // One meeting per class is still enforced at DB level by the unique index.
    const records = app.findAllRecords("zoom_meetings")
    for (let index = 0; index < records.length; index += 1) {
      if (records[index].getString("class") === classId) return records[index]
    }
    return null
  }

  function safeResult(record, existing) {
    return {
      provider: "zoom",
      existing: Boolean(existing),
      status: record.getString("status"),
      externalMeetingId: record.getString("external_meeting_id"),
      joinUrl: record.getString("join_url"),
    }
  }

  function transportConfig() {
    const e2eMode = $os.getenv("LANGUAGE_SCHOOL_E2E") === "1"
    const e2eBase = String($os.getenv("LANGUAGE_SCHOOL_E2E_ZOOM_BASE_URL") || "").replace(/\/+$/, "")
    if (e2eMode && e2eBase) {
      return {
        accountId: "e2e-account",
        clientId: "e2e-client",
        clientSecret: "e2e-secret",
        hostUserId: "e2e-host",
        oauthBase: e2eBase,
        apiBase: e2eBase,
        e2e: true,
      }
    }

    return {
      accountId: $os.getenv("ZOOM_ACCOUNT_ID"),
      clientId: $os.getenv("ZOOM_CLIENT_ID"),
      clientSecret: $os.getenv("ZOOM_CLIENT_SECRET"),
      hostUserId: $os.getenv("ZOOM_HOST_USER_ID"),
      oauthBase: "https://zoom.us",
      apiBase: "https://api.zoom.us",
      e2e: false,
    }
  }

  const classId = String(e.request.pathValue("classId") || "").trim()
  if (!classId) throw new BadRequestError("Falta la clase que se quiere conectar con Zoom.")

  const classRecord = e.app.findRecordById("classes", classId)
  const existingMeeting = findExisting(e.app, classId)
  if (existingMeeting && existingMeeting.getString("status") === "READY" && existingMeeting.getString("join_url")) {
    return e.json(200, safeResult(existingMeeting, true))
  }

  const mode = classRecord.getString("delivery_mode") || "IN_PERSON"
  if (mode !== "ONLINE" && mode !== "HYBRID") {
    throw new BadRequestError("Solo las clases online o híbridas pueden tener una reunión Zoom.")
  }
  if (classRecord.getString("status") !== "SCHEDULED") {
    throw new BadRequestError("Solo se pueden preparar reuniones para clases programadas.")
  }

  const startsAt = new Date(classRecord.getString("starts_at").replace(" ", "T"))
  const endsAt = new Date(classRecord.getString("ends_at").replace(" ", "T"))
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) {
    throw new BadRequestError("La clase no tiene un horario válido para programar Zoom.")
  }

  const transport = transportConfig()
  if (!transport.accountId || !transport.clientId || !transport.clientSecret || !transport.hostUserId) {
    return e.json(409, {
      provider: "zoom",
      created: false,
      reason: "missing_credentials",
      message: "Falta configurar la cuenta anfitriona de Zoom en el servidor.",
    })
  }

  try {
    const authorization = "Basic " + base64Ascii(transport.clientId + ":" + transport.clientSecret)
    const tokenResponse = $http.send({
      url: transport.oauthBase + "/oauth/token?grant_type=account_credentials&account_id=" + encodeURIComponent(transport.accountId),
      method: "POST",
      headers: {
        "Authorization": authorization,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      timeout: 20,
    })

    if (tokenResponse.statusCode !== 200 || !tokenResponse.json || !tokenResponse.json.access_token) {
      return e.json(502, { provider: "zoom", created: false, reason: "oauth_failed" })
    }

    const topic = ("Language School · " + classRecord.getString("topic")).slice(0, 200)
    const duration = Math.max(1, Math.ceil((endsAt.getTime() - startsAt.getTime()) / 60000))
    const meetingResponse = $http.send({
      url: transport.apiBase + "/v2/users/" + encodeURIComponent(transport.hostUserId) + "/meetings",
      method: "POST",
      headers: {
        "Authorization": "Bearer " + tokenResponse.json.access_token,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({
        topic,
        type: 2,
        start_time: startsAt.toISOString(),
        duration,
        settings: {
          waiting_room: true,
          join_before_host: false,
          mute_upon_entry: true,
        },
      }),
      timeout: 25,
    })

    if (meetingResponse.statusCode !== 201 || !meetingResponse.json || !meetingResponse.json.id || !meetingResponse.json.join_url) {
      e.app.logger().warn("Zoom create meeting failed", "status", meetingResponse.statusCode, "e2e", transport.e2e)
      return e.json(502, {
        provider: "zoom",
        created: false,
        reason: "meeting_create_failed",
        statusCode: meetingResponse.statusCode,
      })
    }

    let savedMeeting = null
    e.app.runInTransaction((txApp) => {
      let meetingRecord = findExisting(txApp, classId)
      if (!meetingRecord) meetingRecord = new Record(txApp.findCollectionByNameOrId("zoom_meetings"))
      meetingRecord.set("class", classId)
      meetingRecord.set("provider", "ZOOM")
      meetingRecord.set("external_meeting_id", String(meetingResponse.json.id))
      meetingRecord.set("external_uuid", String(meetingResponse.json.uuid || ""))
      meetingRecord.set("join_url", String(meetingResponse.json.join_url || ""))
      meetingRecord.set("meeting_password", String(meetingResponse.json.password || ""))
      meetingRecord.set("status", "READY")
      meetingRecord.set("created_by", e.auth.id)
      txApp.save(meetingRecord)

      const classToUpdate = txApp.findRecordById("classes", classId)
      classToUpdate.set("online_join_url", String(meetingResponse.json.join_url || ""))
      txApp.save(classToUpdate)
      savedMeeting = meetingRecord
    })

    return e.json(201, safeResult(savedMeeting, false))
  } catch (error) {
    e.app.logger().error("Zoom meeting creation failed", "class", classId, "error", String(error))
    return e.json(502, { provider: "zoom", created: false, reason: "network_error" })
  }
}, $apis.requireAuth("users"))
